# Paigaam

A real-time chat application built for the **First Commit** hackathon (KamandPrompt, IIT Mandi).
Plain Node.js on the server, native ES modules in the browser. **No dependencies and no build step.**

## Features

**Mandatory core**
- Registration, sign in, sign out, and persistent sessions (HttpOnly cookie, 7 days, stored in the database)
- One-to-one private chat with real-time delivery over WebSockets
- Every message is stored against its sender and conversation

**Extensions**
- Group conversations (create a group, pick members)
- Persistent SQLite database (users, sessions, chats, memberships, messages, timestamps)
- Message bodies **encrypted at rest** (AES-256-GCM)
- Images, **voice notes** (recorded in the browser) and file sharing, with a preview/lightbox
- **File safety:** 10 MB limit, blocked dangerous extensions, magic-byte checks, executable detection, random stored names, access limited to chat members, files served with `nosniff` and a sandbox CSP
- **AI assistant** (Google Gemini API, key kept server-side). Chat with *Paigaam AI* directly, or type `@ai ...` in any chat (for example `@ai summarize`) and it answers using that conversation's recent messages
- Typing indicators, read receipts (double blue tick), online/offline and last seen, unread counters
- Message search, delete-for-everyone, emoji picker, auto-reconnect with catch-up

## Run it

Requires **Node.js 22.13 or newer** (uses the built-in `node:sqlite`).

To enable the AI assistant, copy `.env.example` to `.env` and set `GEMINI_API_KEY` to your Google Gemini API key there. The key stays on the server; do not put it in browser code or commit `.env`.

```bash
npm start
# open http://localhost:3000
```

Create two accounts (one in a normal window, one in a private window), press the pencil button, pick the other user, and chat.

### Environment variables (all optional, see `.env.example`)
| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default 3000) |
| `GEMINI_API_KEY` | Enables the AI assistant. Never sent to the browser. |
| `GEMINI_MODEL` | Gemini model name (default `gemini-flash-latest`) |
| `MESSAGE_KEY` | 64 hex chars to encrypt messages. Auto-generated in `data/` if unset. |
| `DATA_DIR` | Where the database and uploads live (use a persistent disk when deploying) |

### Test it in a clean environment
```bash
npm test
```
Starts a throwaway server and checks: register/login/guard, real-time delivery, read receipts and typing, persistence, encryption at rest, uploads, access control, unsafe-file rejection, the AI chat, and logout.

## Architecture

```
server/
  index.js              HTTP server + static files + router wiring
  config.js  db.js      settings (.env loader) and SQLite schema
  http/                 router.js (tiny router), utils.js (body, cookies, static)
  routes/               auth.js, chats.js, uploads.js   (thin HTTP handlers)
  services/             auth, users, chat, files (validation), ai, crypto (business logic)
  realtime/             websocket.js (RFC 6455 server), hub.js (auth + presence),
                        presence.js (connection registry), handlers.js (send/typing/read/delete)
public/
  index.html
  css/                  fonts, base, auth, chat
  fonts/                put Medici.woff2 here
  js/
    main.js router.js state.js
    pages/              LoginPage, RegisterPage, ChatPage
    components/         AuthShell, Field, Sidebar, ChatWindow, MessageBubble,
                        Composer, VoiceMessage, NewChatDialog, Avatar, Lightbox
    services/           api, socket, realtime (event -> state), chats, recorder
    utils/              dom, icons, format, toast
```

**Real-time:** the browser opens one WebSocket (`/ws`) after login. The server authenticates it from the session cookie, rejects cross-origin upgrades, and pushes `message`, `typing`, `read`, `presence`, `chat` and `deleted` events to the right users. Sending text uses the socket; uploads use HTTP and are then pushed to chat members over the socket.

## Font
The whole UI uses **Medici** (`css/fonts.css`). Drop your licensed font file into `public/fonts/` as `Medici.woff2` (or `.woff`, `.otf`, `.ttf`). Without it the browser falls back to a serif font.

## Deploying (optional)
Render or Railway both work: start command `npm start`, Node 22.13+, and attach a **persistent disk** mounted at the path you set in `DATA_DIR` (otherwise the database and uploads reset on every deploy). Set `GEMINI_API_KEY` in the host's environment settings, never in the repository.
