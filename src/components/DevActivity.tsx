/**
 * The agent-activity panel: the in-flight model call with a live elapsed
 * timer, then recent completed calls, each expandable to the structured
 * output the workflow consumed. This is the "what is the machine doing right
 * now" surface — not a transcript.
 */
import { useEffect, useState } from 'react';
import { Badge, Group, Loader, ScrollArea, Text, UnstyledButton } from '@mantine/core';
import type { DevCall } from '../api/dev';
import styles from './DevPane.module.css';

/** How many recent calls to render. */
const VISIBLE_CALLS = 12;

const TASK_LABEL: Record<DevCall['task'], string> = {
  plan: 'planner',
  analyze: 'analyst',
  phrase: 'phraser',
  judge: 'judge',
  writeArtifact: 'artifact',
  vary: 'varier',
};

const STATUS_COLOR: Record<DevCall['status'], string> = {
  'in-flight': 'cyan',
  ok: 'green',
  error: 'red',
};

const formatMs = (ms: number): string => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${String(Math.round(ms))}ms`);

/** Live elapsed timer for the in-flight call. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return <>{formatMs(now - since)}</>;
}

function CallRow({ call }: { call: DevCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <UnstyledButton className={styles.callRow} onClick={() => setOpen((v) => !v)}>
        <Text size="xs" className={styles.callTask}>
          {open ? '▾' : '▸'} {TASK_LABEL[call.task]}
        </Text>
        {call.status === 'in-flight' ? (
          <>
            <Loader size={10} color="cyan" />
            <Text size="xs" c="cyan">
              <Elapsed since={call.startedAt} />
            </Text>
          </>
        ) : (
          <>
            <Badge size="xs" variant="light" color={STATUS_COLOR[call.status]}>
              {call.status === 'error' ? (call.errorCode ?? 'error') : 'ok'}
            </Badge>
            {call.durationMs !== undefined && (
              <Text size="xs" c="dimmed">
                {formatMs(call.durationMs)}
              </Text>
            )}
          </>
        )}
      </UnstyledButton>
      {open && call.output !== undefined && (
        <pre className={styles.callOutput}>{JSON.stringify(call.output, null, 2)}</pre>
      )}
    </div>
  );
}

export function DevActivity({ calls }: { calls: DevCall[] }) {
  const inFlight = calls.find((c) => c.status === 'in-flight');
  const recent = calls.slice(-VISIBLE_CALLS).reverse();
  return (
    <div className={styles.activity}>
      <Group justify="space-between" className={styles.activityHeader}>
        <Text size="xs" fw={600}>
          Agent activity
        </Text>
        {inFlight !== undefined && (
          <Text size="xs" c="cyan">
            {TASK_LABEL[inFlight.task]} running…
          </Text>
        )}
      </Group>
      <ScrollArea className={styles.activityList}>
        {recent.length === 0 && (
          <Text size="xs" c="dimmed" fs="italic">
            No model calls recorded yet — calls appear while the stream is connected.
          </Text>
        )}
        {recent.map((call) => (
          <CallRow key={call.seq} call={call} />
        ))}
      </ScrollArea>
    </div>
  );
}
