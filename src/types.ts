export type Message =
  | { id: string; role: 'bot'; text: string; line?: number }
  | { id: string; role: 'human'; text: string; line?: number }
  | { id: string; role: 'error'; text: string; code?: string }
  | { id: string; role: 'completion'; closing: string; gaps: string[] };

export type Phase = 'start' | 'active' | 'complete';

export interface InterviewState {
  phase: Phase;
  interviewId: string | null;
  /** Run status of the current interview (drives the rollback transport). */
  runStatus: string | null;
  pendingPromptId: string | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export type Action =
  | { type: 'SET_START' }
  | { type: 'JOIN_INTERVIEW'; interviewId: string }
  | {
      type: 'HYDRATED';
      runStatus: string;
      phase: Phase;
      pendingPromptId: string | null;
      messages: Message[];
    }
  | { type: 'STARTED'; id: string; promptId: string; text: string; line?: number }
  | { type: 'SUBMIT_ANSWER'; id: string; text: string }
  | { type: 'RECEIVED_QUESTION'; id: string; promptId: string; text: string; line?: number }
  | { type: 'RECEIVED_ERROR'; id: string; text: string; code?: string }
  | { type: 'COMPLETED'; id: string; closing: string; gaps: string[] }
  | { type: 'API_ERROR'; error: string };
