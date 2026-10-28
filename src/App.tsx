import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Center, Container, Loader } from '@mantine/core';
import type { InterviewRunSummary, InterviewTranscript, SuspendPayload, WorkflowRun } from './api/client';
import {
  getArtifactStatus,
  getInterviewStatus,
  getLatestArtifactStatus,
  getTranscript,
  HttpError,
  listInterviews,
  regenerateArtifact,
  resumeInterview,
  rollbackInterview,
  startInterview,
} from './api/client';
import { ChatScreen } from './components/ChatScreen';
import { InterviewListPane } from './components/InterviewListPane';
import { StartScreen } from './components/StartScreen';
import { clearStoredId, readStoredId, storeId } from './storage';
import type { Action, InterviewState, Message } from './types';
import styles from './App.module.css';

const NETWORK_ERROR =
  'Unable to reach the interview server. Make sure `agent-server` is running on `http://localhost:4111`.';

const STALE_PROMPT_ERROR =
  "That answer didn't match the current question. Please answer the question above.";

const MODEL_ERROR = 'The assistant had a temporary issue. Please try again.';

const ROLLBACK_ERROR = 'There is no recorded interview state at that line.';

const initialState: InterviewState = {
  phase: 'start',
  interviewId: null,
  runStatus: null,
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
    case 'HYDRATED':
      return {
        ...state,
        phase: action.phase,
        runStatus: action.runStatus,
        pendingPromptId: action.pendingPromptId,
        messages: action.messages,
        isLoading: false,
        error: null,
      };
    case 'STARTED':
    case 'RECEIVED_QUESTION':
      return {
        ...state,
        phase: 'active',
        runStatus: 'suspended',
        pendingPromptId: action.promptId,
        messages: [
          ...state.messages,
          {
            id: action.id,
            role: 'bot',
            text: action.text,
            ...(action.line !== undefined && { line: action.line }),
          },
        ],
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
        runStatus: 'success',
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

/** Map a persisted transcript onto the scrolling message list. */
const messagesFromTranscript = (transcript: InterviewTranscript): Message[] => {
  const messages: Message[] = [];
  for (const entry of transcript.messages) {
    if (entry.kind === 'welcome') {
      messages.push({ id: newMessageId(), role: 'bot', text: entry.text });
    } else if (entry.kind === 'question') {
      messages.push({ id: newMessageId(), role: 'bot', text: entry.text, line: entry.line });
    } else {
      messages.push({ id: newMessageId(), role: 'human', text: entry.text, line: entry.line });
    }
  }
  if (transcript.pending !== null) {
    // The pending prompt has no answer yet — shown without a line tag.
    messages.push({ id: newMessageId(), role: 'bot', text: transcript.pending.askedText });
  }
  if (transcript.completion !== null) {
    messages.push({
      id: newMessageId(),
      role: 'completion',
      closing: transcript.completion.closing,
      gaps: transcript.completion.gaps,
    });
  }
  return messages;
};

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const hydrated = useRef(false);
  const [interviews, setInterviews] = useState<InterviewRunSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const refreshList = useCallback(async (): Promise<void> => {
    setListLoading(true);
    try {
      setInterviews(await listInterviews());
    } catch {
      // Keep the last known list when the server is unreachable.
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  /** Re-hydrate a stored interview from its persisted transcript. */
  const hydrate = useCallback(async (interviewId: string): Promise<void> => {
    const transcript = await getTranscript(interviewId);
    dispatch({
      type: 'HYDRATED',
      runStatus: transcript.status,
      phase: transcript.completion !== null ? 'complete' : 'active',
      pendingPromptId: transcript.pending?.promptId ?? null,
      messages: messagesFromTranscript(transcript),
    });
  }, []);

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
      void refreshList();
      return;
    }
    const payload = run.suspendPayload;
    if (run.status === 'suspended' && payload !== undefined) {
      if (
        payload.kind === 'stale-prompt' ||
        payload.kind === 'model-error' ||
        payload.kind === 'rollback-error'
      ) {
        dispatch({
          type: 'RECEIVED_ERROR',
          id: newMessageId(),
          text:
            payload.kind === 'stale-prompt'
              ? STALE_PROMPT_ERROR
              : payload.kind === 'rollback-error'
                ? ROLLBACK_ERROR
                : MODEL_ERROR,
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

  const joinAndHydrate = useCallback(
    async (interviewId: string): Promise<void> => {
      dispatch({ type: 'JOIN_INTERVIEW', interviewId });
      storeId(interviewId);
      try {
        await hydrate(interviewId);
      } catch {
        clearStoredId();
        dispatch({ type: 'SET_START' });
      }
    },
    [hydrate],
  );

  // Resume the persisted interview (if any) once on mount.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const stored = readStoredId();
    if (stored === null) return;
    void joinAndHydrate(stored);
  }, [joinAndHydrate]);

  /**
   * Start button: join the interview if a run already exists for the typed id
   * (e.g. after Start Over with an existing id), otherwise start a fresh run.
   */
  const startOrJoin = async (interviewId: string): Promise<void> => {
    dispatch({ type: 'JOIN_INTERVIEW', interviewId });
    storeId(interviewId);
    try {
      let exists = true;
      try {
        await getInterviewStatus(interviewId);
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) {
          exists = false;
        } else {
          throw err;
        }
      }
      if (!exists) {
        await startInterview(interviewId);
      }
      await hydrate(interviewId);
      void refreshList();
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

  /** Roll back to a turn line, then reload the truncated transcript. */
  const rollbackTo = async (line: number): Promise<void> => {
    const { interviewId, runStatus } = state;
    if (interviewId === null || runStatus === null) return;
    dispatch({ type: 'JOIN_INTERVIEW', interviewId });
    try {
      const run = await rollbackInterview(interviewId, runStatus, line);
      if (run.suspendPayload?.kind === 'rollback-error') {
        applyRun(run);
        return;
      }
      await hydrate(interviewId);
    } catch {
      dispatch({ type: 'API_ERROR', error: NETWORK_ERROR });
    }
  };

  const startOver = (): void => {
    clearStoredId();
    dispatch({ type: 'SET_START' });
  };

  const interviewId = state.interviewId ?? '';

  return (
    <div className={styles.appShell}>
      <InterviewListPane
        interviews={interviews}
        activeId={state.interviewId}
        isLoading={listLoading}
        onSelect={(id) => void joinAndHydrate(id)}
        onNew={startOver}
        onRefresh={() => void refreshList()}
      />
      <main className={styles.mainPane}>
        {state.phase === 'start' ? (
          state.interviewId !== null && state.isLoading ? (
            <Center style={{ minHeight: '100%' }}>
              <Loader />
            </Center>
          ) : (
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
          )
        ) : (
          <ChatScreen
            key={interviewId}
            interviewId={interviewId}
            messages={state.messages}
            isComplete={state.phase === 'complete'}
            isLoading={state.isLoading}
            error={state.error}
            onSubmit={(text) => void submitAnswer(text)}
            onStartOver={startOver}
            onRollback={(line) => void rollbackTo(line)}
            onViewArtifact={() => getLatestArtifactStatus(interviewId)}
            onFetchArtifact={(runId) => getArtifactStatus(runId)}
            onRegenerateArtifact={() => regenerateArtifact(interviewId)}
          />
        )}
      </main>
    </div>
  );
}
