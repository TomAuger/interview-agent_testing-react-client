import { useEffect, useState } from 'react';
import { Button, Group, Paper, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { listProfiles } from '../api/client';
import styles from './StartScreen.module.css';

interface StartScreenProps {
  /** Pre-fills the input (e.g. the id that failed to join). */
  initialId: string;
  isLoading: boolean;
  onStart: (interviewId: string, profileId?: string) => void;
}

export function StartScreen({ initialId, isLoading, onStart }: StartScreenProps) {
  const [interviewId, setInterviewId] = useState(initialId);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const trimmed = interviewId.trim();

  useEffect(() => {
    let cancelled = false;
    listProfiles()
      .then((ids) => {
        if (cancelled) return;
        setProfiles(ids);
        setProfileId(ids[0] ?? null);
      })
      .catch(() => {
        // Server unreachable or route missing — hide the picker and let the
        // server apply its default profile on start.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <Paper className={styles.card} withBorder shadow="sm" p="xl" radius="md">
        <Stack gap="md">
          <Title order={2}>Interview</Title>
          <Text size="sm" c="dimmed">
            Enter an existing interview id to resume it, or generate a new id to start a fresh
            interview.
          </Text>
          {profiles.length > 0 && (
            <Select
              label="Interview type"
              description="Only applies when starting a new interview — an existing id resumes whatever type it was created with."
              data={profiles}
              value={profileId}
              onChange={setProfileId}
              allowDeselect={false}
              disabled={isLoading}
            />
          )}
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
            <Button
              onClick={() => onStart(trimmed, profileId ?? undefined)}
              disabled={trimmed === '' || isLoading}
            >
              Start / Resume
            </Button>
          </Group>
        </Stack>
      </Paper>
    </div>
  );
}
