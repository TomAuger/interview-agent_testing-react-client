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
  onRollback: (line: number) => void;
  /** Latest artifact attempt for the interview (original or newest -aN run). */
  onViewArtifact: () => Promise<ArtifactRun>;
  /** Status of one artifact run by run id (used to poll a regeneration). */
  onFetchArtifact: (runId: string) => Promise<ArtifactRun>;
  /** Start a fresh artifact run; resolves to the new run id. */
  onRegenerateArtifact: () => Promise<{ runId: string }>;
}

export function ChatScreen({
  interviewId,
  messages,
  isComplete,
  isLoading,
  error,
  onSubmit,
  onStartOver,
  onRollback,
  onViewArtifact,
  onFetchArtifact,
  onRegenerateArtifact,
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

  const handleRegenerate = async () => {
    setArtifactStatus('checking');
    let runId: string;
    try {
      ({ runId } = await onRegenerateArtifact());
    } catch {
      setArtifactStatus('unreachable');
      return;
    }
    // Poll the new run until it settles; replaces the shown artifact on success.
    for (let i = 0; i < 60; i++) {
      try {
        const run = await onFetchArtifact(runId);
        if (run.status === 'success' && run.markdown !== undefined) {
          setMarkdown(run.markdown);
          setModalOpen(true);
          setArtifactStatus('idle');
          return;
        }
        if (run.status === 'failed') {
          setArtifactStatus('failed');
          return;
        }
      } catch (err) {
        if (!(err instanceof HttpError && err.status === 404)) {
          setArtifactStatus('unreachable');
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    setArtifactStatus('pending');
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
        <MessageList messages={messages} onRollback={onRollback} />
      </div>

      <div className={styles.footer}>
        {isComplete ? (
          <div className={styles.artifactArea}>
            <Group gap="sm">
              <Button onClick={handleViewArtifact} disabled={artifactStatus === 'checking'}>
                View artifact
              </Button>
              <Button
                variant="light"
                onClick={handleRegenerate}
                disabled={artifactStatus === 'checking'}
              >
                Regenerate artifact
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
