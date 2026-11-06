/**
 * Hook owning the dev-pane's SSE connection for the active interview.
 *
 * Keeps the latest projected tree, a capped list of recorded model calls
 * (most recent last), the run status and connection health — deliberately
 * separate from the chat reducer so the inspector never couples to the
 * conversation UI.
 */
import { useEffect, useRef, useState } from 'react';
import { openDevStream } from '../api/dev';
import type { DevCall, DevTree } from '../api/dev';

/** Calls kept client-side; the panel renders only the tail anyway. */
const MAX_CALLS = 50;

export interface DevStreamState {
  tree: DevTree | null;
  calls: DevCall[];
  status: string | null;
  connected: boolean;
}

const empty: DevStreamState = { tree: null, calls: [], status: null, connected: false };

const upsertCall = (calls: DevCall[], next: DevCall): DevCall[] => {
  const index = calls.findIndex((c) => c.seq === next.seq);
  const merged =
    index === -1 ? [...calls, next] : calls.map((c) => (c.seq === next.seq ? next : c));
  return merged.length > MAX_CALLS ? merged.slice(merged.length - MAX_CALLS) : merged;
};

export function useDevStream(interviewId: string | null): DevStreamState {
  const [state, setState] = useState<DevStreamState>(empty);
  // Guard against events arriving for a stale interview after a switch.
  const activeId = useRef(interviewId);
  activeId.current = interviewId;

  useEffect(() => {
    if (interviewId === null) {
      setState(empty);
      return;
    }
    setState(empty);
    const close = openDevStream(interviewId, {
      onSnapshot: (snapshot) => {
        setState({ tree: snapshot.tree, calls: snapshot.calls, status: snapshot.status, connected: true });
      },
      onTree: (tree) => {
        setState((s) => ({ ...s, tree }));
      },
      onCallStart: (call) => {
        setState((s) => ({
          ...s,
          calls: upsertCall(s.calls, {
            interviewId,
            seq: call.seq,
            task: call.task,
            ...(call.promptId !== undefined && { promptId: call.promptId }),
            ...(call.questionId !== undefined && { questionId: call.questionId }),
            startedAt: Date.now(),
            status: 'in-flight',
          }),
        }));
      },
      onCallEnd: (call) => {
        setState((s) => ({
          ...s,
          calls: upsertCall(s.calls, {
            interviewId,
            seq: call.seq,
            task: call.task,
            startedAt: s.calls.find((c) => c.seq === call.seq)?.startedAt ?? Date.now(),
            status: 'ok',
            durationMs: call.durationMs,
            output: call.output,
          }),
        }));
      },
      onCallError: (call) => {
        setState((s) => ({
          ...s,
          calls: upsertCall(s.calls, {
            interviewId,
            seq: call.seq,
            task: call.task,
            startedAt: s.calls.find((c) => c.seq === call.seq)?.startedAt ?? Date.now(),
            status: 'error',
            durationMs: call.durationMs,
            errorCode: call.errorCode,
          }),
        }));
      },
      onStatus: (status) => {
        setState((s) => ({ ...s, status }));
      },
      onOpen: () => {
        setState((s) => ({ ...s, connected: true }));
      },
      onDisconnect: () => {
        setState((s) => ({ ...s, connected: false }));
      },
    });
    return close;
  }, [interviewId]);

  return state;
}
