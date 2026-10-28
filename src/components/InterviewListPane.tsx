import { Badge, Button, Group, Loader, ScrollArea, Text, UnstyledButton } from '@mantine/core';
import type { InterviewRunSummary } from '../api/client';
import styles from './InterviewListPane.module.css';

interface InterviewListPaneProps {
  interviews: InterviewRunSummary[];
  activeId: string | null;
  isLoading: boolean;
  onSelect: (interviewId: string) => void;
  onNew: () => void;
  onRefresh: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  suspended: 'blue',
  running: 'cyan',
  success: 'green',
  failed: 'red',
  canceled: 'gray',
};

function RunRow({
  run,
  isActive,
  onSelect,
}: {
  run: InterviewRunSummary;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <UnstyledButton
      className={`${styles.row} ${isActive ? styles.active : ''}`}
      onClick={() => onSelect(run.runId)}
    >
      <Text size="xs" ff="monospace" className={styles.runId} title={run.runId}>
        {run.runId}
      </Text>
      <Badge size="xs" variant="light" color={STATUS_COLORS[run.status] ?? 'gray'}>
        {run.status}
      </Badge>
    </UnstyledButton>
  );
}

export function InterviewListPane({
  interviews,
  activeId,
  isLoading,
  onSelect,
  onNew,
  onRefresh,
}: InterviewListPaneProps) {
  return (
    <aside className={styles.pane}>
      <Group justify="space-between" className={styles.header}>
        <Text size="sm" fw={600}>
          Interviews
        </Text>
        <Button variant="subtle" size="compact-xs" onClick={onRefresh} disabled={isLoading}>
          Refresh
        </Button>
      </Group>
      <Button size="compact-sm" variant="light" onClick={onNew} className={styles.newButton}>
        + New interview
      </Button>
      <ScrollArea className={styles.list}>
        {interviews.length === 0 && !isLoading && (
          <Text size="xs" c="dimmed" p="xs">
            No stored interviews yet.
          </Text>
        )}
        {interviews.map((run) => (
          <RunRow key={run.runId} run={run} isActive={run.runId === activeId} onSelect={onSelect} />
        ))}
      </ScrollArea>
      {isLoading && (
        <Group justify="center" py="xs">
          <Loader size="xs" />
        </Group>
      )}
    </aside>
  );
}
