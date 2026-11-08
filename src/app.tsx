import { ChannelScreen } from "@/components/channel-screen";
import { JoinScreen } from "@/components/join-screen";
import { useChannel } from "@/hooks/use-channel";
import { useTranscription } from "@/hooks/use-transcription";
import { isLlmAvailable, writeSimpleNote } from "@/lib/llm";

import type { JSX } from "react";
import type { ChannelApi, Role } from "@/lib/types";

const App = (): JSX.Element => {
  // The radio, the speech-to-text and the AI are separate pieces, put together only here.
  // Without an API key, no note writer is given and the radio works the same, without notes.
  const channelApi: ChannelApi = useChannel({
    writeNote: isLlmAvailable() ? writeSimpleNote : undefined,
  });
  useTranscription(channelApi.isTalking, channelApi.submitTranscript);

  const isOnChannel: boolean = channelApi.status !== "idle";
  const isDispatch: boolean = channelApi.me !== null && channelApi.me.role === "dispatch";

  const join = (name: string, channel: string, role: Role): void => {
    void channelApi.join(name, channel, role);
  };

  // Leaving is deliberate: members end their shift, dispatch closes the channel for everyone.
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
  return <ChannelScreen channelApi={channelApi} onLeave={leave} />;
};

export default App;
