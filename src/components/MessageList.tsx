import { useEffect, useRef, useState } from 'react';
import { Alert, List, Paper, Text, UnstyledButton } from '@mantine/core';
import { useClickOutside } from '@mantine/hooks';
import type { Message } from '../types';
import { SpeakButton, speakText } from './SpeakButton';
import styles from './MessageList.module.css';

interface MenuState {
  x: number;
  y: number;
  line: number | undefined;
  text: string;
}

interface MessageListProps {
  messages: Message[];
  onRollback: (line: number) => void;
}

function LineTag({ line }: { line: number }) {
  return <span className={styles.lineTag}>#{line}</span>;
}

function TurnMenu({
  menu,
  onSpeak,
  onSelect,
  onClose,
}: {
  menu: MenuState;
  onSpeak: () => void;
  onSelect: () => void;
  onClose: () => void;
}) {
  const ref = useClickOutside(onClose);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Paper
      ref={ref}
      className={styles.menu}
      style={{ left: menu.x, top: menu.y }}
      shadow="md"
      withBorder
    >
      <UnstyledButton className={styles.menuItem} onClick={onSpeak}>
        Speak this
      </UnstyledButton>
      {menu.line !== undefined && (
        <UnstyledButton className={styles.menuItem} onClick={onSelect}>
          Roll back to this turn
        </UnstyledButton>
      )}
    </Paper>
  );
}

function MessageBubble({
  message,
  onMenu,
  onSpeechError,
}: {
  message: Message;
  onMenu: (state: MenuState) => void;
  onSpeechError: (message: string) => void;
}) {
  switch (message.role) {
    case 'bot':
      return (
        <div
          className={`${styles.message} ${styles.bot}`}
          title="Click for options"
          onClick={(event) => {
            // Don't hijack clicks where the user is selecting text to copy.
            if (window.getSelection()?.toString() !== '') return;
            onMenu({
              x: event.clientX,
              y: event.clientY,
              line: message.line,
              text: message.text,
            });
          }}
        >
          {message.line !== undefined && <LineTag line={message.line} />}
          {message.text}
          <SpeakButton
            className={styles.speakBtn}
            text={message.text}
            onError={onSpeechError}
          />
        </div>
      );
    case 'human':
      return (
        <div className={`${styles.message} ${styles.human}`}>{message.text}</div>
      );
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

export function MessageList({ messages, onRollback }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const hydratedOnce = useRef(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    // First populated render (hydration after remount): jump straight to the
    // last turn; later turns scroll smoothly.
    endRef.current?.scrollIntoView({ behavior: hydratedOnce.current ? 'smooth' : 'auto' });
    hydratedOnce.current = true;
  }, [messages.length]);

  return (
    <div className={styles.list} aria-live="polite">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onMenu={setMenu}
          onSpeechError={setSpeechError}
        />
      ))}
      {speechError !== null && (
        <Alert
          color="red"
          variant="light"
          className={styles.error}
          withCloseButton
          onClose={() => setSpeechError(null)}
        >
          {speechError}
        </Alert>
      )}
      <div ref={endRef} />
      {menu !== null && (
        <TurnMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onSpeak={() => {
            setMenu(null);
            speakText(menu.text, setSpeechError);
          }}
          onSelect={() => {
            setMenu(null);
            if (menu.line !== undefined) {
              onRollback(menu.line);
            }
          }}
        />
      )}
    </div>
  );
}
