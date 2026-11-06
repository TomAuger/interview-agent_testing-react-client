/**
 * Detail card for the selected tree node: the intent behind a question, the
 * text actually phrased, the analyst's directive and summary for its turn,
 * corrections (applied and rejected), and the follow-up proposal including
 * why a dropped one never materialised.
 */
import { Badge, Code, Group, Text } from '@mantine/core';
import type { DevQuestion, DevTree } from '../api/dev';
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
      </Group>
      {question.followUpIntent !== undefined && (
        <Field label="follow-up proposed">
          {question.followUpIntent.intent}
          <Text size="xs" c={question.followUpIntent.applied ? 'green' : 'orange'} span>
            {' '}
            {question.followUpIntent.applied
              ? '(created)'
              : `(dropped — ${question.followUpIntent.droppedReason ?? 'bound'})`}
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
        </>
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
