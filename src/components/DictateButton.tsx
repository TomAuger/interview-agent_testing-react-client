import { useEffect, useRef, useState } from 'react';
import { ActionIcon } from '@mantine/core';
import { MicIcon, StopIcon } from './icons';

// The SpeechRecognition API is not in the TS DOM lib yet; declare the parts
// we use. Chrome exposes it as `webkitSpeechRecognition`.
interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResultItem {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResultItem;
  length: number;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

const getRecognitionCtor = (): SpeechRecognitionCtor | undefined => {
  const w = window as unknown as Record<string, SpeechRecognitionCtor | undefined>;
  return w['SpeechRecognition'] ?? w['webkitSpeechRecognition'];
};

// Maps the SpeechRecognitionErrorEvent codes onto human-readable causes.
const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'microphone permission was denied',
  'service-not-allowed': 'microphone permission was denied',
  'audio-capture': 'no usable microphone was found',
  'no-speech': 'no speech was detected',
  network: 'the speech recognition service could not be reached',
  aborted: 'recognition was aborted',
};

interface DictateButtonProps {
  disabled: boolean;
  /** Called once dictation starts so the parent can snapshot the typed text. */
  onStart: () => void;
  /** Called with the full session transcript on every recognition result. */
  onTranscript: (text: string) => void;
  /** Called after the user stops dictation; parent should submit the text. */
  onDone: () => void;
  onError: (message: string) => void;
}

export function DictateButton({
  disabled,
  onStart,
  onTranscript,
  onDone,
  onError,
}: DictateButtonProps) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const submitOnEndRef = useRef(false);
  // The recognition callbacks close over the render active when dictation
  // started, so always invoke the latest props.
  const callbacksRef = useRef({ onStart, onTranscript, onDone, onError });
  callbacksRef.current = { onStart, onTranscript, onDone, onError };

  const supported = getRecognitionCtor() !== undefined;

  // Abort an in-flight session on unmount or when the input becomes disabled
  // (e.g. the answer was sent while dictation was still running).
  useEffect(() => {
    if (disabled) {
      submitOnEndRef.current = false;
      recognitionRef.current?.abort();
    }
  }, [disabled]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const start = (): void => {
    const Ctor = getRecognitionCtor();
    if (Ctor === undefined) {
      callbacksRef.current.onError(
        'Dictation is unavailable: this browser has no SpeechRecognition support (DictateButton.start).',
      );
      return;
    }
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language;
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i]?.[0]?.transcript ?? '';
      }
      callbacksRef.current.onTranscript(transcript);
    };
    recognition.onerror = (event) => {
      const detail = ERROR_MESSAGES[event.error] ?? `unexpected error "${event.error}"`;
      callbacksRef.current.onError(
        `Dictation stopped: ${detail} (SpeechRecognition.onerror in DictateButton).`,
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      if (submitOnEndRef.current) {
        submitOnEndRef.current = false;
        callbacksRef.current.onDone();
      }
    };
    try {
      recognition.start();
    } catch (err) {
      callbacksRef.current.onError(
        `Could not start dictation: ${err instanceof Error ? err.message : String(err)} (recognition.start in DictateButton).`,
      );
      return;
    }
    recognitionRef.current = recognition;
    submitOnEndRef.current = false;
    setListening(true);
    callbacksRef.current.onStart();
  };

  const toggle = (): void => {
    if (listening) {
      // Stop, then submit once `onend` fires so the final interim words are
      // captured into the input first.
      submitOnEndRef.current = true;
      recognitionRef.current?.stop();
    } else {
      start();
    }
  };

  if (!supported) {
    return (
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        disabled
        title="Dictation is not supported in this browser"
        aria-label="Dictation is not supported in this browser"
      >
        <MicIcon />
      </ActionIcon>
    );
  }

  return (
    <ActionIcon
      variant={listening ? 'filled' : 'subtle'}
      color={listening ? 'red' : 'gray'}
      size="sm"
      onClick={toggle}
      disabled={disabled && !listening}
      title={listening ? 'Stop dictation and send' : 'Dictate your answer'}
      aria-label={listening ? 'Stop dictation and send' : 'Dictate your answer'}
    >
      {listening ? <StopIcon /> : <MicIcon />}
    </ActionIcon>
  );
}
