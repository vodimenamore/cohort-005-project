# Research: live-update options for Notifications

Ticket: [What live-update options does this stack support for Notifications?](https://github.com/vodimenamore/cohort-005-project/issues/7)
Map: [Notifications spec](https://github.com/vodimenamore/cohort-005-project/issues/4)

Planning only. No app code was written.

## The stack, as it actually is

| Concern | What the repo has | Source |
| --- | --- | --- |
| Framework | React Router 8.3.0, framework mode, `ssr: true` | `package.json`, `react-router.config.ts` |
| Dev server | `react-router dev` (Vite 7) | `vite.config.ts` |
| Prod server | `react-router-serve ./build/server/index.js`: the stock `@react-router/serve` Express 5 app with `compression()` and `morgan`. There is no custom `server.ts`, so the HTTP server object is not exposed to app code | `package.json` scripts, `node_modules/@react-router/serve/dist/cli.js` |
| Data | SQLite file `data.db` via better-sqlite3 + drizzle, WAL mode, lazily opened per process | `app/db/index.ts` |
| Sessions | Cookie session (`createCookieSessionStorage`) | `app/lib/session.ts` |
| Hosting | None configured: no Dockerfile, fly.toml, vercel.json, etc. (`.sandcastle/Dockerfile` is for agent sandboxes, not deploys). Implied target: one long-lived Node process next to a local SQLite file | repo root |
| Existing UI hooks | App layout (`app/routes/layout.app.tsx`) has a `loader` that feeds the `Sidebar`, and mounts a sonner `<Toaster>`. Mutations already go through `useFetcher` in many routes. No `useRevalidator`, `shouldRevalidate`, `EventSource` or WebSocket usage anywhere | grep of `app/` |

Two facts shape everything below:

1. **One process, one SQLite file.** Any server-side "push" can be an in-process `EventEmitter`; no Redis/pub-sub is needed. That stays true only while the app runs as a single instance (SQLite already forces this).
2. **The stock `react-router-serve` is used.** Anything that needs the raw HTTP server (WebSocket upgrade) means replacing it with a custom Express server.

## Options

### 1. Revalidation on navigation / mutation only

Put the unread count (and maybe the latest few Notifications) in the `layout.app.tsx` loader. React Router re-runs active loaders on every navigation and after every `<Form>`/`useFetcher` action, so the badge refreshes whenever the user clicks around or does anything.

- Complexity: trivial; no new routes, no client code beyond rendering the badge.
- Infra: none.
- Limitation: a Notification that arrives while the user sits idle on one page (watching a lesson, reading) is not shown until they act. Also, the layout loader already does nontrivial work (progress calculations), so it is the wrong thing to re-run on a timer later.

### 2. Polling

A small resource route (e.g. `GET /api/notifications/unread`, returning count + newest id) loaded by a `useFetcher().load()` on an interval (30-60 s), from a component in the app layout. Pause on `document.visibilityState === "hidden"`, refetch on `visibilitychange`/focus. When the newest id changes, show a sonner toast and bump the badge.

- Prefer `fetcher.load` on a dedicated route over `useRevalidator().revalidate()`: `revalidate()` re-runs **all** active loaders (including the heavy layout loader and the current page's loader) every tick. If `useRevalidator` is used, every other loader would need a `shouldRevalidate` opt-out, which is fragile.
- Complexity: low; one resource route, one hook (`setInterval` + visibility handling, ~30 lines). Fully covered by existing patterns (resource routes like `api.video-tracking.ts`, `useFetcher`).
- Infra: none. Works identically in `react-router dev` and `react-router-serve`, and would survive moving to multiple instances or serverless.
- Cost: one cheap indexed SQLite query per open tab per interval. Latency up to the interval.

### 3. Server-Sent Events via a resource route

A resource route loader returns `new Response(readableStream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } })`. The client opens an `EventSource` in a layout component. When code that creates a Notification runs, it emits on an in-process `EventEmitter` keyed by user id; the open stream for that user writes an event. Close the listener on `request.signal` abort.

- Works with the stock server: React Router + `@react-router/express` stream a `ReadableStream` body. **Gotcha found in this repo:** `react-router-serve` installs `compression()` (v1.8.2), and `text/event-stream` counts as compressible, so the stream would be buffered and nothing would arrive. `compression` skips responses with `Cache-Control: no-transform`, so that header is mandatory. Send a heartbeat comment every ~25 s to keep proxies from closing idle connections.
- Complexity: medium; stream lifecycle (abort cleanup, heartbeats, reconnect with `Last-Event-ID` or a refetch on reconnect), a pub/sub module, and every Notification-creating code path must publish. Harder to test than a loader.
- Infra: none extra today. Breaks as soon as there is more than one process (events emitted in process A never reach a client on B), and does not fit serverless hosts with response time limits. Each open tab holds a connection (HTTP/1.1 browsers cap ~6 per origin across tabs).
- Latency: near-instant.

### 4. WebSockets

Requires a custom server: replace `react-router-serve` with a `server.ts` that builds the Express app with `@react-router/express`'s `createRequestHandler`, adds `ws` (or socket.io) on the HTTP server's `upgrade` event, and authenticates the socket by parsing the session cookie. In dev, `react-router dev` owns the server, so you also need either a separate WS port or a Vite plugin/middleware to attach the upgrade handler.

- Complexity: high; new dependency, custom server for both dev and prod, cookie auth on upgrade, reconnection, same pub/sub as SSE.
- Infra: same single-process limitation as SSE, plus WS-aware proxy config wherever it is deployed.
- Benefit over SSE: bidirectional, which Notifications do not need (marking read is a normal fetcher action).

## Comparison

| Option | New code | Infra change | Latency | Multi-instance safe |
| --- | --- | --- | --- | --- |
| Navigation/mutation revalidation | ~none | none | until next user action | yes |
| Polling (`fetcher.load` on a resource route) | 1 route + 1 hook | none | <= interval (30-60 s) | yes |
| SSE resource route | route + pub/sub + client + lifecycle | none now; sticky/pub-sub later | ~instant | no (needs Redis etc.) |
| WebSockets | custom server + `ws` + auth + pub/sub | custom server, dev wiring | ~instant | no |

## Recommendation for a first version

**Layout-loader badge + polling.** Load the unread count in the app layout loader (free refresh on every navigation and mutation), and add a visibility-aware `useFetcher` poll of a lightweight `/api/notifications/unread` resource route every ~30-60 s to catch Notifications that arrive while the user is idle; toast when the newest id changes. Nothing about infrastructure changes and it is trivially testable.

Keep SSE as the documented upgrade path if "instant" turns out to matter: it fits the current stock server (with `Cache-Control: no-transform` to get past `compression`) and the client side can swap the poll for an `EventSource` without changing the data model. Skip WebSockets: they need a custom server and buy bidirectionality Notifications do not use.

Implication for the PRD: the spec can promise "appears within about a minute, immediately on navigation", not "real time".
