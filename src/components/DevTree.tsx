/**
 * The interview ledger rendered as a tree: overview node, profile topics
 * (collapsible, ordered as seeded) each with its understanding verdict,
 * criteria checklist and questions, plus dashed "ghost" rows for proposals
 * the model made that never reached the ledger.
 */
import { useState } from 'react';
import { Badge, Text, UnstyledButton } from '@mantine/core';
import type { DevGhost, DevQuestion, DevTopic, DevTopicVerdict, DevTree } from '../api/dev';
import { CriteriaBar, CriteriaList } from './DevCriteria';
import styles from './DevPane.module.css';

/** What the pane treats as selectable. */
export type DevSelection =
  | { kind: 'overview' }
  | { kind: 'question'; questionId: string }
  | { kind: 'criterion'; criterionId: string }
  | null;

const VERDICT_COLOR: Record<DevTopicVerdict, string> = {
  queued: 'gray',
  open: 'blue',
  confirming: 'grape',
  satisfied: 'green',
  exhausted: 'orange',
  skipped: 'teal',
};

const VERDICT_HELP: Record<DevTopicVerdict, string> = {
  queued: 'not reached yet',
  open: 'still asking',
  confirming: 'confirming what was said earlier',
  satisfied: 'understood well enough for its rigour',
  exhausted: 'moved on: allowance spent or no progress',
  skipped: 'already understood from earlier answers, nothing asked',
};

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
        {ghost.kind === 'next-intent-dropped' ? '↳ ' : '⚠ '}
        {ghost.intent}
      </Text>
      <Text size="xs" c="dimmed" fs="italic" style={{ flex: 'none' }} title={ghost.reason}>
        {ghost.kind === 'next-intent-dropped' ? 'dropped' : 'rejected'}
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
      {question.kind === 'confirm' && (
        <Badge size="xs" variant="outline" color="grape">
          confirm
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
  latestTurn,
  narrow,
  selected,
  onSelect,
}: {
  topic: DevTopic;
  ghosts: DevGhost[];
  pendingQuestionId: string | null;
  /** The ledger's turn count, to highlight criteria changed by the latest turn. */
  latestTurn: number;
  /** Hide the criteria bar and rigour at tight pane widths. */
  narrow: boolean;
  selected: DevSelection;
  onSelect: (sel: DevSelection) => void;
}) {
  const [open, setOpen] = useState(true);
  const { resolved, total } = topic.satisfaction;

  const roots = topic.questions.filter((q) => q.followUpOf === undefined);
  const childrenOf = (id: string) =>
    topic.questions.filter((q) => q.followUpOf === id);
  const topicGhosts = ghosts.filter(
    (g) => g.topicId === topic.id && g.parentQuestionId === undefined,
  );
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
          {topic.goal}
        </Text>
        <Badge
          size="xs"
          variant={topic.current ? 'filled' : 'light'}
          color={VERDICT_COLOR[topic.verdict]}
          title={VERDICT_HELP[topic.verdict]}
        >
          {topic.verdict}
        </Badge>
        {!narrow && (
          <Text size="xs" c="dimmed" className={styles.verdictMeta} title="rigour · turns used / allowance">
            {topic.rigour} · {topic.turnsUsed}/{topic.allowance}
          </Text>
        )}
        {narrow ? (
          <Text size="xs" c="dimmed" style={{ flex: 'none' }}>
            {resolved}/{total}
          </Text>
        ) : (
          <div title={`${String(resolved)} of ${String(total)} criteria resolved`}>
            <CriteriaBar criteria={topic.criteria} />
          </div>
        )}
      </UnstyledButton>
      {open && (
        <>
          <CriteriaList
            criteria={topic.criteria}
            latestTurn={latestTurn}
            selected={selected}
            onSelect={onSelect}
          />
          {topic.stallStreak > 0 && topic.verdict === 'open' && (
            <Text size="xs" c="orange" pl={18} fs="italic">
              no progress for {topic.stallStreak} turn{topic.stallStreak === 1 ? '' : 's'}
            </Text>
          )}
          {roots.map((q) => renderQuestion(q, 0))}
          {topicGhosts.map((g, i) => (
            <GhostRow key={`tghost-${String(i)}`} ghost={g} />
          ))}
          {topic.counts.planned === 0 && topicGhosts.length === 0 && (
            <Text size="xs" c="dimmed" pl={18} fs="italic">
              {topic.verdict === 'queued' ? 'not reached yet' : 'no questions asked'}
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
        {tree.overview.credited.length > 0 && (
          <Badge size="xs" variant="light" color="grape" title="criteria credited by the overview answer">
            +{tree.overview.credited.length} credited
          </Badge>
        )}
        <Badge size="xs" variant="outline" color="gray">
          overview
        </Badge>
      </UnstyledButton>
      {tree.ghosts
        .filter((g) => g.topicId === '')
        .map((g, i) => (
          <GhostRow key={`unscoped-${String(i)}`} ghost={g} />
        ))}

      {tree.topics.map((topic) => (
        <TopicSection
          key={topic.id}
          topic={topic}
          ghosts={tree.ghosts}
          pendingQuestionId={tree.pending?.questionId ?? null}
          latestTurn={tree.turnsUsed}
          narrow={narrow}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
