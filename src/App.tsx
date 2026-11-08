import { useState } from "react";

import { generateId } from "./lib/ids";
import { createPeer, memberPeerId } from "./lib/peer";
import { dispatchPeerId, isRole } from "./lib/types";

import type { ChangeEvent, JSX } from "react";
import type Peer from "peerjs";
import type {
  PeerInfo,
  Role,
  ShiftEvent,
  ShiftEventKind,
} from "./lib/types";

const shiftEventText = (event: ShiftEvent): string => {
  const who: string = `${event.peer.name} (${event.peer.id})`;
  switch (event.kind) {
    case "on-shift":
      return `${who} is on shift`;
    case "ended-shift":
      return `${who} ended shift`;
    case "lost-connection":
      return `⚠ ${who} lost connection`;
  }
};

// Temporary test screen for the PeerJS steps. The real UI comes later.
const App = (): JSX.Element => {
  const [name, setName] = useState<string>("");
  const [channel, setChannel] = useState<string>("factory1");
  const [role, setRole] = useState<Role>("member");
  const [peer, setPeer] = useState<Peer | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [shiftLog, setShiftLog] = useState<ShiftEvent[]>([]);

  // For now only our own events. In step 2, dispatch shares everyone's events.
  const addShiftEvent = (peerInfo: PeerInfo, kind: ShiftEventKind): void => {
    const event: ShiftEvent = {
      id: generateId(),
      peer: peerInfo,
      kind,
      at: Date.now(),
    };
    setShiftLog((previous: ShiftEvent[]): ShiftEvent[] => [...previous, event]);
  };

  const myInfo = (id: string): PeerInfo => ({ id, name, role });

  const join = async (): Promise<void> => {
    setErrorMessage("");
    try {
      const id: string =
        role === "dispatch" ? dispatchPeerId(channel) : memberPeerId(channel);
      const newPeer: Peer = await createPeer(id);
      setPeer(newPeer);
      addShiftEvent(myInfo(newPeer.id), "on-shift");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  // Leaving is deliberate: members end their shift, dispatch closes the channel for everyone.
  const leave = (): void => {
    if (peer === null) {
      return;
    }
    const question: string =
      role === "dispatch"
        ? "Close the channel? Everyone will be disconnected."
        : "End your shift? Dispatch will see you as off duty.";
    if (!window.confirm(question)) {
      return;
    }
    addShiftEvent(myInfo(peer.id), "ended-shift");
    // destroy() closes every connection and releases our id on the PeerJS server.
    peer.destroy();
    setPeer(null);
  };

  const handleRoleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const value: string = event.target.value;
    if (isRole(value)) {
      setRole(value);
    }
  };

  const isConnected: boolean = peer !== null;
  const canJoin: boolean = name !== "" && !isConnected;

  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-100 p-6 flex flex-col gap-3 max-w-sm">
      <h1 className="text-2xl font-bold">📻 Walkie-Talkie (test)</h1>
      <input
        className="bg-zinc-800 p-2 rounded"
        placeholder="Name"
        value={name}
        disabled={isConnected}
        onChange={(event: ChangeEvent<HTMLInputElement>): void =>
          setName(event.target.value)
        }
      />
      <input
        className="bg-zinc-800 p-2 rounded"
        placeholder="Channel"
        value={channel}
        disabled={isConnected}
        onChange={(event: ChangeEvent<HTMLInputElement>): void =>
          setChannel(event.target.value)
        }
      />
      <select
        className="bg-zinc-800 p-2 rounded"
        value={role}
        disabled={isConnected}
        onChange={handleRoleChange}
      >
        <option value="member">Member</option>
        <option value="dispatch">Dispatch</option>
      </select>
      {isConnected ? (
        <button className="bg-zinc-700 p-2 rounded font-bold" onClick={leave}>
          {role === "dispatch" ? "Close channel" : "End shift"}
        </button>
      ) : (
        <button
          className="bg-orange-600 p-2 rounded font-bold disabled:opacity-40"
          disabled={!canJoin}
          onClick={join}
        >
          Join
        </button>
      )}
      {peer !== null && (
        <p className="text-green-400">Connected as {peer.id}</p>
      )}
      {errorMessage !== "" && <p className="text-red-400">{errorMessage}</p>}

      <h2 className="text-lg font-bold mt-4">Shift log</h2>
      <ul className="flex flex-col gap-1 text-sm">
        {shiftLog.map(
          (event: ShiftEvent): JSX.Element => (
            <li key={event.id}>
              <span className="text-zinc-500">
                {new Date(event.at).toLocaleTimeString()}
              </span>{" "}
              {shiftEventText(event)}
            </li>
          ),
        )}
      </ul>
    </main>
  );
};

export default App;
