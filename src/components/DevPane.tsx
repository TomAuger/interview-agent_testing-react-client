/**
 * The developer inspector pane: a live view of the interview's internal
 * ledger — topic/question tree, follow-ups (created and dropped),
 * corrections, progress — streamed over the dev SSE channel, plus the
 * agent-activity panel. Rendered only in dev builds (`import.meta.env.DEV`)
 * for the local test client; never for production.
 */
import { useState } from 'react';
import { Badge, Group, Progress, ScrollArea, Text, UnstyledButton } from '@mantine/core';
import { useDevStream } from '../hooks/useDevStream';
import { DevActivity } from './DevActivity';
import { DevNodeDetail } from './DevNodeDetail';
import { DevTree } from './DevTree';
import type { DevSelection } from './DevTree';
import styles from './DevPane.module.css';

const PHASE_COLOR: Record<string, string> = {
  overview: 'cyan',
  topics: 'blue',
  closed: 'gray',
};

const skippedCount = (tree: { topics: { counts: { skipped: number } }[] }): number =>
  tree.topics.reduce((n, t) => n + t.counts.skipped, 0);

export function DevPane({
  interviewId,
  width,
}: {
  interviewId: string | null;
  /** Pane width in px, controlled by the resizable-layout parent. */
  width: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState<DevSelection>(null);
  const { tree, calls, status, connected } = useDevStream(interviewId);

  if (collapsed) {
    return (
      <aside className={`${styles.pane} ${styles.paneCollapsed}`}>
        <UnstyledButton
          className={styles.collapseButton}
          onClick={() => setCollapsed(false)}
          title="Expand inspector"
        >
          <Text size="xs" c="dimmed">
            ◂ inspector
          </Text>
        </UnstyledButton>
      </aside>
    );
  }

  const answeredCount =
    tree?.topics.reduce((n, t) => n + t.counts.answered, 0) ?? 0;
  const plannedCount = tree?.topics.reduce((n, t) => n + t.counts.planned, 0) ?? 0;
  const requiredCount = tree?.topics.filter((t) => t.required).length ?? 0;
  const coveredCount = tree?.coverage.covered.length ?? 0;
  const overallPct =
    tree === null || plannedCount === 0
      ? 0
      : ((answeredCount + skippedCount(tree)) / plannedCount) * 100;

  return (
    <aside className={styles.pane} style={{ width }}>
      <div className={styles.header}>
        <Group justify="space-between">
          <Group gap="xs">
            <Text size="sm" fw={600}>
              Inspector
            </Text>
            <span
              className={`${styles.dot} ${connected ? styles.dotLive : styles.dotStale}`}
              title={connected ? 'stream connected' : 'stream reconnecting'}
            />
          </Group>
          <Group gap={4}>
            {tree !== null && (
              <Badge size="xs" variant="light" color={PHASE_COLOR[tree.phase] ?? 'gray'}>
                {tree.phase}
              </Badge>
            )}
            {status !== null && (
              <Badge size="xs" variant="outline" color="gray">
                {status}
              </Badge>
            )}
            <UnstyledButton onClick={() => setCollapsed(true)} title="Collapse inspector">
              <Text size="xs" c="dimmed">
                ▸
              </Text>
            </UnstyledButton>
          </Group>
        </Group>
      </div>

      {interviewId === null || tree === null ? (
        <Text size="xs" c="dimmed" className={styles.empty} fs="italic">
          {interviewId === null
            ? 'No interview selected.'
            : connected
              ? 'Waiting for tree…'
              : 'Connecting…'}
        </Text>
      ) : (
        <>
          <div className={styles.summary}>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed">
                turns {tree.turnsUsed}/{tree.maxTurns}
              </Text>
              <Text size="xs" c="dimmed">
                {answeredCount} answered · {plannedCount} planned
              </Text>
              <Text size="xs" c="dimmed">
                required {coveredCount}/{requiredCount}
              </Text>
            </Group>
            <Progress size="sm" value={overallPct} color="green" />
          </div>

          <ScrollArea className={styles.scroll}>
            <DevTree
              tree={tree}
              narrow={width < 340}
              selected={selected}
              onSelect={setSelected}
            />
            {selected !== null && <DevNodeDetail tree={tree} selected={selected} />}
            {tree.completion !== null && (
              <div className={styles.detail}>
                <Group gap="xs" className={styles.detailRow}>
                  <Badge size="xs" variant="light" color="gray">
                    {tree.completion.reason}
                  </Badge>
                  <Badge
                    size="xs"
                    variant="light"
                    color={tree.completion.definitionOfDoneMet ? 'green' : 'orange'}
                  >
                    {tree.completion.definitionOfDoneMet ? 'done' : 'gaps remain'}
                  </Badge>
                </Group>
                {tree.completion.gaps.map((gap, i) => (
                  <Text key={String(i)} size="xs" c="dimmed">
                    · {gap}
                  </Text>
                ))}
              </div>
            )}
          </ScrollArea>

          <DevActivity calls={calls} />
        </>
      )}
    </aside>
  );
}
