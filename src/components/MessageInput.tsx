import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button, Loader, Text, Textarea } from '@mantine/core';
import { DictateButton } from './DictateButton';
import styles from './MessageInput.module.css';

interface MessageInputProps {
  isLoading: boolean;
  onSubmit: (text: string) => void;
}

export function MessageInput({ isLoading, onSubmit }: MessageInputProps) {
  const [value, setValue] = useState('');
  const [dictationError, setDictationError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Text typed before dictation started; transcripts are appended to it.
  const dictationBaseRef = useRef('');
  const canSubmit = value.trim().length > 0 && !isLoading;

  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus();
    }
  }, [isLoading]);

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
    <div className={styles.stack}>
      <div className={styles.row}>
        <Textarea
          ref={textareaRef}
          className={styles.input}
          autosize
          minRows={3}
          maxRows={8}
          placeholder="Type your answer… (⌘+Enter / Ctrl+Enter to send)"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rightSection={
            <DictateButton
              disabled={isLoading}
              onStart={() => {
                dictationBaseRef.current = value;
                setDictationError(null);
              }}
              onTranscript={(transcript) => {
                const base = dictationBaseRef.current;
                setValue(base !== '' && transcript !== '' ? `${base} ${transcript}` : base + transcript);
              }}
              onDone={submit}
              onError={setDictationError}
            />
          }
          rightSectionPointerEvents="auto"
        />
        {isLoading && <Loader size="sm" className={styles.loader} />}
        <Button onClick={submit} disabled={!canSubmit}>
          Send (⌘+Enter)
        </Button>
      </div>
      {dictationError !== null && (
        <Text size="xs" c="red" className={styles.dictationError}>
          {dictationError}
        </Text>
      )}
    </div>
  );
}
