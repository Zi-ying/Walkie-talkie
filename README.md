# 📻 Walkie-Talkie

A push-to-talk radio in the browser for teams without reliable phone coverage (factories, hospitals). One group channel, a Dispatch view and a simple member view. Every transmission is transcribed, and an LLM rewrites it as a short, simple note for people who can't hear the audio.

## How to run

```bash
yarn
cp .env.example .env   # add your Claude API key
yarn dev
```

Open two Chrome tabs: one as Dispatch, one as Member, on the same channel code.

## Architecture

_To be written._

## If I had more time

- **Admin page and registered members:** an admin creates channels and registers members ahead of time, so each person has a fixed id assigned once (not a random one per session). Only registered members can join a channel, and channel names are created and validated by the admin rather than typed freely (the MVP accepts any channel name, and PeerJS rejects names with characters outside `A-Z a-z 0-9 - _`). This needs a backend: a member registry, authentication, and a signaling server that checks membership before connecting peers.
- **Admin-managed shifts:** Dispatch puts people on or off duty; members can't sign out themselves. (The browser can't stop anyone from closing a tab, so the MVP makes leaving deliberate, with a confirmation, and visible in the shift log.)
- **Drop alerts:** alert Dispatch when someone has been "lost connection" for more than ~2 minutes during a shift.
- **Auto-reconnect** when the signal comes back.
- **Channel without Dispatch:** in the MVP, Dispatch is the meeting point, so members can't find each other until Dispatch is online. Fix: numbered "seat" ids, or a small signaling/presence server.
