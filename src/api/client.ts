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

export type SuspendKind = 'welcome' | 'question' | 'stale-prompt' | 'model-error';

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
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSuspendKind = (value: unknown): value is SuspendKind =>
  value === 'welcome' ||
  value === 'question' ||
  value === 'stale-prompt' ||
  value === 'model-error';

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

export const startInterview = async (interviewId: string): Promise<WorkflowRun> =>
  parseWorkflowRun(
    await post(
      `/api/workflows/${INTERVIEW_WORKFLOW_ID}/start-async?runId=${encodeURIComponent(interviewId)}`,
      { inputData: {}, initialState: { ledger: null } },
    ),
  );

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
