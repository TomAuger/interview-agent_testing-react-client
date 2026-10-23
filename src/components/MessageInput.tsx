import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button, Loader, Textarea } from '@mantine/core';
import styles from './MessageInput.module.css';

interface MessageInputProps {
  isLoading: boolean;
  onSubmit: (text: string) => void;
}

export function MessageInput({ isLoading, onSubmit }: MessageInputProps) {
  const [value, setValue] = useState('');
  const canSubmit = value.trim().length > 0 && !isLoading;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(value);
    setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.row}>
      <Textarea
        className={styles.input}
        autosize
        minRows={3}
        maxRows={8}
        placeholder="Type your answer… (⌘+Enter / Ctrl+Enter to send)"
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
      />
      {isLoading && <Loader size="sm" className={styles.loader} />}
      <Button onClick={submit} disabled={!canSubmit}>
        Send
      </Button>
    </div>
  );
}
