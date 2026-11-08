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

End-to-end tests (Playwright) open real Chrome pages with a fake microphone and check the core flows: dispatch and member hear each other, a member waiting for dispatch, a duplicate dispatch being refused, "ended shift" vs "lost connection" in the shift log, and members coming back when dispatch reopens the channel. They go through the public PeerJS cloud server, so they need internet access, and each test uses its own random channel.

## Architecture

_To be written._

## If I had more time

- **Admin page and registered members:** an admin creates channels and registers members ahead of time, so each person has a fixed id assigned once (not a random one per session). Only registered members can join a channel, and channel names are created and validated by the admin rather than typed freely (the MVP accepts any channel name, and PeerJS rejects names with characters outside `A-Z a-z 0-9 - _`). This needs a backend: a member registry, authentication, and a signaling server that checks membership before connecting peers.
- **Dispatch priority / emergency override:** Dispatch (or an emergency button) takes the floor immediately, cutting off the current speaker. In the MVP everyone follows the same first-come rule, so an urgent message waits until the speaker releases.
- **Push-to-talk extras:** a "go ahead" beep when the floor is granted, holding the spacebar to talk, a queue (or a "someone is waiting" hint) when the channel is busy, and a maximum talk time so nobody holds the channel forever.
- **Scaling voice beyond a small team:** voice is a full mesh (every person sends their audio to every other person), so upload bandwidth grows with the group size; it works for a handful of people. For bigger channels, use an SFU media server (e.g. LiveKit or mediasoup): each person sends one stream to the server, which forwards it. Add TURN servers for strict corporate or hospital networks where direct peer-to-peer connections are blocked.
- **Admin-managed shifts:** Dispatch puts people on or off duty; members can't sign out themselves. (The browser can't stop anyone from closing a tab, so the MVP makes leaving deliberate, with a confirmation, and visible in the shift log.)
- **Drop alerts:** alert Dispatch when someone has been "lost connection" for more than ~2 minutes during a shift.
- **Auto-reconnect** when the signal comes back.
- **Channel without Dispatch:** in the MVP, Dispatch is the meeting point, so members can't find each other until Dispatch is online. Fix: numbered "seat" ids, or a small signaling/presence server.
