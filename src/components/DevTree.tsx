/**
 * The interview ledger rendered as a tree: overview node, profile topics
 * (collapsible, ordered as seeded) with their planned and follow-up
 * questions, plus dashed "ghost" rows for proposals the model made that
 * never reached the ledger.
 */
import { useState } from 'react';
import { Badge, Progress, Text, UnstyledButton } from '@mantine/core';
import type { DevGhost, DevQuestion, DevTopic, DevTree } from '../api/dev';
import styles from './DevPane.module.css';

/** What the pane treats as selectable. */
export type DevSelection =
  | { kind: 'overview' }
  | { kind: 'question'; questionId: string }
  | null;

const STATUS_CLASS: Record<DevQuestion['status'], string | undefined> = {
  pending: styles.statusPending,
  asked: styles.statusAsked,
  answered: styles.statusAnswered,
  skipped: styles.statusSkipped,
};

const STATUS_LABEL: Record<DevQuestion['status'], string> = {
  pending: 'pending',
  asked: 'asking now',
  answered: 'answered',
  skipped: 'skipped',
};

function GhostRow({ ghost }: { ghost: DevGhost }) {
  return (
    <div className={styles.ghostRow}>
      <Text size="xs" c="dimmed" fs="italic" className={styles.intent}>
        {ghost.kind === 'followup-dropped' ? '↳ ' : '◇ '}
        {ghost.intent}
      </Text>
      <Text size="xs" c="dimmed" fs="italic" style={{ flex: 'none' }}>
        {ghost.kind === 'followup-dropped' ? 'dropped' : ghost.kind === 'planned-trimmed' ? 'trimmed' : 'no topic'}
      </Text>
    </div>
  );
}

function QuestionRow({
  question,
  depth,
  isPending,
  isSelected,
  onSelect,
}: {
  question: DevQuestion;
  depth: number;
  isPending: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <UnstyledButton
      className={`${styles.questionRow} ${depth > 0 ? styles.followUpRow : ''} ${
        isSelected ? styles.selected : ''
      }`}
      onClick={onSelect}
      title={STATUS_LABEL[question.status]}
    >
      <span className={`${styles.statusDot} ${STATUS_CLASS[question.status]}`} />
      {question.followUpOf !== undefined && (
        <span className={styles.followUpGlyph}>↳</span>
      )}
      <Text
        size="xs"
        className={`${styles.intent} ${question.status === 'skipped' ? styles.skippedText : ''}`}
      >
        {question.intent}
      </Text>
      {question.followUpOf !== undefined && (
        <Badge size="xs" variant="outline" color="grape">
          follow-up
        </Badge>
      )}
      {isPending && (
        <Badge size="xs" variant="filled" color="blue">
          asked
        </Badge>
      )}
    </UnstyledButton>
  );
}

function TopicSection({
  topic,
  ghosts,
  pendingQuestionId,
  narrow,
  selected,
  onSelect,
}: {
  topic: DevTopic;
  ghosts: DevGhost[];
  pendingQuestionId: string | null;
  /** Hide the mini progress bar at tight pane widths. */
  narrow: boolean;
  selected: DevSelection;
  onSelect: (sel: DevSelection) => void;
}) {
  const [open, setOpen] = useState(true);
  const done = topic.counts.answered + topic.counts.skipped;
  const pct = topic.counts.planned === 0 ? 0 : (done / topic.counts.planned) * 100;

  const roots = topic.questions.filter((q) => q.followUpOf === undefined);
  const childrenOf = (id: string) =>
    topic.questions.filter((q) => q.followUpOf === id);
  const topicGhosts = ghosts.filter((g) => g.topicId === topic.id && g.parentQuestionId === undefined);
  const ghostChildrenOf = (id: string) =>
    ghosts.filter((g) => g.topicId === topic.id && g.parentQuestionId === id);

  const renderQuestion = (q: DevQuestion, depth: number): React.ReactNode => (
    <div key={q.id}>
      <QuestionRow
        question={q}
        depth={depth}
        isPending={q.id === pendingQuestionId}
        isSelected={selected?.kind === 'question' && selected.questionId === q.id}
        onSelect={() => onSelect({ kind: 'question', questionId: q.id })}
      />
      {childrenOf(q.id).map((child) => renderQuestion(child, depth + 1))}
      {ghostChildrenOf(q.id).map((g, i) => (
        <GhostRow key={`ghost-${String(i)}`} ghost={g} />
      ))}
    </div>
  );

  return (
    <div>
      <UnstyledButton className={styles.topicHeader} onClick={() => setOpen((v) => !v)}>
        <Text size="xs" className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
          ▶
        </Text>
        <Text size="xs" fw={600} className={styles.topicTitle} truncate>
          {topic.title}
        </Text>
        {topic.required && (
          <Badge size="xs" variant="outline" color={topic.covered ? 'green' : 'orange'}>
            {topic.covered ? 'covered' : 'required'}
          </Badge>
        )}
        {narrow ? (
          <Text size="xs" c="dimmed" style={{ flex: 'none' }}>
            {done}/{topic.counts.planned}
          </Text>
        ) : (
          <div className={styles.topicProgress}>
            <Progress
              size="sm"
              value={pct}
              color={topic.covered ? 'green' : 'blue'}
              aria-label={`${String(done)} of ${String(topic.counts.planned)} done`}
            />
          </div>
        )}
      </UnstyledButton>
      {open && (
        <>
          {roots.map((q) => renderQuestion(q, 0))}
          {topicGhosts.map((g, i) => (
            <GhostRow key={`tghost-${String(i)}`} ghost={g} />
          ))}
          {topic.counts.planned === 0 && topicGhosts.length === 0 && (
            <Text size="xs" c="dimmed" pl={18} fs="italic">
              no questions yet
            </Text>
          )}
        </>
      )}
    </div>
  );
}

export function DevTree({
  tree,
  narrow = false,
  selected,
  onSelect,
}: {
  tree: DevTree;
  /** Compact mode for tight pane widths. */
  narrow?: boolean;
  selected: DevSelection;
  onSelect: (sel: DevSelection) => void;
}) {
  return (
    <div>
      {/* Overview node */}
      <UnstyledButton
        className={`${styles.questionRow} ${selected?.kind === 'overview' ? styles.selected : ''}`}
        style={{ paddingLeft: 2 }}
        onClick={() => onSelect({ kind: 'overview' })}
      >
        <span
          className={`${styles.statusDot} ${
            tree.overview.answered ? styles.statusAnswered : styles.statusAsked
          }`}
        />
        <Text size="xs" className={styles.intent} fw={500}>
          {tree.overview.question}
        </Text>
        <Badge size="xs" variant="outline" color="gray">
          overview
        </Badge>
      </UnstyledButton>

      {tree.topics.map((topic) => (
        <TopicSection
          key={topic.id}
          topic={topic}
          ghosts={tree.ghosts}
          pendingQuestionId={tree.pending?.questionId ?? null}
          narrow={narrow}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
