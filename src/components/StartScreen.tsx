import { useState } from 'react';
import { Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import styles from './StartScreen.module.css';

interface StartScreenProps {
  /** Pre-fills the input (e.g. the id that failed to join). */
  initialId: string;
  isLoading: boolean;
  onStart: (interviewId: string) => void;
}

export function StartScreen({ initialId, isLoading, onStart }: StartScreenProps) {
  const [interviewId, setInterviewId] = useState(initialId);
  const trimmed = interviewId.trim();

  return (
    <div className={styles.wrap}>
      <Paper className={styles.card} withBorder shadow="sm" p="xl" radius="md">
        <Stack gap="md">
          <Title order={2}>Interview</Title>
          <Text size="sm" c="dimmed">
            Enter an existing interview id to resume it, or generate a new id to start a fresh
            interview.
          </Text>
          <TextInput
            label="Interview id"
            placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
            value={interviewId}
            onChange={(event) => setInterviewId(event.currentTarget.value)}
            disabled={isLoading}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setInterviewId(crypto.randomUUID())}
              disabled={isLoading}
            >
              Generate new ID
            </Button>
            <Button onClick={() => onStart(trimmed)} disabled={trimmed === '' || isLoading}>
              Start / Resume
            </Button>
          </Group>
        </Stack>
      </Paper>
    </div>
  );
}
