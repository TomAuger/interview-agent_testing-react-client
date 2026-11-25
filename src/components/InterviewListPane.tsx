import {
  Badge,
  Button,
  Group,
  HoverCard,
  Loader,
  ScrollArea,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import type { InterviewRunSummary } from '../api/client';
import { CopyIcon } from './icons';
import styles from './InterviewListPane.module.css';

interface InterviewListPaneProps {
  interviews: InterviewRunSummary[];
  activeId: string | null;
  isLoading: boolean;
  /** Pane width in px, controlled by the resizable-layout parent. */
  width: number;
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

/** Row label: `<Type>: <generated title>`, or `<Type>: <id>` until one exists. */
const rowLabel = (run: InterviewRunSummary): string =>
  `${run.typeLabel}: ${run.title ?? run.interviewId}`;

/** Hover-card content: `<title> · <id>`, or just the id while untitled. */
const cardLabel = (run: InterviewRunSummary): string =>
  run.title === null ? run.interviewId : `${run.title} · ${run.interviewId}`;

function RunRow({
  run,
  isActive,
  onSelect,
}: {
  run: InterviewRunSummary;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const clipboard = useClipboard();
  const copyId = (): void => {
    clipboard.copy(run.interviewId);
    notifications.show({ message: 'Interview ID copied' });
  };
  return (
    <HoverCard openDelay={200} closeDelay={300} position="bottom-start" offset={-10} withinPortal>
      <HoverCard.Target>
        <UnstyledButton
          className={`${styles.row} ${isActive ? styles.active : ''}`}
          onClick={() => onSelect(run.interviewId)}
        >
          <Text size="xs" className={styles.runId}>
            {rowLabel(run)}
          </Text>
          <Badge size="xs" variant="light" color={STATUS_COLORS[run.status] ?? 'gray'}>
            {run.status}
          </Badge>
        </UnstyledButton>
      </HoverCard.Target>
      <HoverCard.Dropdown className={styles.dropdown}>
        <UnstyledButton className={styles.copyButton} onClick={copyId} title="Click to copy">
          <Text size="xs" ff="monospace">
            {cardLabel(run)}
          </Text>
          <span className={styles.copyIcon}>
            <CopyIcon />
          </span>
        </UnstyledButton>
      </HoverCard.Dropdown>
    </HoverCard>
  );
}

export function InterviewListPane({
  interviews,
  activeId,
  isLoading,
  width,
  onSelect,
  onNew,
  onRefresh,
}: InterviewListPaneProps) {
  return (
    <aside className={styles.pane} style={{ width }}>
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
          <RunRow
            key={run.interviewId}
            run={run}
            isActive={run.interviewId === activeId}
            onSelect={onSelect}
          />
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
