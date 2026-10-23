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

1. On the start screen, click **Generate new ID** then **Start / Resume** — or paste an
   existing interview id to resume it.
2. Answer each question; Enter inserts a newline, **CMD+Enter** (Mac) / **CTRL+Enter**
   (PC) submits.
3. Type `finish` (or answer until the interview closes) to get the closing message and
   gap list, then click **View artifact** to open the generated Markdown brief.

## Behaviour notes

- The active interview id is persisted in `localStorage`
  (`interview-ui/interviewId`), so a refresh resumes the same run. **Start over** clears
  it.
- The artifact status is fetched only when you click **View artifact** — there is no
  polling. If it is still generating, click again after a few seconds.
- `stale-prompt` and `model-error` responses show as inline errors; the interview does
  not advance, so you can retry the same answer.
