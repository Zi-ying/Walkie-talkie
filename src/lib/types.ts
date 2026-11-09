import { z } from "zod";

export const RoleSchema = z.enum(["member", "dispatch"]);
export type Role = z.infer<typeof RoleSchema>;

export const isRole = (value: string): value is Role =>
  RoleSchema.safeParse(value).success;

export const PeerInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: RoleSchema,
});
export type PeerInfo = z.infer<typeof PeerInfoSchema>;

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
  at: z.number(),
});
export type ShiftEvent = z.infer<typeof ShiftEventSchema>;

export const NoteStatusSchema = z.enum(["pending", "ready", "unavailable"]);
export type NoteStatus = z.infer<typeof NoteStatusSchema>;

export const NotePrioritySchema = z.enum(["urgent", "info"]);
export type NotePriority = z.infer<typeof NotePrioritySchema>;

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
  priority: NotePrioritySchema,
  at: z.number(),
});
export type FeedItem = z.infer<typeof FeedItemSchema>;

export const WireMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), peer: PeerInfoSchema }),
  z.object({ type: z.literal("bye") }),
  z.object({ type: z.literal("roster"), peers: z.array(PeerInfoSchema) }),
  z.object({ type: z.literal("shift-log"), events: z.array(ShiftEventSchema) }),
  z.object({ type: z.literal("shift-event"), event: ShiftEventSchema }),
  z.object({ type: z.literal("talk-request") }),
  z.object({ type: z.literal("talk-release") }),
  z.object({ type: z.literal("floor"), speakerId: z.string().nullable() }),
  z.object({ type: z.literal("transcript"), text: z.string() }),
  z.object({ type: z.literal("feed-item"), item: FeedItemSchema }),
  z.object({ type: z.literal("feed"), items: z.array(FeedItemSchema) }),
]);
export type WireMessage = z.infer<typeof WireMessageSchema>;

export type ChannelStatus =
  | "idle"
  | "connecting"
  | "waiting-dispatch"
  | "ready";

export type ChannelApi = {
  status: ChannelStatus;
  errorMessage: string;
  me: PeerInfo | null;
  roster: PeerInfo[];
  shiftLog: ShiftEvent[];
  hearingCount: number;
  speaker: PeerInfo | null;
  isTalking: boolean;
  feed: FeedItem[];
  join: (name: string, channel: string, role: Role) => Promise<void>;
  leave: () => Promise<void>;
  startTalking: () => void;
  stopTalking: () => void;
  submitTranscript: (text: string) => void;
};

export const dispatchPeerId = (channel: string): string =>
  `wt-${channel}-dispatch`;
