# Commonroom

A room-based Socket.IO chat app with shared-token access and file sharing.

## Configure access

1. Copy `.env.example` to `.env`.
2. Set `CHAT_ACCESS_TOKEN` in `.env` to a long random value.
3. Share that token with people who should be allowed into the chat. Do not share or commit `.env`.

A successful login creates a signed, `HttpOnly`, `SameSite=Strict` session cookie that expires after 12 hours. Signing out revokes the current session. The shared token gates access; it does not create individual user accounts.

## Run

```powershell
npm install
npm start
```

The app listens on port 3000 by default. Set `PORT` to use another port if 3000 is occupied.

Uploads are limited to 10 MB and stored under `uploads/`, which is ignored by Git.

## Frontend structure

- `public/index.html` is the document shell; `public/views/` contains the auth and chat markup.
- `public/js/app.js` loads the views, then `public/js/main.js` initializes the feature modules.
- `public/js/state.js` owns shared DOM references and client state. Auth, rooms, messages, uploads, video calls, and socket events each live in their own module.
- `public/css/app.css` imports the base, auth, layout, chat, video-call, and responsive stylesheets.

## Video calls

Calls are room-scoped peer-to-peer mesh calls for up to six participants. Camera and microphone access requires `localhost` or HTTPS. STUN is configured by default; for networks that block direct peer connections, set `TURN_URLS`, `TURN_USERNAME`, and `TURN_CREDENTIAL` in `.env` to credentials from your TURN provider. TURN credentials are sent only to authenticated chat clients.
