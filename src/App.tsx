import { useEffect, useReducer, useRef } from 'react';
import { Alert, Center, Container, Loader } from '@mantine/core';
import type { SuspendPayload, WorkflowRun } from './api/client';
import { getArtifactStatus, getInterviewStatus, HttpError, resumeInterview, startInterview } from './api/client';
import { ChatScreen } from './components/ChatScreen';
import { StartScreen } from './components/StartScreen';
import { clearStoredId, readStoredId, storeId } from './storage';
import type { Action, InterviewState } from './types';

const NETWORK_ERROR =
  'Unable to reach the interview server. Make sure `agent-server` is running on `http://localhost:4111`.';

const STALE_PROMPT_ERROR =
  "That answer didn't match the current question. Please answer the question above.";

const MODEL_ERROR = 'The assistant had a temporary issue. Please try again.';

const initialState: InterviewState = {
  phase: 'start',
  interviewId: null,
  pendingPromptId: null,
  messages: [],
  isLoading: false,
  error: null,
};

function reducer(state: InterviewState, action: Action): InterviewState {
  switch (action.type) {
    case 'SET_START':
      return initialState;
    case 'JOIN_INTERVIEW':
      return { ...state, interviewId: action.interviewId, isLoading: true, error: null };
    case 'STARTED':
    case 'RECEIVED_QUESTION':
      return {
        ...state,
        phase: 'active',
        pendingPromptId: action.promptId,
        messages: [...state.messages, { id: action.id, role: 'bot', text: action.text }],
        isLoading: false,
        error: null,
      };
    case 'SUBMIT_ANSWER':
      return {
        ...state,
        messages: [...state.messages, { id: action.id, role: 'human', text: action.text }],
        isLoading: true,
        error: null,
      };
    case 'RECEIVED_ERROR':
      return {
        ...state,
        phase: 'active',
        messages: [
          ...state.messages,
          {
            id: action.id,
            role: 'error',
            text: action.text,
            ...(action.code !== undefined && { code: action.code }),
          },
        ],
        isLoading: false,
        error: null,
      };
    case 'COMPLETED':
      return {
        ...state,
        phase: 'complete',
        pendingPromptId: null,
        messages: [
          ...state.messages,
          { id: action.id, role: 'completion', closing: action.closing, gaps: action.gaps },
        ],
        isLoading: false,
        error: null,
      };
    case 'API_ERROR':
      return { ...state, error: action.error, isLoading: false };
  }
}

const newMessageId = (): string => crypto.randomUUID();

/** The text shown in the transcript for the pending prompt. */
const promptText = (payload: SuspendPayload): string =>
  payload.kind === 'welcome' && payload.welcome !== undefined
    ? `${payload.welcome}\n\n${payload.question}`
    : payload.question;

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const hydrated = useRef(false);

  /** Map a workflow run response onto the transcript reducer. */
  const applyRun = (run: WorkflowRun): void => {
    if (run.status === 'success') {
      if (run.result === undefined) {
        dispatch({ type: 'API_ERROR', error: NETWORK_ERROR });
        return;
      }
      dispatch({
        type: 'COMPLETED',
        id: newMessageId(),
        closing: run.result.closing,
        gaps: run.result.gaps,
      });
      return;
    }
    const payload = run.suspendPayload;
    if (run.status === 'suspended' && payload !== undefined) {
      if (payload.kind === 'stale-prompt' || payload.kind === 'model-error') {
        dispatch({
          type: 'RECEIVED_ERROR',
          id: newMessageId(),
          text: payload.kind === 'stale-prompt' ? STALE_PROMPT_ERROR : MODEL_ERROR,
          ...(payload.errorCode !== undefined && { code: payload.errorCode }),
        });
      } else {
        dispatch({
          type: payload.kind === 'welcome' ? 'STARTED' : 'RECEIVED_QUESTION',
          id: newMessageId(),
          promptId: payload.promptId,
          text: promptText(payload),
        });
      }
      return;
    }
    dispatch({ type: 'API_ERROR', error: NETWORK_ERROR });
  };

  /** Re-hydrate a stored interview run after a refresh or explicit join. */
  const hydrate = async (interviewId: string): Promise<void> => {
    try {
      applyRun(await getInterviewStatus(interviewId));
    } catch {
      clearStoredId();
      dispatch({ type: 'SET_START' });
    }
  };

  // Resume the persisted interview (if any) once on mount.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const stored = readStoredId();
    if (stored === null) return;
    dispatch({ type: 'JOIN_INTERVIEW', interviewId: stored });
    void hydrate(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Start button: join the interview if a run already exists for the typed id
   * (e.g. after Start Over with an existing id), otherwise start a fresh run.
   */
  const startOrJoin = async (interviewId: string): Promise<void> => {
    dispatch({ type: 'JOIN_INTERVIEW', interviewId });
    storeId(interviewId);
    try {
      let run: WorkflowRun | null;
      try {
        run = await getInterviewStatus(interviewId);
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) {
          run = null;
        } else {
          throw err;
        }
      }
      applyRun(run ?? (await startInterview(interviewId)));
    } catch {
      dispatch({ type: 'API_ERROR', error: NETWORK_ERROR });
    }
  };

  const submitAnswer = async (text: string): Promise<void> => {
    const { interviewId, pendingPromptId } = state;
    if (interviewId === null || pendingPromptId === null) return;
    dispatch({ type: 'SUBMIT_ANSWER', id: newMessageId(), text });
    try {
      applyRun(await resumeInterview(interviewId, pendingPromptId, text));
    } catch {
      dispatch({ type: 'API_ERROR', error: NETWORK_ERROR });
    }
  };

  const startOver = (): void => {
    clearStoredId();
    dispatch({ type: 'SET_START' });
  };

  if (state.phase === 'start') {
    if (state.interviewId !== null && state.isLoading) {
      return (
        <Center style={{ minHeight: '100vh' }}>
          <Loader />
        </Center>
      );
    }
    return (
      <Container size="sm" py="md">
        {state.error !== null && (
          <Alert color="red" variant="light" mb="md">
            {state.error}
          </Alert>
        )}
        <StartScreen
          initialId={state.interviewId ?? ''}
          isLoading={state.isLoading}
          onStart={(id) => void startOrJoin(id)}
        />
      </Container>
    );
  }

  return (
    <ChatScreen
      interviewId={state.interviewId ?? ''}
      messages={state.messages}
      isComplete={state.phase === 'complete'}
      isLoading={state.isLoading}
      error={state.error}
      onSubmit={(text) => void submitAnswer(text)}
      onStartOver={startOver}
      onViewArtifact={() => getArtifactStatus(state.interviewId ?? '')}
    />
  );
}
