import { useEffect, useRef, useState } from 'react';
import { ActionIcon } from '@mantine/core';
import { SpeakerIcon, StopIcon } from './icons';

// 'canceled'/'interrupted' just mean playback was stopped deliberately.
const reportSpeechError = (
  event: SpeechSynthesisErrorEvent,
  onError: (message: string) => void,
  source: string,
): void => {
  if (event.error !== 'canceled' && event.error !== 'interrupted') {
    onError(`Could not read the message aloud: "${event.error}" (${source}).`);
  }
};

/** Fire-and-forget playback of arbitrary text (e.g. from the turn menu). */
export function speakText(text: string, onError: (message: string) => void): void {
  if (!('speechSynthesis' in window)) {
    onError(
      'Read-aloud is unavailable: this browser has no speechSynthesis support (speakText in SpeakButton).',
    );
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onerror = (event) => reportSpeechError(event, onError, 'speakText in SpeakButton');
  // Cancel anything already playing so clicks don't queue utterances.
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

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
      reportSpeechError(event, onErrorRef.current, 'utterance.onerror in SpeakButton');
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
      onClick={(event) => {
        // Keep the click from reaching the bubble's own click-to-menu handler.
        event.stopPropagation();
        toggle();
      }}
      title={speaking ? 'Stop reading' : 'Read aloud'}
      aria-label={speaking ? 'Stop reading this message' : 'Read this message aloud'}
    >
      {speaking ? <StopIcon /> : <SpeakerIcon />}
    </ActionIcon>
  );
}
