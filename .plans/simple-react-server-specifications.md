# Simple React SPA — Interview UI Specifications

> A minimal Vite + React + TypeScript SPA, styled with Mantine components and colocated CSS modules, that lets a human conduct a full end-to-end interview against the local `agent-server` API. It provides a chat transcript, a multiline input with CMD/CTRL+Enter submit, and a dismissible Markdown artifact modal.

## 1. Objective

Build a **separate-repository** React single-page application that drives the existing `agent-server` interview API (`http://localhost:4111/api`). The SPA must start an interview, display bot and human messages, accept answers, handle retryable errors, show the closing message and gap report, and retrieve the background Markdown artifact on demand.

**No backend changes are in scope.**

## 2. Acceptance criteria

- [ ] On first load the user sees a **Start screen** where they can type an existing interview id or generate a new UUID.
- [ ] The active interview id is persisted in `localStorage`; a browser refresh resumes the same run.
- [ ] A **Start Over** button clears the stored id and returns to the Start screen.
- [ ] The chat transcript shows bot text **left-aligned** and human text **right-aligned**.
- [ ] The first bot message renders the `welcome` text followed by the overview `question`.
- [ ] Each turn submits the current `promptId` with the user's answer text.
- [ ] The multiline input supports normal Enter for newlines and **CMD+Enter (Mac) / CTRL+Enter (PC)** to submit.
- [ ] Submitting disables the input and shows a loading indicator until the API responds.
- [ ] `stale-prompt` and `model-error` responses surface as inline bot error messages **without advancing** the interview; the user can retry the same question.
- [ ] On completion the closing message and `gaps` list are displayed, the input is hidden, and a **View artifact** button appears.
- [ ] Clicking **View artifact** fetches `GET /api/workflows/interviewArtifact/runs/:id`:
  - `success` → open a dismissible modal at least **800px wide** with the rendered Markdown.
  - `pending`/`running` → show "Artifact is still being generated…" inline.
  - `failed` → show "Artifact generation failed." and the run id for manual inspection.
- [ ] `npm run typecheck` and `npm run build` pass cleanly.

## 3. Scope

**In scope**

- Vite + React + TypeScript project scaffold.
- Mantine components and colocated CSS modules for layout/styling.
- API client wrapping the agent-server workflow routes.
- Start screen, chat screen, message list, input, loading/error states, artifact modal.
- `localStorage` persistence of the active `interviewId`.
- Vite dev-server proxy to `http://localhost:4111`.
- `.env.example` for the production API base URL.

**Out of scope**

- Any change to the `agent-server` backend, including CORS, webhooks, or SSE.
- Authentication or user accounts.
- Automated component/E2E tests (this MVP is verified by `typecheck`/`build` + manual QA).
- ESLint/Prettier tooling beyond TypeScript/Vite defaults (optional line in §9 if desired).

## 4. Constraints

- **Node engine:** `>=22.13.0` (mirror the backend; do not change).
- **Framework:** React 19 + TypeScript + ES modules.
- **Build tool:** Vite.
- **UI library:** Mantine v9 (requires React 19.2+), with CSS modules for component-level overrides.
- **Markdown renderer:** `react-markdown` for the artifact modal.
- **HTTP client:** global `fetch` only.
- **State:** React `useState`/`useReducer`; no external state library.
- **API base:** `/api` in development (Vite proxy), `import.meta.env.VITE_API_BASE_URL` in production builds.
- **No polling:** artifact status is fetched only when the user clicks **View artifact**.

## 5. Dependencies / package approval list

Pin these exact versions unless a security or peer-dependency issue forces a change, in which case record the deviation. Verify each version is at least 7 days old at install time.

> **DEVIATION** (2026-10-17): Installed `react`/`react-dom` **19.3.0** and `@mantine/core`/`@mantine/hooks` **9.7.1** instead of the pinned 19.3.1 / 9.7.2 — the pinned versions were only 3–6 days old at install time, violating this section's own 7-day rule (user-approved). Mantine 9.7.1 still satisfies the React 19.2+ peer requirement.

### Runtime

| Package | Version | Purpose | Alternatives considered |
| --- | --- | --- | --- |
| `react` | `19.3.1` | UI framework | Latest stable React; Mantine 9.x requires React 19.2+. |
| `react-dom` | `19.3.1` | DOM renderer | Same as above. |
| `@mantine/core` | `9.7.2` | Accessible components (Modal, Textarea, Button, Loader, Alert) | Tailwind + headless UI — rejected because user explicitly chose Mantine. |
| `@mantine/hooks` | `9.7.2` | Shared hooks used by Mantine core | Required peer of `@mantine/core`. |
| `react-markdown` | `10.1.0` | Render artifact Markdown in the modal | Plain `<pre>` text — rejected per user requirement to render formatted Markdown. |

### Development

| Package | Version | Purpose |
| --- | --- | --- |
| `vite` | `8.3.4` | Dev server and production build |
| `@vitejs/plugin-react` | `6.1.2` | React 19 fast-refresh and JSX transform |
| `typescript` | `6.0.3` | Same major version as the backend |
| `@types/react` | `19.3.0` | React 19 type definitions |
| `@types/react-dom` | `19.3.0` | ReactDOM 19 type definitions |

## 6. API surface

All routes are under `/api` and are served by the Mastra built-in workflow router in `agent-server`.

### Start an interview

```http
POST /api/workflows/interviewWorkflow/start-async?runId=<interview-id>
Content-Type: application/json
```

```json
{
  "inputData": {},
  "initialState": { "ledger": null }
}
```

> **DEVIATION** (2026-10-17): `runId` is a **query parameter**, not a body field. Verified against `@mastra/server` (`queryParamSchema: optionalRunIdSchema` on `start-async`, `runIdSchema` on `resume-async`) and live: a body `runId` is silently ignored and the server generates a random run id.

The workflow immediately suspends at the `conduct` step. Read the pending prompt from:

```json
{
  "status": "suspended",
  "steps": {
    "conduct": {
      "suspendPayload": {
        "kind": "welcome",
        "promptId": "<prompt-id>",
        "question": "What should we build?",
        "welcome": "Welcome text..."
      }
    }
  }
}
```

### Resume an interview

```http
POST /api/workflows/interviewWorkflow/resume-async?runId=<interview-id>
Content-Type: application/json
```

```json
{
  "resumeData": {
    "promptId": "<prompt-id>",
    "answerText": "the user's answer"
  }
}
```

Response shapes:

- **Suspended with next question**
  ```json
  {
    "status": "suspended",
    "steps": { "conduct": { "suspendPayload": { "kind": "question", "promptId": "...", "question": "..." } } }
  }
  ```
- **Stale answer**
  ```json
  {
    "status": "suspended",
    "steps": { "conduct": { "suspendPayload": { "kind": "stale-prompt", "promptId": "...", "question": "...", "errorCode": "INTERVIEW_001" } } }
  }
  ```
- **Retryable model failure**
  ```json
  {
    "status": "suspended",
    "steps": { "conduct": { "suspendPayload": { "kind": "model-error", "promptId": "...", "question": "...", "errorCode": "..." } } }
  }
  ```
- **Completed**
  ```json
  {
    "status": "success",
    "result": {
      "interviewId": "...",
      "closing": "Thank you...",
      "completionReason": "finish-requested",
      "gaps": ["We didn't cover ..."]
    }
  }
  ```

### Inspect an existing interview run

```http
GET /api/workflows/interviewWorkflow/runs/:interviewId?fields=result,steps
```

Used on refresh to re-hydrate the pending prompt or completion state.

> **DEVIATION** (2026-10-17): Called with `?fields=result,steps` to avoid downloading the full run snapshot (`initialState.ledger` is large); `status` is always included. The artifact endpoint is called with `?fields=result` for the same reason.

### Artifact status / result

```http
GET /api/workflows/interviewArtifact/runs/:interviewId
```

```json
{
  "status": "success",
  "result": { "markdown": "# Summary\n..." }
}
```

Status may be `pending`, `running`, `success`, or `failed`.

> **DEVIATION** (2026-10-17): This endpoint can also return **404** for a brief window right after the interview completes (the artifact run is created in the `finalize` step, or not at all if its start failed). The UI maps 404 to the "Artifact is still being generated…" message rather than a hard error.

## 7. Data model and state

Use a single `useReducer` in `App.tsx` so async transitions are explicit and testable in code review.

### Types

```ts
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
```

### localStorage

Key: `interview-ui/interviewId`
Value: the active `interviewId` string.

Read it once on app mount. Write it when an interview is created or joined. Delete it on **Start Over**.

### State transitions

| Action | Effect |
| --- | --- |
| `SET_START` | Clear interview id and messages, phase = `start`. |
| `JOIN_INTERVIEW` | Set `interviewId`, persist to localStorage, `isLoading = true` (join/start fetch is in flight). |

> **DEVIATION** (2026-10-17): `JOIN_INTERVIEW` sets `isLoading = true` so refresh-rehydration and manual joins render a loading state until `RECEIVED_QUESTION`/`COMPLETED`/`API_ERROR` lands. `RECEIVED_QUESTION`/`RECEIVED_ERROR` also set `phase = 'active'` (required for the rehydration path, which transitions `start → active` through them). `STARTED` shares the `RECEIVED_QUESTION` reducer branch — the caller pre-combines `welcome` + `question` into the bot message text, so both actions perform the same state update.
| `STARTED` | Add welcome + overview as one bot message; phase = `active`; `pendingPromptId` = welcome prompt id. |
| `SUBMIT_ANSWER` | Append human message, clear input, set `isLoading = true`. |
| `RECEIVED_QUESTION` | Append bot message, update `pendingPromptId`, `isLoading = false`. |
| `RECEIVED_ERROR` | Append error message, keep current `pendingPromptId`, `isLoading = false`. |
| `COMPLETED` | Append completion message with closing + gaps, phase = `complete`, `pendingPromptId = null`, `isLoading = false`. |
| `API_ERROR` | Set top-level `error` string, `isLoading = false`. |

## 8. File structure

```
interview-ui/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── .env.example
├── README.md
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── types.ts
    ├── storage.ts
    ├── api/
    │   └── client.ts
    ├── components/
    │   ├── StartScreen.tsx
    │   ├── StartScreen.module.css
    │   ├── ChatScreen.tsx
    │   ├── ChatScreen.module.css
    │   ├── MessageList.tsx
    │   ├── MessageList.module.css
    │   ├── MessageInput.tsx
    │   ├── MessageInput.module.css
    │   ├── ArtifactModal.tsx
    │   └── ArtifactModal.module.css
    └── hooks/
        └── useInterview.ts   # optional thin wrapper around the reducer + API calls
```

## 9. Implementation steps

### 9.1 Scaffold the project

1. Create the new repository directory adjacent to `agent-server` (exact path chosen by the developer).
2. `npm init -y`, set `type: "module"`, `private: true`, and `engines.node: ">=22.13.0"`.
3. Install approved dependencies (§5) with exact versions. Do **not** auto-install unapproved packages. Note: Mantine 9.x requires React 19.2+; installing it alongside React 18 will produce peer-dependency warnings.
4. Write `index.html` with a `<div id="root"></div>` and a `<script type="module" src="/src/main.tsx"></script>`.
5. Write `src/main.tsx`:
   - Import `@mantine/core/styles.css`.
   - Wrap `<App />` in `<MantineProvider>` so Mantine 9 theme defaults and styles are active.
   - Mount with `ReactDOM.createRoot(document.getElementById('root')!).render(...)`.

### 9.2 TypeScript configuration

Use a standard Vite React `tsconfig.json` split:

- `tsconfig.json` references `tsconfig.app.json` and `tsconfig.node.json`.
- `tsconfig.app.json`: `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`, `moduleResolution: "Bundler"`, `jsx: "react-jsx"`, `target: "ES2022"`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `module: "ESNext"`.
- `tsconfig.node.json`: same for `vite.config.ts`.

### 9.3 Vite configuration

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4111',
        changeOrigin: true,
      },
    },
  },
});
```

### 9.4 API client (`src/api/client.ts`)

Define:

```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export async function startInterview(interviewId: string): Promise<WorkflowRun> { ... }
export async function resumeInterview(interviewId: string, promptId: string, answerText: string): Promise<WorkflowRun> { ... }
export async function getInterviewStatus(interviewId: string): Promise<WorkflowRun> { ... }
export async function getArtifactStatus(interviewId: string): Promise<ArtifactRun> { ... }
```

- All functions `throw` on non-OK HTTP status or malformed JSON; callers catch and dispatch `API_ERROR`.
- Use `unknown` + Zod or typed `as`? For a minimal UI, parse with Zod (add `zod` dependency? out of scope). **Decision:** use narrow TypeScript interfaces and runtime checks for the fields actually consumed (`status`, `steps.conduct.suspendPayload`, `result`). Do not add Zod unless the critic approves it.

### 9.5 Storage helper (`src/storage.ts`)

```ts
const KEY = 'interview-ui/interviewId';
export const readStoredId = (): string | null => localStorage.getItem(KEY);
export const storeId = (id: string): void => localStorage.setItem(KEY, id);
export const clearStoredId = (): void => localStorage.removeItem(KEY);
```

### 9.6 Components

#### `StartScreen`

- Controlled text input for `interviewId`.
- **Generate new ID** button: `crypto.randomUUID()`.
- **Start / Resume** button: validates non-empty id; calls `getInterviewStatus` first and joins the run if it exists (so pasting an existing id resumes it), falling back to `startInterview` on a 404.

> **DEVIATION** (2026-10-17): The join-or-start order above replaces "calls `startInterview` if no stored id exists or joins via `getInterviewStatus` if one is provided". Calling `start-async` with an id that already has a run would either error or restart it; a 404 probe makes "type an existing interview id" reliably mean *resume*.
- Mantine `TextInput`, `Button`, `Group`.

#### `ChatScreen`

- Renders `MessageList`, `MessageInput` (when phase is `active`), and the **View artifact** button (when phase is `complete`).
- Top bar shows current `interviewId` and a **Start Over** button.

#### `MessageList`

- `role='bot'` left-aligned; `role='human'` right-aligned; `role='error'` left-aligned with an alert style; `role='completion'` centered block with closing text and gap list.
- Use `aria-live="polite"` on the list container.
- CSS module maps `.bot`, `.human`, `.error`, `.completion` to `align-self` values.

#### `MessageInput`

- Multiline `Textarea` with `minRows={3}` and `maxRows={8}`.
- `onKeyDown`: if `(e.metaKey || e.ctrlKey) && e.key === 'Enter'`, prevent default and submit.
- **Submit** `Button` disabled when input is empty or `isLoading`.
- `Loader` visible when `isLoading`.

#### `ArtifactModal`

- Mantine `Modal` opened from `ChatScreen`.
- Minimum width: `800px`; use inline style `style={{ width: 800, maxWidth: '95vw' }}` or `size="xl"` plus a CSS module.
- Dismissible via close button, click outside, and Escape.
- Body uses `react-markdown` to render `artifactMarkdown`.
- Before opening, `ChatScreen` calls `getArtifactStatus`; if not `success`, show status inline instead of opening the modal.

### 9.7 App-level reducer and effects

`App.tsx` owns the reducer and wires components to API calls.

On mount:

1. Read stored id.
2. If none, dispatch `SET_START`.
3. If present, dispatch `JOIN_INTERVIEW`, then call `getInterviewStatus(id)`.
   - If `status === 'suspended'`: build the pending message from `steps.conduct.suspendPayload` and dispatch `RECEIVED_QUESTION`.
   - If `status === 'success'`: dispatch `COMPLETED` with `result`.
   - On fetch error: clear storage and dispatch `SET_START`.

Start flow:

1. User clicks **Start / Resume**.
2. If starting fresh: call `startInterview(id)`.
3. Parse `steps.conduct.suspendPayload`; dispatch `STARTED`.

Turn flow:

1. User submits answer: dispatch `SUBMIT_ANSWER`.
2. Call `resumeInterview(id, pendingPromptId, answerText)`.
3. If `status === 'suspended'`: dispatch `RECEIVED_QUESTION` (for `kind: 'question'`) or `RECEIVED_ERROR` (for `kind: 'stale-prompt'` / `model-error`).
4. If `status === 'success'`: dispatch `COMPLETED`.
5. On network/parse error: dispatch `API_ERROR`.

Error mapping:

- `kind === 'stale-prompt'` → bot error message: "That answer didn't match the current question. Please answer the question above."
- `kind === 'model-error'` → bot error message: "The assistant had a temporary issue. Please try again."
- Network/fetch failure → top-level `error`: "Unable to reach the interview server. Make sure `agent-server` is running on `http://localhost:4111`."

### 9.8 Styling

- Use Mantine's global CSS by importing `@mantine/core/styles.css` once in `main.tsx`.
- Component-level tweaks and chat alignment live in colocated CSS modules.
- Keep the chat visually minimal: rounded message bubbles, clear role colors, generous padding, accessible contrast.

### 9.9 Scripts and verification

`package.json` scripts:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "typecheck": "tsc -b --noEmit"
}
```

`.env.example`:

```
# Production API base URL. In dev, Vite proxies /api to localhost:4111.
VITE_API_BASE_URL=http://localhost:4111
```

## 10. Manual QA steps

1. In `agent-server`: `npm install`, `cp .env.example .env`, fill `OPENAI_API_KEY`, `npm run dev`.
2. In `interview-ui`: `npm install`, `npm run dev`.
3. Open `http://localhost:5173`.
4. Click **Generate new ID**, then **Start interview**.
5. Verify welcome text + overview question appear as one left-aligned bot bubble.
6. Type a multi-line answer, press Enter to confirm newline, then CMD/CTRL+Enter to submit.
7. Verify your answer appears right-aligned, the input clears, a loader appears, then a new bot question appears left-aligned.
8. Type `finish` and submit; verify the closing message and gap list appear, and the input is replaced by a **View artifact** button.
9. Click **View artifact**; wait a few seconds if needed, then verify a modal ≥ 800px wide opens with formatted Markdown.
10. Refresh the browser; verify the same interview resumes at the same pending question.
11. Click **Start Over**; verify the Start screen returns and `localStorage` is cleared.

## 11. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Mantine v9 + React 19 / React 19 dependency | Pin exact versions; if `npm install` warns, downgrade to Mantine 8.x + React 18.3.1 and record the deviation. |
| `agent-server` not running or CORS error in production | Dev uses Vite proxy; production requires the backend to allow CORS or the UI to be served from the same origin. Document this out-of-scope limitation in the README. |
| Artifact generation is slow | UI does not poll; the user must click **View artifact** again. Document this in the README. |
| TypeScript `exactOptionalPropertyTypes` conflicts with Mantine types | If a Mantine prop type rejects `undefined`, use conditional objects (`...(condition && { prop })`) rather than `prop: undefined`. |
| Markdown in artifact could contain unsafe content | `react-markdown` does not execute script by default; do not enable `rehype-raw`. |

## 12. Notes for the executing agent

- Do not add packages beyond §5 without a separate approval and dependency review.
- Do not modify `agent-server`.
- Keep the UI minimal; resist adding routing, theming, or animation libraries.
- If the critic changes any decision (e.g., polling instead of manual artifact retrieval, plain text instead of Markdown), update §2, §4, §5, and §9 consistently before coding.
