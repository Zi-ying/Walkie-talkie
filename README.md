# 📻 Walkie-Talkie

A push-to-talk radio in the browser for teams without reliable phone coverage (factories, hospitals). One group channel, a Dispatch view and a simple member view. Every transmission is transcribed, and an LLM rewrites it as a short, simple note for people who can't hear the audio.

## How to run

```bash
yarn
cp .env.example .env   # add your Claude API key
yarn dev
```

Open two Chrome tabs: one as Dispatch, one as Member, on the same channel code.

### On several laptops (same Wi-Fi)

Browsers only allow the microphone on `https://` pages or `localhost`, so serve over HTTPS on the local network:

```bash
yarn dev:lan
```

Open the `Network: https://…` address it prints on every laptop. The certificate is self-signed, so the browser warns once: choose "Advanced → Proceed". Voice is peer-to-peer; PeerJS's default STUN and free TURN servers help laptops connect, even across networks.

## Tests

```bash
yarn playwright install chromium   # once
yarn test:e2e
```

End-to-end tests (Playwright) open real Chrome pages with a fake microphone and check the core flows: dispatch and member hear each other, a member waiting for dispatch, a duplicate dispatch being refused, "ended shift" vs "lost connection" in the shift log, members coming back when dispatch reopens the channel, push-to-talk, and the AI notes.

They start their own servers and need no internet: a local PeerJS signaling server (the official [`peer`](https://github.com/peers/peerjs-server) package, instead of the shared cloud server, which rate-limits when many peers connect in a short time) and the app pointed at it. The AI-note tests never call the real Claude API: the test app gets a fake key, the speech recognition is faked, and the request to Claude is intercepted, so they cost nothing.

To use the local signaling server by hand too: run `yarn peer:local`, and set `VITE_PEERJS_HOST=localhost` in `.env` (without it, the app uses the PeerJS cloud server).

## AI notes (the LLM part)

Each transmission is transcribed, then Claude rewrites it as a short, simple note shown to everyone, in a big banner and in the message feed. It is for people who are deaf or hard of hearing, have a speech impediment, or are somewhere too noisy to hear.

The radio and the AI are separate pieces, put together only in `app.tsx`: `useChannel` (the radio) takes an optional `writeNote` function and knows nothing about speech recognition or Claude; `useTranscription` turns speech into text while you're on air; `lib/llm.ts` writes the note. Each works, and can be replaced, on its own.

1. **Speech to text** runs on the speaker's laptop while they hold the button (browser Web Speech API, Chrome and Edge only).
2. **The transcript goes to Dispatch**, which calls Claude (`claude-haiku-5-5`, the fastest and cheapest model, at low effort: about $0.0001 per note) and shares the transcript, then the note, with everyone.
3. **The radio never depends on the AI:** without a key, or if the call fails, everyone still sees the transcript, and the note shows as unavailable.

To turn it on, put a Claude API key in `.env` as `VITE_ANTHROPIC_API_KEY`. The key is used from Dispatch's browser, so anyone who opens the page could read it: fine for a local demo, not for a public deployment (see below).

## Architecture

_To be written._

## If I had more time

- **Admin page and registered members:** an admin creates channels and registers members ahead of time, so each person has a fixed id assigned once (not a random one per session). Only registered members can join a channel, and channel names are created and validated by the admin rather than typed freely (the MVP accepts any channel name, and PeerJS rejects names with characters outside `A-Z a-z 0-9 - _`). This needs a backend: a member registry, authentication, and a signaling server that checks membership before connecting peers.
- **A backend for the AI and the text messages:** a small server holds the Claude API key (never shipped to browsers) and makes the Claude call. A WebSocket service carries the text messages (transcripts, notes, roster, shift log) with history, so people who were offline catch up, while voice stays on WebRTC. The MVP is frontend-only, so text goes over WebRTC data channels between browsers instead.
- **Private speech-to-text:** Chrome's Web Speech API sends the audio to Google's servers to recognise it, which is a real concern in a hospital. Replace it with a self-hosted speech model (e.g. Whisper) on the backend, which would also work in every browser.
- **Dispatch validates or edits the AI note** before it is shown to everyone, and more AI on the history: shift summaries, "what did I miss?" questions, and detecting recurring issues (the same machine jamming every day).
- **One-on-one with Dispatch:** a member talks privately to Dispatch without disturbing the main channel (the "two channels" idea in the brainstorm). Design: today one microphone stream feeds every call, so muting is all or nothing; private talk needs a copy of the mic per call (`stream.clone()`) to switch on only the connection to Dispatch, its own floor (a private conversation shouldn't block the main channel), and private messages kept out of the shared feed.
- **Dispatch priority / emergency override:** Dispatch (or an emergency button) takes the floor immediately, cutting off the current speaker. In the MVP everyone follows the same first-come rule, so an urgent message waits until the speaker releases.
- **Push-to-talk extras:** a "go ahead" beep when the floor is granted, holding the spacebar to talk, a queue (or a "someone is waiting" hint) when the channel is busy, and a maximum talk time so nobody holds the channel forever.
- **Scaling voice beyond a small team:** voice is a full mesh (every person sends their audio to every other person), so upload bandwidth grows with the group size; it works for a handful of people. For bigger channels, use an SFU media server (e.g. LiveKit or mediasoup): each person sends one stream to the server, which forwards it. Add TURN servers for strict corporate or hospital networks where direct peer-to-peer connections are blocked.
- **Admin-managed shifts:** Dispatch puts people on or off duty; members can't sign out themselves. (The browser can't stop anyone from closing a tab, so the MVP makes leaving deliberate, with a confirmation, and visible in the shift log.)
- **Drop alerts:** alert Dispatch when someone has been "lost connection" for more than ~2 minutes during a shift.
- **Auto-reconnect** when the signal comes back.
- **Channel without Dispatch:** in the MVP, Dispatch is the meeting point, so members can't find each other until Dispatch is online. Fix: numbered "seat" ids, or a small signaling/presence server.
