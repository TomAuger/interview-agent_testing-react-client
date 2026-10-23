export type Message =
  | { id: string; role: 'bot'; text: string }
  | { id: string; role: 'human'; text: string }
  | { id: string; role: 'error'; text: string; code?: string }
  | { id: string; role: 'completion'; closing: string; gaps: string[] };

export type Phase = 'start' | 'active' | 'complete';

export interface InterviewState {
  phase: Phase;
  interviewId: string | null;
  pendingPromptId: string | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export type Action =
  | { type: 'SET_START' }
  | { type: 'JOIN_INTERVIEW'; interviewId: string }
  | { type: 'STARTED'; id: string; promptId: string; text: string }
  | { type: 'SUBMIT_ANSWER'; id: string; text: string }
  | { type: 'RECEIVED_QUESTION'; id: string; promptId: string; text: string }
  | { type: 'RECEIVED_ERROR'; id: string; text: string; code?: string }
  | { type: 'COMPLETED'; id: string; closing: string; gaps: string[] }
  | { type: 'API_ERROR'; error: string };
