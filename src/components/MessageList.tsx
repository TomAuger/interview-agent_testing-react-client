import { useEffect, useRef, useState } from 'react';
import { Alert, List, Paper, Text, UnstyledButton } from '@mantine/core';
import { useClickOutside } from '@mantine/hooks';
import type { Message } from '../types';
import styles from './MessageList.module.css';

interface MenuState {
  x: number;
  y: number;
  line: number;
}

interface MessageListProps {
  messages: Message[];
  onRollback: (line: number) => void;
}

function LineTag({ line, onMenu }: { line: number; onMenu: (state: MenuState) => void }) {
  return (
    <span
      className={styles.lineTag}
      title={`Turn #${line} — right-click to roll back`}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu({ x: event.clientX, y: event.clientY, line });
      }}
    >
      #{line}
    </span>
  );
}

function RollbackMenu({
  menu,
  onSelect,
  onClose,
}: {
  menu: MenuState;
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
      <UnstyledButton className={styles.menuItem} onClick={onSelect}>
        Roll back to this turn
      </UnstyledButton>
    </Paper>
  );
}

function MessageBubble({
  message,
  onMenu,
}: {
  message: Message;
  onMenu: (state: MenuState) => void;
}) {
  switch (message.role) {
    case 'bot':
      return (
        <div className={`${styles.message} ${styles.bot}`}>
          {message.line !== undefined && <LineTag line={message.line} onMenu={onMenu} />}
          {message.text}
        </div>
      );
    case 'human':
      return (
        <div className={`${styles.message} ${styles.human}`}>
          {message.line !== undefined && <LineTag line={message.line} onMenu={onMenu} />}
          {message.text}
        </div>
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
        <MessageBubble key={message.id} message={message} onMenu={setMenu} />
      ))}
      <div ref={endRef} />
      {menu !== null && (
        <RollbackMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onSelect={() => {
            setMenu(null);
            onRollback(menu.line);
          }}
        />
      )}
    </div>
  );
}
