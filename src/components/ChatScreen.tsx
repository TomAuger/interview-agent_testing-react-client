import { useState } from 'react';
import { Alert, Button, Group, Loader, Text } from '@mantine/core';
import type { ArtifactRun } from '../api/client';
import { HttpError } from '../api/client';
import type { Message } from '../types';
import { ArtifactModal } from './ArtifactModal';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import styles from './ChatScreen.module.css';

type ArtifactStatus = 'idle' | 'checking' | 'pending' | 'failed' | 'unreachable';

interface ChatScreenProps {
  interviewId: string;
  messages: Message[];
  isComplete: boolean;
  isLoading: boolean;
  error: string | null;
  onSubmit: (text: string) => void;
  onStartOver: () => void;
  onViewArtifact: () => Promise<ArtifactRun>;
}

export function ChatScreen({
  interviewId,
  messages,
  isComplete,
  isLoading,
  error,
  onSubmit,
  onStartOver,
  onViewArtifact,
}: ChatScreenProps) {
  const [artifactStatus, setArtifactStatus] = useState<ArtifactStatus>('idle');
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleViewArtifact = async () => {
    setArtifactStatus('checking');
    try {
      const run = await onViewArtifact();
      if (run.status === 'success' && run.markdown !== undefined) {
        setMarkdown(run.markdown);
        setModalOpen(true);
        setArtifactStatus('idle');
      } else if (run.status === 'failed') {
        setArtifactStatus('failed');
      } else {
        setArtifactStatus('pending');
      }
    } catch (err) {
      // A 404 means the artifact run has not been created yet — the interview
      // only just completed — so it reads as "still generating".
      setArtifactStatus(err instanceof HttpError && err.status === 404 ? 'pending' : 'unreachable');
    }
  };

  return (
    <div className={styles.layout}>
      <Group justify="space-between" className={styles.topbar}>
        <Text size="sm" c="dimmed" className={styles.interviewId}>
          Interview: {interviewId}
        </Text>
        <Button variant="subtle" color="red" size="compact-sm" onClick={onStartOver}>
          Start over
        </Button>
      </Group>

      {error !== null && (
        <Alert color="red" variant="light" className={styles.errorAlert}>
          {error}
        </Alert>
      )}

      <div className={styles.scroll}>
        <MessageList messages={messages} />
      </div>

      <div className={styles.footer}>
        {isComplete ? (
          <div className={styles.artifactArea}>
            <Group gap="sm">
              <Button onClick={handleViewArtifact} disabled={artifactStatus === 'checking'}>
                View artifact
              </Button>
              {artifactStatus === 'checking' && <Loader size="sm" />}
            </Group>
            {artifactStatus === 'pending' && (
              <Text size="sm" c="dimmed" className={styles.artifactStatus}>
                Artifact is still being generated&hellip; Click again in a few seconds.
              </Text>
            )}
            {artifactStatus === 'failed' && (
              <Text size="sm" c="red" className={styles.artifactStatus}>
                Artifact generation failed. Run id: {interviewId}
              </Text>
            )}
            {artifactStatus === 'unreachable' && (
              <Text size="sm" c="red" className={styles.artifactStatus}>
                Unable to reach the interview server to check artifact status.
              </Text>
            )}
          </div>
        ) : (
          <MessageInput isLoading={isLoading} onSubmit={onSubmit} />
        )}
      </div>

      <ArtifactModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        markdown={markdown ?? ''}
      />
    </div>
  );
}
