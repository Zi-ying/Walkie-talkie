# 📻 Walkie-Talkie

A push-to-talk radio in the browser for care teams (hospitals, care homes).

- Nurses and doctors join a channel with a code. One person is **Dispatch**, the others are **members**.
- Hold the button to talk. One speaker at a time.
- Every message is transcribed, and Claude turns it into a short note for people who can't hear the audio.
- Claude also flags urgent messages (a fall, someone not breathing) in red.

Frontend-only MVP: React, TypeScript, Tailwind, PeerJS (WebRTC), Claude API.

Not deployed on purpose: the MVP calls Claude from the browser, so a public site would expose the API key. It runs locally (see below); in production, the key moves to a backend (see Architecture).

## How to start

You need Node, Yarn and Chrome (or Edge).

1. Install and configure:

   ```bash
   yarn
   cp .env.example .env
   ```

   - `.env` already points to a local signaling server.
   - Optional: add a Claude API key as `VITE_ANTHROPIC_API_KEY` for the AI notes. Without it, the radio works the same.

2. Start the signaling server (terminal 1, leave it running):

   ```bash
   yarn peer:local
   ```

3. Start the app (terminal 2, restart it after any change to `.env`):

   ```bash
   yarn dev
   ```

4. Open `http://localhost:5173` in two Chrome tabs, **with headphones** (two tabs on one laptop share the speakers and the mic, which causes echo):
   - Tab 1: a name, channel `ward3`, role **Dispatch** → Join.
   - Tab 2: another name, the same channel, role **Member** → Join.
   - Both tabs show "Connected" and each other's avatar. Hold "Hold to talk" and speak.

Good to know:

- Speech recognition listens in the browser's language. With Chrome set to French, speak French.
- Without the two `VITE_PEERJS_…` lines in `.env`, the app uses the free PeerJS cloud server (shared, and rate-limited).

### On several laptops (same Wi-Fi)

- Browsers only allow the microphone on `https://` or `localhost`.
- Run `yarn dev:lan` and open the `Network: https://…` address on every laptop.
- The certificate is self-signed: choose "Advanced → Proceed" once.
- Set `VITE_PEERJS_HOST` to the IP of the laptop running `yarn peer:local`.

## Tests

```bash
yarn playwright install chromium   # once
yarn test:e2e
```

- 15 end-to-end tests (Playwright) with real Chrome pages and a fake microphone.
- They check: joining, everyone hearing everyone with three people, waiting for Dispatch, a duplicate Dispatch refused, "ended shift" vs "lost connection", reconnecting, push-to-talk, AI notes (normal, urgent, Claude failing, late joiner).
- One test measures that audio really reaches the others only while the button is held (WebRTC statistics).
- They start their own servers and never call the real Claude API (fake key, faked speech recognition, intercepted request). They cost nothing.

## The two views

- **Member** (hands busy): the latest note in a big banner, who's talking, a big talk button, who's online as avatars. Notes only, no transcripts.
- **Dispatch** (overview): the team and the shift log, the talk panel, every note with its priority and its original words (to catch AI mistakes).
- Dispatch has three columns on wide screens, and tabs on narrow ones.

## AI notes

- **Who it's for:** people who are deaf or hard of hearing, have a speech impediment, or are somewhere too noisy.
- **Speech to text:** in the speaker's browser while they hold the button (Web Speech API, Chrome and Edge only).
- **The note:** Dispatch sends the transcript to Claude (`claude-haiku-5-5`, low effort, about $0.0001 per note), then shares the note with everyone.
- **Triage:** Claude also returns a priority. 🔴 Urgent: red banner, stronger flash, screen readers interrupt. 🟡 Info: amber banner.
- **Structured output:** the answer is always `{ note, priority }` (a zod schema), never free text to parse.
- **"When in doubt, choose info":** too many false red alarms would teach people to ignore red.
- **The radio never depends on the AI:** without a key, or if Claude fails, everyone still hears the message, and Dispatch still sees the transcript (marked "AI note unavailable").
- **Decoupled:** `useChannel` (the radio) takes an optional `writeNote` function and knows nothing about Claude. Everything is put together only in `app.tsx`.

Tested with a real key, which caught two things the mocked tests couldn't:

- "Hello" came back as "Unclear message." Fixed in the prompt: short radio messages ("yes", "on my way") stay as they are.
- English spoken with Chrome set to French was transcribed as French (see "If I had more time").

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

- **Voice:** WebRTC calls, peer-to-peer. Everyone calls everyone (a mesh). The mic is muted unless you hold the button.
- **Text** (roster, shift log, floor, notes): WebRTC data channels between each member and Dispatch. No server of our own, so no WebSocket.
- **Dispatch is the hub:** a fixed id per channel (`wt-<channel>-dispatch`), so members find it with just the channel code. It keeps the roster and the shift log, decides who talks (first come, first served), and is the only one calling Claude.
- **Robustness:** members wait while Dispatch is offline and come back when it returns. Leaving says "bye" ("ended shift"), a drop is detected ("lost connection"). If the speaker drops mid-sentence, the floor is freed.
- **Code:** `src/hooks/use-channel.ts` (the radio), `src/hooks/use-transcription.ts` (speech to text), `src/lib/llm.ts` (Claude), `src/lib/peer.ts` (PeerJS helpers), `src/lib/types.ts` (types and the zod message protocol), `src/components/` (UI).

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

- **WebRTC for voice** (low latency, echo cancellation, jitter handling), **WebSocket for text**: the conclusion of the [brainstorm](docs/brainstorm.md).
- **SFU:** each person sends one stream to the server instead of one per listener.
- **Channel service:** history, delivery to people who were offline, one trusted place for the floor and presence (no longer Dispatch's browser tab).
- **Backend:** holds the Claude key and runs private speech-to-text.

## If I had more time

### Refactoring

- **Split `use-channel.ts`** (~600 lines, five jobs: connection, voice mesh, Dispatch hub, member link, feed). Plain TypeScript modules per job, a thin React hook on top, unit tests per module. The e2e tests guard the split.

### Features

- **Dispatch corrects shared notes:** notes go out right away (fastest in an emergency), then Dispatch can edit, change the priority, or retract. Chosen over "review before sharing", which makes members wait.
- **One-on-one with Dispatch:** talk privately without disturbing the channel. Needs a copy of the mic per call (`stream.clone()`), its own floor, and private messages kept out of the shared feed.
- **Emergency override:** Dispatch (or an emergency button) takes the floor right away, cutting off the current speaker.
- **Silent emergency message:** a premade text a member can send when they can't talk.
- **Push-to-talk extras:** a "go ahead" beep, a key to talk, a queue when the channel is busy, a maximum talk time.
- **Choose the speaking language** on the join screen (care teams are often multilingual).
- **Fold Dispatch's notes** into a dropdown, like the team list and the shift log.
- **Offline team members:** show who is expected on shift but offline (needs registered members).

### AI

- **Private speech-to-text:** Whisper on a backend instead of Chrome's recognition. Handles accents much better, and works in every browser.
- **More AI on the history:** shift summaries, "what did I miss?", recurring issues (the same resident falling every night).
- **Check the triage prompt** against a set of real transcripts.

### Security and privacy

- **The Claude key is in the browser** (fine for a local demo only). Move it to a backend.
- **Chrome's speech recognition sends audio to Google:** a real concern in a hospital (see Whisper above).
- **Admin page and registered members:** an admin creates channels and registers members, each with a fixed id. Today anyone with the channel code can join.
- **Admin-managed shifts:** Dispatch puts people on or off duty, instead of members signing out themselves.

### Scaling

- **Voice:** the mesh works for a handful of people. Bigger channels need an SFU (LiveKit, mediasoup).
- **Text:** a WebSocket channel service with a database. Stateless services sharing state through Redis pub/sub, behind a load balancer.
- **Channels as rooms:** a large organisation is many small independent rooms.

### Real radios and pagers

- **Work with the hardware hospitals already have**, not just phones and laptops.
- **Walkie-talkies:** a radio gateway (Radio over IP) connects a real radio channel to an app channel. Voice from the radio is heard in the app, and the app's voice goes out on the radio.
- **Pagers:** urgent notes are also sent as a page, through the hospital's paging system. A doctor who only carries a pager still gets "Fall, room 12".
- **Needs the backend:** the gateways talk to the channel service, not to browsers directly.

### Reliability

- **Test on real phones:** the layout adapts to narrow screens and urgent notes ask the device to vibrate, but only laptops were tested.
- **Channel without Dispatch:** members can't find each other until Dispatch is online. Fix: the channel service above.
- **Rejoin after a drop:** a member who lost their connection joins again by hand.
- **Drop alerts:** warn Dispatch when someone has been "lost connection" for more than ~2 minutes.
- **Sound quality:** tune noise suppression, gain and bitrate once tested on separate devices.

## How I worked

- Built in about 5 hours with Claude Code as a pair programmer, in small steps, each explained before it was written and committed by me.
- **What I decided:** the product (care teams, Dispatch as the hub, two views, AI notes for accessibility, urgent triage), the scope (what went into "If I had more time"), and the code standards (explicit types, no abbreviations, one component per mapped item, kebab-case files).
- **What I delegated:** most of the typing, the test scaffolding, and the README drafts.
- **How I checked it:** I tested every step by hand, asked for real end-to-end tests early, refused a mock radio ("it's supposed to work"), kept the radio decoupled from the AI, and ran the real Claude API at the end.

### Time log

**Session 1: thinking and research (40 min)**

- Read the task PDF.
- Brainstormed: uses, limits, factories, health care, LLM ideas, filtered calls, dispatch, two channels, priority, admin interface, radio layer first, accessibility and AI notes, note validation, "over" stop word.
- Researched WebRTC vs WebSocket and libraries, and chose PeerJS.
- Set the plan: about 4 hours, smallest working version.

**Session 2: building (1h49)**

- The radio: channel, Dispatch hub, voice, push-to-talk, tests.

**Session 3: building (1h13)**

- AI notes, member and Dispatch views.

**Session 4: building, testing and reviewing (from 08:28, add the stop time)**

- Urgent triage, healthcare setting, real Claude test, cleanup, README.
