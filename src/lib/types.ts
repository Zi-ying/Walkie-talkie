import { z } from "zod";

// Data shapes are zod schemas: they validate what arrives over the network (typed `unknown`),
// and the TypeScript types are derived from them, so both always match.

export const RoleSchema = z.enum(["member", "dispatch"]);
export type Role = z.infer<typeof RoleSchema>;

// Type guard: lets TypeScript treat a plain string (e.g. from a <select>) as a Role without `as`.
export const isRole = (value: string): value is Role =>
  RoleSchema.safeParse(value).success;

export const PeerInfoSchema = z.object({
  id: z.string(), // PeerJS id, e.g. "wt-factory1-dispatch"
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

// Messages sent over PeerJS data connections. Voice goes over media calls, not here.
export const WireMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), peer: PeerInfoSchema }), // member → dispatch
  z.object({ type: z.literal("bye") }), // either side, just before leaving
  z.object({ type: z.literal("roster"), peers: z.array(PeerInfoSchema) }), // dispatch → everyone
  z.object({ type: z.literal("shift-log"), events: z.array(ShiftEventSchema) }), // dispatch → newcomer
  z.object({ type: z.literal("shift-event"), event: ShiftEventSchema }), // dispatch → everyone
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
  join: (name: string, channel: string, role: Role) => Promise<void>;
  leave: () => Promise<void>;
};

// Dispatch is the meeting point: a predictable id members can find with just the channel code.
export const dispatchPeerId = (channel: string): string =>
  `wt-${channel}-dispatch`;
