import { useState } from "react";

import { RoleCard } from "@/components/role-card";

import type { ChangeEvent, FormEvent, JSX } from "react";
import type { Role } from "@/lib/types";

interface JoinScreenProps {
  errorMessage: string;
  onJoin: (name: string, channel: string, role: Role) => void;
}

export const JoinScreen = ({ errorMessage, onJoin }: JoinScreenProps): JSX.Element => {
  const [name, setName] = useState<string>("");
  const [channel, setChannel] = useState<string>("ward3");
  const [role, setRole] = useState<Role>("member");

  const isMember: boolean = role === "member";
  const isDispatch: boolean = role === "dispatch";
  const canJoin: boolean = name.trim() !== "" && channel.trim() !== "";
  const hasError: boolean = errorMessage !== "";

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setName(event.target.value);
  };

  const handleChannelChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setChannel(event.target.value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (canJoin) {
      onJoin(name.trim(), channel.trim(), role);
    }
  };

  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <form
        className="w-full max-w-sm flex flex-col gap-5 md:rounded-2xl md:bg-zinc-900 md:p-8 md:shadow-xl"
        onSubmit={handleSubmit}
      >
        <header className="flex flex-col items-center gap-1">
          <span className="text-5xl">📻</span>
          <h1 className="text-2xl font-bold">Walkie-Talkie</h1>
          <p className="text-sm text-zinc-400">Push to talk with your team</p>
        </header>

        <label className="flex flex-col gap-1 text-sm" htmlFor="join-name">
          Your name
          <input
            id="join-name"
            className="rounded-lg bg-zinc-800 p-3 text-base"
            placeholder="e.g. Bob"
            autoComplete="name"
            value={name}
            onChange={handleNameChange}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm" htmlFor="join-channel">
          Channel
          <input
            id="join-channel"
            className="rounded-lg bg-zinc-800 p-3 text-base"
            value={channel}
            onChange={handleChannelChange}
          />
        </label>

        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Role">
          <RoleCard role="member" isSelected={isMember} onSelect={setRole} />
          <RoleCard role="dispatch" isSelected={isDispatch} onSelect={setRole} />
        </div>

        {hasError && <p className="text-sm text-red-400">{errorMessage}</p>}

        <button
          type="submit"
          className="rounded-lg bg-orange-600 p-3 font-bold disabled:opacity-40"
          disabled={!canJoin}
        >
          Join channel
        </button>
      </form>
    </main>
  );
};
