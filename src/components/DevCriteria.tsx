/**
 * A topic's "understood" checklist: one row per criterion with its status,
 * a marker when it was volunteered earlier in the interview, and a highlight
 * when the latest turn changed it. Also exports the segmented bar that
 * summarises a checklist in a topic header.
 */
import { Badge, Text, UnstyledButton } from '@mantine/core';
import type { DevCriterion, DevCriterionStatus } from '../api/dev';
import type { DevSelection } from './DevTree';
import styles from './DevPane.module.css';

export const CRITERION_GLYPH: Record<DevCriterionStatus, string> = {
  unknown: '○',
  vague: '◐',
  clear: '●',
  declined: '⊘',
};

export const CRITERION_LABEL: Record<DevCriterionStatus, string> = {
  unknown: 'unknown',
  vague: 'vague',
  clear: 'clear',
  declined: 'declined',
};

const CRITERION_CLASS: Record<DevCriterionStatus, string | undefined> = {
  unknown: styles.critUnknown,
  vague: styles.critVague,
  clear: styles.critClear,
  declined: styles.critDeclined,
};

/** One segment per criterion, coloured by status. */
export function CriteriaBar({ criteria }: { criteria: DevCriterion[] }) {
  return (
    <div className={styles.critBar} aria-hidden>
      {criteria.map((c) => (
        <span key={c.id} className={`${styles.critSeg} ${CRITERION_CLASS[c.status] ?? ''}`} />
      ))}
    </div>
  );
}

export function CriteriaList({
  criteria,
  latestTurn,
  selected,
  onSelect,
}: {
  criteria: DevCriterion[];
  /** The ledger's turn count, to highlight criteria changed by the latest turn. */
  latestTurn: number;
  selected: DevSelection;
  onSelect: (sel: DevSelection) => void;
}) {
  return (
    <>
      {criteria.map((c) => (
        <UnstyledButton
          key={c.id}
          className={`${styles.questionRow} ${
            selected?.kind === 'criterion' && selected.criterionId === c.id ? styles.selected : ''
          }`}
          onClick={() => onSelect({ kind: 'criterion', criterionId: c.id })}
          title={`${CRITERION_LABEL[c.status]}${c.note !== undefined ? ` — ${c.note}` : ''}`}
        >
          <span className={`${styles.critGlyph} ${CRITERION_CLASS[c.status] ?? ''}`}>
            {CRITERION_GLYPH[c.status]}
          </span>
          <Text
            size="xs"
            className={styles.intent}
            {...(c.status === 'unknown' ? { c: 'dimmed' } : {})}
          >
            {c.text}
          </Text>
          {c.volunteered && (
            <Badge size="xs" variant="light" color="grape">
              volunteered
            </Badge>
          )}
          {c.lastChangedTurn === latestTurn && latestTurn > 0 && (
            <Badge size="xs" variant="filled" color="cyan">
              new
            </Badge>
          )}
        </UnstyledButton>
      ))}
    </>
  );
}
