const KEY = 'interview-ui/interviewId';

export const readStoredId = (): string | null => localStorage.getItem(KEY);

export const storeId = (id: string): void => localStorage.setItem(KEY, id);

export const clearStoredId = (): void => localStorage.removeItem(KEY);
