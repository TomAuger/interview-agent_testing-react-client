/**
 * Dev-only inspection client for the interview-tree pane.
 *
 * Talks to the agent-server's dev routes (`/interviews/:id/dev-state` and
 * `/dev-stream`, mounted outside `/api` like the other test-harness routes).
 * The pane renders the interview's internal ledger structure — topics,
 * questions, follow-ups, statuses, progress — plus the model calls the
 * server-side recorder captured while a pane was connected.
 *
 * Types mirror the server's `InterviewTree`/`DevSnapshot` shapes but are
 * hand-parsed in the same defensive style as `client.ts` — there is no
 * shared package between the projects.
 */

const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? '';

export type DevQuestionStatus = 'pending' | 'asked' | 'answered' | 'skipped';
export type DevDirective = 'answer' | 'skip' | 'finish';

export interface DevCorrection {
  proposedSummary: string;
  evidence: string;
  previousSummary?: string;
  applied: boolean;
}

export interface DevFollowUpProposal {
  intent: string;
  applied: boolean;
  droppedReason?: string;
}

export interface DevQuestion {
  id: string;
  topicId: string;
  intent: string;
  status: DevQuestionStatus;
  followUpOf?: string;
  askedText?: string;
  answerSummary?: string;
  directive?: DevDirective;
  corrections: DevCorrection[];
  followUpIntent?: DevFollowUpProposal;
}

export interface DevTopicCounts {
  planned: number;
  pending: number;
  asked: number;
  answered: number;
  skipped: number;
  followUps: number;
}

export interface DevTopic {
  id: string;
  title: string;
  required: boolean;
  covered: boolean;
  counts: DevTopicCounts;
  questions: DevQuestion[];
}

/** A proposal that never reached the ledger (annotation-only). */
export interface DevGhost {
  kind: 'followup-dropped' | 'planned-trimmed' | 'planned-unknown-topic';
  topicId: string;
  parentQuestionId?: string;
  intent: string;
  reason: string;
}

export interface DevTree {
  interviewId: string;
  phase: 'overview' | 'topics' | 'closed';
  turnsUsed: number;
  maxTurns: number;
  overview: {
    promptId: string;
    question: string;
    answered: boolean;
    answerSummary?: string;
    directive?: DevDirective;
  };
  topics: DevTopic[];
  ghosts: DevGhost[];
  pending: { promptId: string; questionId: string | null; askedText: string } | null;
  completion: {
    reason: string;
    definitionOfDoneMet: boolean;
    gaps: string[];
    closing?: string;
  } | null;
  coverage: { covered: string[]; missing: string[] };
}

export type DevCallTask = 'plan' | 'analyze' | 'phrase' | 'judge' | 'writeArtifact' | 'vary';
export type DevCallStatus = 'in-flight' | 'ok' | 'error';

/** One recorded model call, for the agent-activity panel. */
export interface DevCall {
  interviewId: string;
  seq: number;
  task: DevCallTask;
  promptId?: string;
  questionId?: string | null;
  startedAt: number;
  status: DevCallStatus;
  durationMs?: number;
  output?: unknown;
  errorCode?: string;
}

export interface DevSnapshot {
  status: string;
  tree: DevTree;
  calls: DevCall[];
}

export interface DevStreamHandlers {
  onSnapshot: (snapshot: DevSnapshot) => void;
  onTree: (tree: DevTree) => void;
  onCallStart: (call: Partial<DevCall> & { seq: number; task: DevCallTask }) => void;
  onCallEnd: (call: {
    seq: number;
    task: DevCallTask;
    durationMs: number;
    output: unknown;
  }) => void;
  onCallError: (call: { seq: number; task: DevCallTask; durationMs: number; errorCode: string }) => void;
  onStatus: (status: string) => void;
  onOpen: () => void;
  onDisconnect: () => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * One-shot snapshot (same payload as the SSE `snapshot` event). Useful for
 * probing an interview without holding a stream open.
 */
export const getDevSnapshot = async (interviewId: string): Promise<DevSnapshot> => {
  const response = await fetch(
    `${API_BASE}/interviews/${encodeURIComponent(interviewId)}/dev-state`,
  );
  if (!response.ok) {
    throw new Error(`dev-state failed with status ${String(response.status)}`);
  }
  return (await response.json()) as DevSnapshot;
};

/**
 * Open the SSE stream for one interview. Events fan out to the handlers;
 * the stream reconnects automatically (EventSource) unless closed.
 *
 * @returns A close function — call it on unmount / interview switch.
 */
export const openDevStream = (
  interviewId: string,
  handlers: DevStreamHandlers,
): (() => void) => {
  const source = new EventSource(
    `${API_BASE}/interviews/${encodeURIComponent(interviewId)}/dev-stream`,
  );

  source.addEventListener('snapshot', (e) => {
    const data = parseJson((e as MessageEvent<string>).data);
    if (isRecord(data) && isRecord(data.tree)) {
      handlers.onSnapshot(data as unknown as DevSnapshot);
    }
  });
  source.addEventListener('tree', (e) => {
    const data = parseJson((e as MessageEvent<string>).data);
    if (isRecord(data)) handlers.onTree(data as unknown as DevTree);
  });
  source.addEventListener('call-start', (e) => {
    const data = parseJson((e as MessageEvent<string>).data);
    if (isRecord(data) && typeof data.seq === 'number') {
      handlers.onCallStart(data as Partial<DevCall> & { seq: number; task: DevCallTask });
    }
  });
  source.addEventListener('call-end', (e) => {
    const data = parseJson((e as MessageEvent<string>).data);
    if (isRecord(data) && typeof data.seq === 'number') {
      handlers.onCallEnd(
        data as { seq: number; task: DevCallTask; durationMs: number; output: unknown },
      );
    }
  });
  source.addEventListener('call-error', (e) => {
    const data = parseJson((e as MessageEvent<string>).data);
    if (isRecord(data) && typeof data.seq === 'number') {
      handlers.onCallError(
        data as { seq: number; task: DevCallTask; durationMs: number; errorCode: string },
      );
    }
  });
  source.addEventListener('status', (e) => {
    const data = parseJson((e as MessageEvent<string>).data);
    if (isRecord(data) && typeof data.status === 'string') handlers.onStatus(data.status);
  });
  source.onopen = handlers.onOpen;
  source.onerror = () => {
    // EventSource retries automatically; report the dip so the pane can
    // show a stale indicator until onopen fires again.
    handlers.onDisconnect();
  };

  return () => {
    source.close();
  };
};
