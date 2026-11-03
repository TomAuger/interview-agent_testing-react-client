import { useEffect, useRef, useState } from 'react';
import { ActionIcon } from '@mantine/core';
import { SpeakerIcon, StopIcon } from './icons';

interface SpeakButtonProps {
  text: string;
  className?: string | undefined;
  onError: (message: string) => void;
}

export function SpeakButton({ text, className, onError }: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // If this bubble unmounts mid-speech (rollback, start over), stop playback.
  useEffect(
    () => () => {
      if (utteranceRef.current !== null) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  if (!('speechSynthesis' in window)) {
    return null;
  }

  const toggle = (): void => {
    if (speaking) {
      window.speechSynthesis.cancel();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
      utteranceRef.current = null;
      setSpeaking(false);
    };
    utterance.onerror = (event) => {
      utteranceRef.current = null;
      setSpeaking(false);
      // 'canceled'/'interrupted' just mean playback was stopped deliberately.
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        onErrorRef.current(
          `Could not read the message aloud: "${event.error}" (utterance.onerror in SpeakButton).`,
        );
      }
    };
    // Cancel anything already playing so clicks don't queue utterances; each
    // cancelled utterance gets an 'end' event, which resets its own button.
    window.speechSynthesis.cancel();
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  return (
    <ActionIcon
      className={className}
      data-speaking={speaking || undefined}
      variant="subtle"
      color="gray"
      size="sm"
      onClick={toggle}
      title={speaking ? 'Stop reading' : 'Read aloud'}
      aria-label={speaking ? 'Stop reading this message' : 'Read this message aloud'}
    >
      {speaking ? <StopIcon /> : <SpeakerIcon />}
    </ActionIcon>
  );
}
