# interview-ui

A minimal Vite + React + TypeScript SPA for conducting an end-to-end interview against
the local `agent-server` API (`http://localhost:4111/api`). It provides a chat
transcript (bot left, human right), a multiline input with CMD/CTRL+Enter submit, and a
dismissible Markdown artifact modal.

## Requirements

- Node `>=22.13.0`
- `agent-server` running locally for development (`npm run dev` in that repo)

## Setup

```sh
npm install
npm run dev   # http://localhost:5173
```

In development, Vite proxies `/api` to `http://localhost:4111`, so no CORS or env config
is needed. For production builds, set `VITE_API_BASE_URL` (see `.env.example`) and serve
the UI from the same origin as the API, or enable CORS on the backend — the API itself
does not allow cross-origin requests.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 with `/api` proxy to :4111 |
| `npm run build` | Type-check and produce `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc -b --noEmit` |

## Usage

1. The left pane lists every stored interview id with its run status — click one
   to jump back into that conversation, or **+ New interview** to start fresh. On
   the start screen you can also click **Generate new ID** then **Start / Resume**,
   or paste an existing interview id.
2. Answer each question; Enter inserts a newline, **CMD+Enter** (Mac) / **CTRL+Enter**
   (PC) submits.
3. Each completed turn is tagged with a `#line` number. **Right-click a line tag**
   and choose **Roll back to this turn** to erase that turn's answer and everything
   after it, then re-answer the same question. Works on completed interviews too.
4. Type `finish` (or answer until the interview closes) to get the closing message and
   gap list, then click **View artifact** to open the generated Markdown brief.
   **Regenerate artifact** starts a fresh artifact run from the interview's stored
   ledger — useful after changing the writer agent — and replaces the shown brief
   when it succeeds.

## Behaviour notes

- The active interview id is persisted in `localStorage`
  (`interview-ui/interviewId`); on reload the full conversation is rebuilt from
  `GET /interviews/:id` and scrolled to the last turn. **Start over** clears it.
- Rollback uses `resume-async` (`{rollbackToTurn: n}`) on suspended runs and
  `time-travel-async` (to the `conduct` step) on completed ones. An out-of-range
  target shows `rollback-error` (`INTERVIEW_003`) without touching state.
- **View artifact** resolves the newest artifact run for the interview (the
  original or the latest `<id>-aN` attempt); **Regenerate** polls the new run
  until it settles. Earlier artifacts stay readable on the server by run id.
- `stale-prompt`, `model-error` and `rollback-error` responses show as inline
  errors; the interview does not advance, so you can retry.
- The test-harness routes mount outside `/api` (`/interviews/...`); the dev server
  proxies both prefixes to `agent-server`.
