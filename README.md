# 📻 Walkie-Talkie

A push-to-talk radio in the browser for teams without reliable phone coverage (factories, hospitals). People join a channel with a code; one person is Dispatch, the others are members. Hold the button to talk, one speaker at a time. Every transmission is transcribed, and an LLM rewrites it as a short, simple note for people who can't hear the audio.

Built in a few hours as a frontend-only MVP (React, TypeScript, Tailwind, PeerJS/WebRTC). The sections below explain how to run it, how it works, and how the full system would look.

**Two views, for phone and desktop:**
- **Member** (simple, hands busy): the latest AI note in a big banner, who's talking, a big push-to-talk button, and who's online as avatars in the top bar (a green ring around whoever is speaking). AI notes only: no transcripts, no lists to manage.
- **Dispatch** (the overview): the team and the shift log, the talk panel, and every note with its original words one click away (to catch AI mistakes). Three columns on desktop, a bottom tab bar (Team / Talk / Notes) on phones.

## How to run

Requires Node and Yarn, and Chrome (or Edge) for the microphone and speech recognition.

1. **Install and configure**

   ```bash
   yarn
   cp .env.example .env
   ```

   `.env` already points the app at a local signaling server (`VITE_PEERJS_HOST=localhost`, `VITE_PEERJS_PORT=9000`). Optionally add a Claude API key as `VITE_ANTHROPIC_API_KEY` for the AI notes; without it, everything else works the same.

2. **Start the signaling server** (terminal 1, leave it running)

   ```bash
   yarn peer:local
   ```

3. **Start the app** (terminal 2; restart it after any change to `.env`)

   ```bash
   yarn dev
   ```

4. **Open `http://localhost:5173` in two Chrome tabs**, with headphones on (tabs on one laptop share the speakers and the mic, which causes echo):
   - Tab 1: a name, channel `factory1`, role **Dispatch** → Join.
   - Tab 2: another name, the same channel, role **Member** → Join. Both tabs show "Hearing 1 person".
   - Hold "Hold to talk" in one tab and speak: the other tab hears you, and the transcript appears in Messages.

Without a local server (remove the two `VITE_PEERJS_…` lines from `.env`), the app uses the free PeerJS cloud server, which is shared and rate-limits when many peers connect in a short time.

### On several laptops (same Wi-Fi)

Browsers only allow the microphone on `https://` pages or `localhost`, so serve over HTTPS on the local network:

```bash
yarn dev:lan
```

Open the `Network: https://…` address it prints on every laptop. The certificate is self-signed, so the browser warns once: choose "Advanced → Proceed". With the local signaling server, set `VITE_PEERJS_HOST` to the IP of the laptop running `yarn peer:local` (instead of `localhost`), or remove it to use the cloud server.

## Tests

```bash
yarn playwright install chromium   # once
yarn test:e2e
```

End-to-end tests (Playwright) open real Chrome pages with a fake microphone (a test tone) and check the core flows: dispatch and members hear each other, a member waiting for dispatch, a duplicate dispatch being refused, "ended shift" vs "lost connection" in the shift log, members coming back when dispatch reopens the channel, push-to-talk, the AI notes, and that audio really reaches the others only while the button is held (measured with WebRTC's own statistics).

They start their own servers and need no internet: a local PeerJS signaling server (the official [`peer`](https://github.com/peers/peerjs-server) package) and the app pointed at it. The AI-note tests never call the real Claude API: the test app gets a fake key, the speech recognition is faked, and the request to Claude is intercepted, so they cost nothing.

## AI notes (the LLM part)

Each transmission is transcribed, then Claude rewrites it as a short, simple note shown to everyone, in a big banner and in the message feed. It is for people who are deaf or hard of hearing, have a speech impediment, or are somewhere too noisy to hear.

1. **Speech to text** runs on the speaker's laptop while they hold the button (browser Web Speech API, Chrome and Edge only).
2. **The transcript goes to Dispatch**, which calls Claude (`claude-haiku-5-5`, the fastest and cheapest model, at low effort: about $0.0001 per note) and shares the transcript, then the note, with everyone.
3. **The radio never depends on the AI:** without a key, or if the call fails, everyone still sees the transcript, and the note shows as unavailable.

The radio and the AI are separate pieces, put together only in `app.tsx`: `useChannel` (the radio) takes an optional `writeNote` function and knows nothing about speech recognition or Claude; `useTranscription` turns speech into text while you're on air; `lib/llm.ts` writes the note. Each works, and can be replaced, on its own.

The key is used from Dispatch's browser, so anyone who opens the page could read it: fine for a local demo, not for a public deployment (see the production architecture below).

## Architecture

### What is built (frontend-only MVP)

```
                 ┌──────────────────────────┐
                 │  PeerJS signaling server │   only introduces browsers to each other
                 │  (local or cloud)        │   (who is online, how to reach them)
                 └─────────────┬────────────┘
             setup only        │        setup only
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
  ┌───────────┐  voice   ┌───────────┐  voice   ┌───────────┐
  │  Member   │◀════════▶│ Dispatch  │◀════════▶│  Member   │
  │ (browser) │◀═══════════════ voice ═════════▶│ (browser) │
  └─────┬─────┘  text    └─────┬─────┘  text    └───────────┘
        │                      │ HTTPS
        │                      ▼
        │                 Claude API (AI notes)
        └── speech-to-text (Chrome Web Speech API)
```

- **Voice:** WebRTC media connections, peer-to-peer. Everyone calls everyone (a mesh), so every member hears every other member. The mic stays muted unless you hold the button.
- **Text** (roster, shift log, push-to-talk floor, transcripts, notes): WebRTC data channels, peer-to-peer, between each member and Dispatch. No server of our own, so no WebSocket.
- **Dispatch is the hub:** it has a fixed id per channel (`wt-<channel>-dispatch`), so members find it with just the channel code. It keeps the roster and the shift log, decides who holds the floor (one speaker at a time, first come first served), and is the only one calling Claude.
- **Robustness:** members wait and retry while Dispatch is offline, and come back automatically when it reopens the channel; a leaving member says "bye" (logged as "ended shift"), a dropped one is detected and logged as "lost connection"; if the speaker drops mid-sentence, the floor is freed.
- **Code:** `src/hooks/use-channel.ts` (the radio), `src/hooks/use-transcription.ts` (speech-to-text), `src/lib/llm.ts` (Claude), `src/lib/peer.ts` (PeerJS helpers), `src/lib/types.ts` (shared types and the zod-validated message protocol), `src/components/` (UI).

### The full system (production)

```
  Browsers / phone apps ──WebRTC voice──▶  SFU media server (LiveKit / mediasoup)
          │                                 + TURN servers for strict networks
          │ WebSocket (text, presence, floor)
          ▼
  Channel service ──▶ database (members, channels, history)
     │  auth, registered members, admin page
     ├──▶ speech-to-text service (self-hosted, e.g. Whisper)
     └──▶ Claude API (key on the server only): notes, shift summaries
```

- **Why each piece:** an SFU makes voice scale (each person sends one stream instead of one per listener); a WebSocket channel service gives history, delivery to people who were offline, and one trusted place for the floor and presence, so the channel no longer depends on Dispatch's browser tab; the backend holds the Claude key and runs private speech-to-text (Chrome's sends audio to Google, a real concern in a hospital).
- **Scaling:** channel services are stateless and share state through Redis pub/sub, so they scale horizontally behind a load balancer; SFUs are added per region; channels map to rooms, so a large organisation is many independent small rooms.
- WebRTC stays for voice (low latency, built-in echo cancellation and jitter handling), WebSocket for text: the conclusion in the [brainstorm](docs/brainstorm.md).

## If I had more time

- **Split `use-channel.ts`:** the hook does five jobs (connection, voice mesh, Dispatch hub, member link, feed) in ~650 lines. Plan: plain TypeScript modules per job (`connection.ts`, `voice-mesh.ts`, `dispatch-hub.ts`, `member-link.ts`) and a thin hook that only mirrors their state into React, each module unit-tested on its own; the e2e tests guard the behaviour during the split.
- **Admin page and registered members:** an admin creates channels and registers members ahead of time, so each person has a fixed id assigned once (not a random one per session). Only registered members can join a channel, and channel names are created and validated by the admin rather than typed freely (the MVP accepts any channel name, and PeerJS rejects names with characters outside `A-Z a-z 0-9 - _`). This needs a backend: a member registry, authentication, and a signaling server that checks membership before connecting peers.
- **A backend for the AI and the text messages:** a small server holds the Claude API key (never shipped to browsers) and makes the Claude call. A WebSocket service carries the text messages (transcripts, notes, roster, shift log) with history, so people who were offline catch up, while voice stays on WebRTC. The MVP is frontend-only, so text goes over WebRTC data channels between browsers instead.
- **Private speech-to-text:** Chrome's Web Speech API sends the audio to Google's servers to recognise it, which is a real concern in a hospital. Replace it with a self-hosted speech model (e.g. Whisper) on the backend, which would also work in every browser.
- **Note priority, suggested by the AI (designed, next step):** two levels. 🔴 **Urgent** (fire, injury, evacuation): red banner, stronger flash, the phone vibrates. 🟡 **Info** (good to know): the yellow banner of today. Claude already reads every message, so it also suggests the priority (a triage, not just a rewrite), using structured output so the answer is always `{ note, priority }`; Dispatch can change it.
- **Dispatch corrects shared notes (designed, next step):** notes keep going to members right away (fastest in an emergency); Dispatch can then edit the text, change the priority, or retract a note, and members' screens update. Chosen over "review before sharing", which would make members wait whenever Dispatch is busy.
- **More AI on the history:** shift summaries, "what did I miss?" questions, and detecting recurring issues (the same machine jamming every day).
- **Offline team members:** with registered members (below), Dispatch's team list also shows who is expected on shift but offline.
- **One-on-one with Dispatch:** a member talks privately to Dispatch without disturbing the main channel (the "two channels" idea in the brainstorm). Design: today one microphone stream feeds every call, so muting is all or nothing; private talk needs a copy of the mic per call (`stream.clone()`) to switch on only the connection to Dispatch, its own floor (a private conversation shouldn't block the main channel), and private messages kept out of the shared feed.
- **Dispatch priority / emergency override:** Dispatch (or an emergency button) takes the floor immediately, cutting off the current speaker. In the MVP everyone follows the same first-come rule, so an urgent message waits until the speaker releases.
- **Silent emergency message:** a premade text a member can send in danger, when they can't talk.
- **Push-to-talk extras:** a "go ahead" beep when the floor is granted, holding a key to talk, a queue (or a "someone is waiting" hint) when the channel is busy, and a maximum talk time so nobody holds the channel forever. Hands-free (stop when no voice is detected) is tempting, but people talking nearby would keep the channel open.
- **Sound quality:** tune the audio processing (noise suppression, gain, Opus bitrate) once tested on separate devices; the MVP uses Chrome's defaults with echo cancellation and noise suppression.
- **Scaling voice beyond a small team:** voice is a full mesh (every person sends their audio to every other person), so upload bandwidth grows with the group size; it works for a handful of people. For bigger channels, use an SFU media server (e.g. LiveKit or mediasoup): each person sends one stream to the server, which forwards it. Add TURN servers for strict corporate or hospital networks where direct peer-to-peer connections are blocked.
- **Admin-managed shifts:** Dispatch puts people on or off duty; members can't sign out themselves. (The browser can't stop anyone from closing a tab, so the MVP makes leaving deliberate, with a confirmation, and visible in the shift log.)
- **Drop alerts:** alert Dispatch when someone has been "lost connection" for more than ~2 minutes during a shift.
- **Rejoin after a drop:** a member who lost their own connection has to join again by hand (members already reconnect automatically when Dispatch comes back).
- **Channel without Dispatch:** in the MVP, Dispatch is the meeting point, so members can't find each other until Dispatch is online. Fix: numbered "seat" ids, or the channel service above.
