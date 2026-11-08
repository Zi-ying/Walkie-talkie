# Walkie-talkie brainstorm

Sophie's own thoughts, 3 Nov 2026. Stored as she wrote them, with only small typo fixes. Add new thoughts at the bottom with the date.

## Where it is useful

- Useful in zones that have no coverage of wifi, 5G, 4G, etc.

## Limits

- Limited range: 1 or 2 miles depending on the geography.
- Need a bigger setup or a licence to increase range.

## Factories

- Still used in factories.
- Easier and faster to communicate in factories.
- Used to talk to a group, not just one on one, personally.
- No distractions compared to a phone.
- In an emergency, it is way faster to press a button than to find somebody to call (besides 911).
- Can't silence a radio?
- Stronger energy hold.

## Health care

- Pros: hacks, or data privacy, or no zone coverage.
- A lot of nurses complain about no zone coverage.

## LLM

- See the transcription of the talk?
- Taking notes?
- Asking questions that were missed?
- Detect recurrent issues?

## Calls that get filtered (added 3 Nov 2026)

- Avoids calls being filtered. Example in a hospital: nurses call doctors in an emergency, and the doctor filters the call or doesn't want to answer.
- Pagers are no longer used.
- For emergencies, police officers use walkie-talkies (to verify).

## Work and personal life (added 3 Nov 2026)

- Allows separating professional life and personal life.

## Dispatch (added 3 Nov 2026)

- A dispatch when there are many calls, like the 15 or the 112.

## Fewer intermediaries (added 3 Nov 2026)

- The fewer intermediaries, the better.

## Criticism (added 3 Nov 2026)

- Constant disturbance. But it could allow prioritizing.

## Two channels (added 3 Nov 2026)

- There should be two channels: one shared or per group, and one individual.

## Priority (added 4 Nov 2026)

- Emergency should have priority. So some channels should have priority settings.

## Admin interface (added 4 Nov 2026)

- We need an admin interface.

## Starting point (added 4 Nov 2026)

- Using a radio should come first: receiving and emitting calls.

## Accessibility and AI notes (added 4 Nov 2026)

- It should be friendly to people who cannot hear others, or who have a speech impediment, with small banners showing basic information noted down from the call.
- AI should do that with a prompt: translate the communication from the admin (dispatch) into simple, direct, short words. Something like that.
- A note could be validated.

## Note validation and two interfaces (added 4 Nov 2026)

- The note could first be validated by the dispatch, or edited.
- Remember it needs to be easy to use.
- There should be a "simple" user usage versus an "admin" user interface.

## Voice stop word (added 4 Nov 2026)

- AI should be able to stop the communication when the word "over" is pronounced, in case the person cannot access their device.
- Criticism: it needs to be very specific, if not it might cut the conversation (quite "clicky").

## WebRTC and WebSocket (added 4 Nov 2026)

Sophie's conclusions:

- WebRTC should be used for direct communication (voice).
- WebSocket should be used for instant text transmissions.
- Ideally we would need both.
- Smallest working version: to be written by Sophie.

Learned in conversation, to verify (MDN WebRTC pages, the DEV Community article on WebRTC):

- WebRTC is not limited to one peer. Groups work through a mesh (everyone connects to everyone, only for small groups) or through a media server (often called an SFU).
- WebRTC needs a signaling step to set up a connection. A WebSocket is a common way to carry those setup messages.
- WebRTC also has data channels for text and other data.
- A WebSocket can carry voice as audio chunks, but it runs over TCP and has no built-in handling of echo, jitter or compression.

## Linking hardware and software

- How to link a physical walkie-talkie to a software app? (added 3 Nov 2026)

## Phone precedence

- Could the walkie-talkie on the phone take precedence? Just like when there is a national emergency?
- Specific sounds and screens?

## Push-to-talk UX (added 8 Nov 2026)

- Future: press a key to talk.
- It can be annoying to have to keep pressing, but it's mandatory so people won't keep the line on.
- Check a better UX for that in the future. Like if we detect no voice, then it should turn off.
- Criticism: what if people around are talking but not to the channel? Then it would never stop.

## Silent emergency message (added 8 Nov 2026)

- A user could send a premade text in case of danger, when they cannot talk.
