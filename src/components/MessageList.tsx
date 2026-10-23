import { useEffect, useRef } from 'react';
import { Alert, List, Text } from '@mantine/core';
import type { Message } from '../types';
import styles from './MessageList.module.css';

function MessageBubble({ message }: { message: Message }) {
  switch (message.role) {
    case 'bot':
      return <div className={`${styles.message} ${styles.bot}`}>{message.text}</div>;
    case 'human':
      return <div className={`${styles.message} ${styles.human}`}>{message.text}</div>;
    case 'error':
      return (
        <Alert color="red" variant="light" className={styles.error}>
          {message.text}
          {message.code !== undefined && (
            <Text size="xs" c="dimmed" mt={4}>
              {message.code}
            </Text>
          )}
        </Alert>
      );
    case 'completion':
      return (
        <div className={styles.completion}>
          <Text fw={600}>{message.closing}</Text>
          {message.gaps.length > 0 ? (
            <>
              <Text size="sm" c="dimmed" mt="xs">
                Gaps the interview left:
              </Text>
              <List size="sm" mt={4}>
                {message.gaps.map((gap) => (
                  <List.Item key={gap}>{gap}</List.Item>
                ))}
              </List>
            </>
          ) : (
            <Text size="sm" c="dimmed" mt="xs">
              No gaps reported.
            </Text>
          )}
        </div>
      );
  }
}

export function MessageList({ messages }: { messages: Message[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className={styles.list} aria-live="polite">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
