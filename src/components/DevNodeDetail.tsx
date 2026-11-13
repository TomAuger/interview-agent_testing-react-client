/**
 * Detail card for the selected tree node: the intent behind a question, the
 * text actually phrased, the analyst's directive and summary for its turn,
 * corrections (applied and rejected), and the next-question proposal
 * including why a dropped one never materialised. For a criterion: its
 * status, what is known, the quoted evidence and when it was learned.
 */
import { Badge, Code, Group, Text } from '@mantine/core';
import type { DevCriterion, DevQuestion, DevTopic, DevTree } from '../api/dev';
import { CRITERION_LABEL } from './DevCriteria';
import type { DevSelection } from './DevTree';
import styles from './DevPane.module.css';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.detailRow}>
      <Text size="xs" c="dimmed" span>
        {label}:{' '}
      </Text>
      <Text size="xs" span style={{ wordBreak: 'break-word' }}>
        {children}
      </Text>
    </div>
  );
}

function QuestionDetail({ question }: { question: DevQuestion }) {
  return (
    <>
      <Field label="intent">{question.intent}</Field>
      {question.askedText !== undefined && <Field label="asked">{question.askedText}</Field>}
      {question.answerSummary !== undefined && (
        <Field label="summary">{question.answerSummary}</Field>
      )}
      <Group gap="xs" className={styles.detailRow}>
        <Badge size="xs" variant="light" color="gray">
          {question.status}
        </Badge>
        {question.directive !== undefined && (
          <Badge size="xs" variant="light" color="violet">
            directive: {question.directive}
          </Badge>
        )}
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
      </Group>
      {question.nextIntent !== undefined && (
        <Field label="next question proposed">
          {question.nextIntent.intent}
          <Text size="xs" c={question.nextIntent.applied ? 'green' : 'orange'} span>
            {' '}
            {question.nextIntent.applied
              ? '(created)'
              : `(dropped — ${question.nextIntent.droppedReason ?? 'topic closed'})`}
          </Text>
        </Field>
      )}
      {question.corrections.map((c, i) => (
        <Field key={String(i)} label={c.applied ? 'correction' : 'correction rejected'}>
          {c.previousSummary !== undefined && <>&ldquo;{c.previousSummary}&rdquo; → </>}
          &ldquo;{c.proposedSummary}&rdquo; <Text size="xs" c="dimmed" span>— &ldquo;{c.evidence}&rdquo;</Text>
        </Field>
      ))}
      <Field label="id">
        <Code>{question.id}</Code>
      </Field>
    </>
  );
}

function CriterionDetail({ criterion, topic }: { criterion: DevCriterion; topic: DevTopic }) {
  return (
    <>
      <Field label="criterion">{criterion.text}</Field>
      <Field label="topic">{topic.goal}</Field>
      <Group gap="xs" className={styles.detailRow}>
        <Badge size="xs" variant="light" color="gray">
          {CRITERION_LABEL[criterion.status]}
        </Badge>
        {criterion.volunteered && (
          <Badge size="xs" variant="light" color="grape">
            volunteered
          </Badge>
        )}
      </Group>
      {criterion.note !== undefined && <Field label="known">{criterion.note}</Field>}
      {criterion.evidence !== undefined && (
        <Field label="evidence">&ldquo;{criterion.evidence}&rdquo;</Field>
      )}
      {criterion.lastChangedTurn !== undefined && (
        <Field label="learned at turn">{String(criterion.lastChangedTurn)}</Field>
      )}
      <Field label="id">
        <Code>{criterion.id}</Code>
      </Field>
    </>
  );
}

export function DevNodeDetail({
  tree,
  selected,
}: {
  tree: DevTree;
  selected: DevSelection;
}) {
  if (selected === null) return null;
  return (
    <div className={styles.detail}>
      {selected.kind === 'overview' ? (
        <>
          <Field label="overview question">{tree.overview.question}</Field>
          {tree.overview.answerSummary !== undefined && (
            <Field label="summary">{tree.overview.answerSummary}</Field>
          )}
          {tree.overview.directive !== undefined && (
            <Field label="directive">{tree.overview.directive}</Field>
          )}
          <Field label="answered">{tree.overview.answered ? 'yes' : 'no'}</Field>
          {tree.overview.credited.length > 0 && (
            <Field label="credited">
              {tree.topics
                .flatMap((t) => t.criteria)
                .filter((c) => tree.overview.credited.includes(c.id))
                .map((c) => c.text)
                .join('; ')}
            </Field>
          )}
        </>
      ) : selected.kind === 'criterion' ? (
        (() => {
          const topic = tree.topics.find((t) => t.criteria.some((c) => c.id === selected.criterionId));
          const criterion = topic?.criteria.find((c) => c.id === selected.criterionId);
          return topic !== undefined && criterion !== undefined ? (
            <CriterionDetail criterion={criterion} topic={topic} />
          ) : (
            <Text size="xs" c="dimmed">
              Criterion no longer in the tree.
            </Text>
          );
        })()
      ) : (
        (() => {
          const question = tree.topics
            .flatMap((t) => t.questions)
            .find((q) => q.id === selected.questionId);
          return question !== undefined ? (
            <QuestionDetail question={question} />
          ) : (
            <Text size="xs" c="dimmed">
              Question no longer in the tree.
            </Text>
          );
        })()
      )}
    </div>
  );
}
