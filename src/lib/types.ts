import { z } from "zod";

// Data shapes are zod schemas: they validate what arrives over the network (typed `unknown`),
// and the TypeScript types are derived from them, so both always match.

export const RoleSchema = z.enum(["member", "dispatch"]);
export type Role = z.infer<typeof RoleSchema>;

// Type guard: lets TypeScript treat a plain string (e.g. from a <select>) as a Role without `as`.
export const isRole = (value: string): value is Role =>
  RoleSchema.safeParse(value).success;

export const PeerInfoSchema = z.object({
  id: z.string(), // PeerJS id, e.g. "wt-ward3-dispatch"
  name: z.string(), // display name
  role: RoleSchema,
});
export type PeerInfo = z.infer<typeof PeerInfoSchema>;

// "ended-shift" = left on purpose (sent a bye), "lost-connection" = dropped without a bye.
export const ShiftEventKindSchema = z.enum([
  "on-shift",
  "ended-shift",
  "lost-connection",
]);
export type ShiftEventKind = z.infer<typeof ShiftEventKindSchema>;

export const ShiftEventSchema = z.object({
  id: z.string(),
  peer: PeerInfoSchema,
  kind: ShiftEventKindSchema,
  at: z.number(), // epoch ms
});
export type ShiftEvent = z.infer<typeof ShiftEventSchema>;

// One transmission in the feed: what was said, then the AI's short note (filled in by dispatch).
// "pending" = Claude is writing it, "unavailable" = no API key or the call failed.
export const NoteStatusSchema = z.enum(["pending", "ready", "unavailable"]);
export type NoteStatus = z.infer<typeof NoteStatusSchema>;

// "urgent" = danger to people or production right now (red banner), "info" = good to know.
export const NotePrioritySchema = z.enum(["urgent", "info"]);
export type NotePriority = z.infer<typeof NotePrioritySchema>;

// What Claude returns for one transcript (structured output, so it always has this shape).
export const SimpleNoteSchema = z.object({
  note: z.string(),
  priority: NotePrioritySchema,
});
export type SimpleNote = z.infer<typeof SimpleNoteSchema>;

export const FeedItemSchema = z.object({
  id: z.string(),
  speaker: PeerInfoSchema,
  transcript: z.string(),
  note: z.string(),
  noteStatus: NoteStatusSchema,
  priority: NotePrioritySchema, // set by the AI with the note; "info" until then
  at: z.number(), // epoch ms
});
export type FeedItem = z.infer<typeof FeedItemSchema>;

// Messages sent over PeerJS data connections. Voice goes over media calls, not here.
export const WireMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), peer: PeerInfoSchema }), // member → dispatch
  z.object({ type: z.literal("bye") }), // either side, just before leaving
  z.object({ type: z.literal("roster"), peers: z.array(PeerInfoSchema) }), // dispatch → everyone
  z.object({ type: z.literal("shift-log"), events: z.array(ShiftEventSchema) }), // dispatch → newcomer
  z.object({ type: z.literal("shift-event"), event: ShiftEventSchema }), // dispatch → everyone
  // Push-to-talk: dispatch decides who holds the floor (one speaker at a time, first come first served).
  z.object({ type: z.literal("talk-request") }), // member → dispatch
  z.object({ type: z.literal("talk-release") }), // member → dispatch
  z.object({ type: z.literal("floor"), speakerId: z.string().nullable() }), // dispatch → everyone
  // Transcripts and AI notes: members send what they said, dispatch adds the note and shares the item.
  z.object({ type: z.literal("transcript"), text: z.string() }), // member → dispatch
  z.object({ type: z.literal("feed-item"), item: FeedItemSchema }), // dispatch → everyone (new or updated)
  z.object({ type: z.literal("feed"), items: z.array(FeedItemSchema) }), // dispatch → newcomer
]);
export type WireMessage = z.infer<typeof WireMessageSchema>;

export type ChannelStatus =
  | "idle"
  | "connecting"
  | "waiting-dispatch"
  | "ready";

// What the useChannel hook gives the UI.
export type ChannelApi = {
  status: ChannelStatus;
  errorMessage: string;
  me: PeerInfo | null;
  roster: PeerInfo[]; // everyone on the channel, including me
  shiftLog: ShiftEvent[]; // oldest first, written by dispatch
  hearingCount: number; // how many people's audio we are receiving
  speaker: PeerInfo | null; // who holds the floor, null = channel free
  isTalking: boolean; // I hold the floor and my mic is on
  feed: FeedItem[]; // transmissions with their AI notes, oldest first
  join: (name: string, channel: string, role: Role) => Promise<void>;
  leave: () => Promise<void>;
  startTalking: () => void; // press: asks for the floor, ignored if someone else holds it
  stopTalking: () => void; // release
  submitTranscript: (text: string) => void; // what I just said, as text (shared with everyone)
};

// Dispatch is the meeting point: a predictable id members can find with just the channel code.
export const dispatchPeerId = (channel: string): string =>
  `wt-${channel}-dispatch`;
