/**
 * Thin fetch client for the agent-server workflow routes.
 *
 * Route shapes are defined by the installed Mastra server (`@mastra/server`):
 * `runId` is a *query* parameter on `start-async`/`resume-async` — a `runId`
 * field in the JSON body is ignored and the server generates a random one.
 */

const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? '';

const INTERVIEW_WORKFLOW_ID = 'interviewWorkflow';
const ARTIFACT_WORKFLOW_ID = 'interviewArtifact';

/** HTTP failure with the response status code preserved for callers. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, path: string) {
    super(`Request to ${path} failed with status ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export type SuspendKind = 'welcome' | 'question' | 'stale-prompt' | 'model-error' | 'rollback-error';

export interface SuspendPayload {
  kind: SuspendKind;
  promptId: string;
  question: string;
  welcome?: string;
  errorCode?: string;
}

export interface InterviewResult {
  interviewId: string;
  closing: string;
  completionReason: 'questions-exhausted' | 'finish-requested' | 'turn-cap';
  gaps: string[];
}

/** The fields this UI consumes from a workflow run response. */
export interface WorkflowRun {
  status: string;
  suspendPayload?: SuspendPayload;
  result?: InterviewResult;
}

export interface ArtifactRun {
  status: string;
  markdown?: string;
  /** The artifact run id the status was read from (the interview id or a `<id>-aN` attempt). */
  runId?: string;
}

/** One line-tagged entry in the transcript returned by GET /interviews/:id. */
export type TranscriptMessage =
  | { kind: 'welcome'; text: string }
  | {
      kind: 'question';
      line: number;
      promptId: string;
      questionId: string | null;
      text: string;
    }
  | {
      kind: 'answer';
      line: number;
      turnId: string;
      text: string;
      directive: 'answer' | 'skip' | 'finish';
      at: number;
    };

/** Response shape of the test-harness transcript route (mounted outside /api). */
export interface InterviewTranscript {
  interviewId: string;
  status: string;
  messages: TranscriptMessage[];
  pending: { promptId: string; questionId: string | null; askedText: string } | null;
  completion: {
    reason: string;
    definitionOfDoneMet: boolean;
    gaps: string[];
    closing: string;
  } | null;
}

/** One entry in the built-in workflow runs list — the interview id ledger. */
export interface InterviewRunSummary {
  runId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSuspendKind = (value: unknown): value is SuspendKind =>
  value === 'welcome' ||
  value === 'question' ||
  value === 'stale-prompt' ||
  value === 'model-error' ||
  value === 'rollback-error';

const isCompletionReason = (value: unknown): value is InterviewResult['completionReason'] =>
  value === 'questions-exhausted' || value === 'finish-requested' || value === 'turn-cap';

const parseSuspendPayload = (raw: unknown): SuspendPayload | undefined => {
  if (!isRecord(raw)) return undefined;
  const { kind, promptId, question, welcome, errorCode } = raw;
  if (!isSuspendKind(kind) || typeof promptId !== 'string' || typeof question !== 'string') {
    return undefined;
  }
  return {
    kind,
    promptId,
    question,
    ...(typeof welcome === 'string' && { welcome }),
    ...(typeof errorCode === 'string' && { errorCode }),
  };
};

const parseInterviewResult = (raw: unknown): InterviewResult | undefined => {
  if (!isRecord(raw)) return undefined;
  const { interviewId, closing, completionReason, gaps } = raw;
  if (
    typeof interviewId !== 'string' ||
    typeof closing !== 'string' ||
    !isCompletionReason(completionReason) ||
    !Array.isArray(gaps) ||
    !gaps.every((gap) => typeof gap === 'string')
  ) {
    return undefined;
  }
  return { interviewId, closing, completionReason, gaps: gaps as string[] };
};

const parseWorkflowRun = (raw: unknown): WorkflowRun => {
  if (!isRecord(raw) || typeof raw.status !== 'string') {
    throw new Error('Malformed workflow run response');
  }
  const steps = isRecord(raw.steps) ? raw.steps : undefined;
  const conduct = steps && isRecord(steps.conduct) ? steps.conduct : undefined;
  const suspendPayload = conduct ? parseSuspendPayload(conduct.suspendPayload) : undefined;
  const result = parseInterviewResult(raw.result);
  if (raw.status === 'success' && result === undefined) {
    throw new Error('Malformed workflow run result');
  }
  return {
    status: raw.status,
    ...(suspendPayload !== undefined && { suspendPayload }),
    ...(result !== undefined && { result }),
  };
};

const parseArtifactRun = (raw: unknown): ArtifactRun => {
  if (!isRecord(raw) || typeof raw.status !== 'string') {
    throw new Error('Malformed artifact run response');
  }
  const result = isRecord(raw.result) ? raw.result : undefined;
  const markdown = result && typeof result.markdown === 'string' ? result.markdown : undefined;
  if (raw.status === 'success' && markdown === undefined) {
    throw new Error('Malformed artifact run result');
  }
  return { status: raw.status, ...(markdown !== undefined && { markdown }) };
};

const request = async (path: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) throw new HttpError(response.status, path);
  return response.json() as Promise<unknown>;
};

const post = (path: string, body: unknown): Promise<unknown> =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/**
 * Start a fresh interview run, optionally choosing the interview type via the
 * registered profile id (see listProfiles).
 */
export const startInterview = async (
  interviewId: string,
  profileId?: string,
): Promise<WorkflowRun> =>
  parseWorkflowRun(
    await post(
      `/api/workflows/${INTERVIEW_WORKFLOW_ID}/start-async?runId=${encodeURIComponent(interviewId)}`,
      {
        inputData: profileId === undefined ? {} : { profileId },
        initialState: { ledger: null },
      },
    ),
  );

/**
 * Registered interview profile ids a client may pass to startInterview.
 * Test-harness route mounted outside `/api` — `/interview-profiles`.
 */
export const listProfiles = async (): Promise<string[]> => {
  const raw = await request('/interview-profiles');
  if (!isRecord(raw) || !Array.isArray(raw.profiles)) {
    throw new Error('Malformed profile list response');
  }
  return raw.profiles
    .filter((p): p is Record<string, unknown> => isRecord(p) && typeof p.id === 'string')
    .map((p) => p.id as string);
};

export const resumeInterview = async (
  interviewId: string,
  promptId: string,
  answerText: string,
): Promise<WorkflowRun> =>
  parseWorkflowRun(
    await post(
      `/api/workflows/${INTERVIEW_WORKFLOW_ID}/resume-async?runId=${encodeURIComponent(interviewId)}`,
      { resumeData: { promptId, answerText } },
    ),
  );

export const getInterviewStatus = async (interviewId: string): Promise<WorkflowRun> =>
  parseWorkflowRun(
    await request(
      `/api/workflows/${INTERVIEW_WORKFLOW_ID}/runs/${encodeURIComponent(interviewId)}?fields=result,steps`,
    ),
  );

export const getArtifactStatus = async (interviewId: string): Promise<ArtifactRun> =>
  parseArtifactRun(
    await request(
      `/api/workflows/${ARTIFACT_WORKFLOW_ID}/runs/${encodeURIComponent(interviewId)}?fields=result`,
    ),
  );

const parseTranscriptMessage = (raw: unknown): TranscriptMessage | undefined => {
  if (!isRecord(raw)) return undefined;
  if (raw.kind === 'welcome' && typeof raw.text === 'string') {
    return { kind: 'welcome', text: raw.text };
  }
  if (
    raw.kind === 'question' &&
    typeof raw.line === 'number' &&
    typeof raw.promptId === 'string' &&
    typeof raw.text === 'string'
  ) {
    return {
      kind: 'question',
      line: raw.line,
      promptId: raw.promptId,
      questionId: typeof raw.questionId === 'string' ? raw.questionId : null,
      text: raw.text,
    };
  }
  if (
    raw.kind === 'answer' &&
    typeof raw.line === 'number' &&
    typeof raw.turnId === 'string' &&
    typeof raw.text === 'string' &&
    typeof raw.at === 'number'
  ) {
    const directive =
      raw.directive === 'skip' || raw.directive === 'finish' ? raw.directive : 'answer';
    return { kind: 'answer', line: raw.line, turnId: raw.turnId, text: raw.text, directive, at: raw.at };
  }
  return undefined;
};

const parseTranscript = (raw: unknown): InterviewTranscript => {
  if (!isRecord(raw) || typeof raw.interviewId !== 'string' || typeof raw.status !== 'string') {
    throw new Error('Malformed transcript response');
  }
  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .map(parseTranscriptMessage)
        .filter((m): m is TranscriptMessage => m !== undefined)
    : [];
  const pending =
    isRecord(raw.pending) && typeof raw.pending.promptId === 'string'
      ? {
          promptId: raw.pending.promptId,
          questionId: typeof raw.pending.questionId === 'string' ? raw.pending.questionId : null,
          askedText: typeof raw.pending.askedText === 'string' ? raw.pending.askedText : '',
        }
      : null;
  const completion =
    isRecord(raw.completion) && typeof raw.completion.closing === 'string'
      ? {
          reason: typeof raw.completion.reason === 'string' ? raw.completion.reason : 'unknown',
          definitionOfDoneMet: raw.completion.definitionOfDoneMet === true,
          gaps: Array.isArray(raw.completion.gaps)
            ? raw.completion.gaps.filter((g): g is string => typeof g === 'string')
            : [],
          closing: raw.completion.closing,
        }
      : null;
  return { interviewId: raw.interviewId, status: raw.status, messages, pending, completion };
};

/**
 * Full persisted transcript for one interview. NOTE: this test-harness route
 * mounts outside `/api` — `/interviews/:id`, proxied separately by Vite.
 */
export const getTranscript = async (interviewId: string): Promise<InterviewTranscript> =>
  parseTranscript(await request(`/interviews/${encodeURIComponent(interviewId)}`));

const parseInterviewRuns = (raw: unknown): InterviewRunSummary[] => {
  if (!isRecord(raw) || !Array.isArray(raw.runs)) {
    throw new Error('Malformed runs list response');
  }
  // Runs-list entries are {workflowName, runId, snapshot, createdAt, updatedAt}
  // — the run's status is nested inside the embedded snapshot.
  return raw.runs
    .filter((r): r is Record<string, unknown> => isRecord(r) && typeof r.runId === 'string')
    .map((r) => {
      const snapshot = isRecord(r.snapshot) ? r.snapshot : {};
      return {
        runId: r.runId as string,
        status:
          typeof snapshot.status === 'string'
            ? snapshot.status
            : typeof r.status === 'string'
              ? r.status
              : 'unknown',
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
        updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
      };
    });
};

/** Every stored interview run (built-in route): the ledger of interview ids. */
export const listInterviews = async (): Promise<InterviewRunSummary[]> =>
  parseInterviewRuns(
    await request(`/api/workflows/${INTERVIEW_WORKFLOW_ID}/runs?perPage=100`),
  );

/**
 * Roll an interview back to a turn line (erases that turn's answer and all
 * later state, re-presenting the prompt at the line). Suspended runs use
 * resume-async; completed runs need time-travel back to the conduct step.
 */
export const rollbackInterview = async (
  interviewId: string,
  status: string,
  rollbackToTurn: number,
): Promise<WorkflowRun> =>
  parseWorkflowRun(
    await post(
      status === 'suspended'
        ? `/api/workflows/${INTERVIEW_WORKFLOW_ID}/resume-async?runId=${encodeURIComponent(interviewId)}`
        : `/api/workflows/${INTERVIEW_WORKFLOW_ID}/time-travel-async?runId=${encodeURIComponent(interviewId)}`,
      status === 'suspended'
        ? { resumeData: { rollbackToTurn } }
        : { step: 'conduct', resumeData: { rollbackToTurn } },
    ),
  );

/**
 * Start a fresh artifact run from the interview's stored ledger. Returns the
 * new run id (`<interviewId>-aN`) to poll via getArtifactStatus.
 */
export const regenerateArtifact = async (interviewId: string): Promise<{ runId: string }> => {
  const raw = await post(`/interviews/${encodeURIComponent(interviewId)}/artifact`, {});
  if (!isRecord(raw) || typeof raw.runId !== 'string') {
    throw new Error('Malformed artifact regeneration response');
  }
  return { runId: raw.runId };
};

/**
 * Status of the most recent artifact attempt for an interview — the original
 * run (id = interviewId) or the newest `<id>-aN` regeneration.
 */
export const getLatestArtifactStatus = async (interviewId: string): Promise<ArtifactRun> => {
  const raw = await request(`/api/workflows/${ARTIFACT_WORKFLOW_ID}/runs?perPage=100`);
  const latest = parseInterviewRuns(raw)
    .filter((r) => r.runId === interviewId || r.runId.startsWith(`${interviewId}-a`))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]?.runId;
  if (latest === undefined) {
    throw new HttpError(404, `/api/workflows/${ARTIFACT_WORKFLOW_ID}/runs`);
  }
  const run = await getArtifactStatus(latest);
  return { ...run, runId: latest };
};
