import { useState } from "react";

import { DispatchView } from "@/components/dispatch-view";
import { JoinScreen } from "@/components/join-screen";
import { MemberView } from "@/components/member-view";
import { useChannel } from "@/hooks/use-channel";
import { useTranscription } from "@/hooks/use-transcription";
import { isLlmAvailable, writeSimpleNote } from "@/lib/llm";

import type { JSX } from "react";
import type { ChannelApi, Role } from "@/lib/types";

const App = (): JSX.Element => {
  const channelApi: ChannelApi = useChannel({
    writeNote: isLlmAvailable() ? writeSimpleNote : undefined,
  });
  useTranscription(channelApi.isTalking, channelApi.submitTranscript);

  const [channelName, setChannelName] = useState<string>("");
  const [role, setRole] = useState<Role>("member");

  const isOnChannel: boolean = channelApi.status !== "idle";
  const isDispatch: boolean = role === "dispatch";

  const join = (name: string, channel: string, joinedRole: Role): void => {
    setChannelName(channel);
    setRole(joinedRole);
    void channelApi.join(name, channel, joinedRole);
  };

  const leave = (): void => {
    const question: string = isDispatch
      ? "Close the channel? Everyone will be disconnected."
      : "End your shift? Dispatch will see you as off duty.";
    if (window.confirm(question)) {
      void channelApi.leave();
    }
  };

  if (!isOnChannel) {
    return <JoinScreen errorMessage={channelApi.errorMessage} onJoin={join} />;
  }
  if (isDispatch) {
    return <DispatchView channelApi={channelApi} channelName={channelName} onLeave={leave} />;
  }
  return <MemberView channelApi={channelApi} channelName={channelName} onLeave={leave} />;
};

export default App;
