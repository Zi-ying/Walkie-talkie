// Contract between the UI and the channel implementation (mock or PeerJS).
// The UI only ever talks to `ChannelApi`, so both halves can be built in parallel.

export type Role = 'member' | 'dispatch'

export type PeerInfo = {
  id: string // PeerJS id, e.g. "wt-factory1-dispatch"
  name: string // display name
  role: Role
}

export type FeedItem = {
  id: string // lets the AI note be attached later
  from: string // speaker's display name
  transcript: string // what speech-to-text heard
  note?: string // AI-simplified version, arrives after the transcript
  at: number // epoch ms
}

export type ChannelStatus = 'idle' | 'connecting' | 'waiting-dispatch' | 'ready' | 'error'

export type ChannelApi = {
  status: ChannelStatus
  error?: string
  channel: string | null
  me: PeerInfo | null
  roster: PeerInfo[] // everyone on the channel, including me
  speaker: PeerInfo | null // who holds the floor (one speaker at a time), null = free
  feed: FeedItem[] // oldest first
  join(name: string, channel: string, role: Role): Promise<void>
  leave(): void
  startTalking(): boolean // false when someone else holds the floor
  stopTalking(): void
  addTranscript(text: string): string // returns the new item id
  addNote(itemId: string, note: string): void
}

// Messages sent over PeerJS data connections. Voice goes over media calls, not here.
export type WireMessage =
  | { type: 'hello'; peer: PeerInfo } // member → dispatch
  | { type: 'roster'; peers: PeerInfo[] } // dispatch → everyone
  | { type: 'ptt-start'; from: string } // peer id
  | { type: 'ptt-stop'; from: string }
  | { type: 'transcript'; item: FeedItem }
  | { type: 'note'; id: string; note: string }

// Dispatch is the meeting point: a predictable id members can find with just the channel code.
export const dispatchPeerId = (channel: string) => `wt-${channel}-dispatch`
