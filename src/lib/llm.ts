import Anthropic from "@anthropic-ai/sdk";

// Turns a radio transcript into a short, simple note for people who can't hear the audio.
// Haiku: fastest and cheapest model; plenty for one-sentence notes.
const MODEL: Anthropic.Model = "claude-haiku-5-5";

const SYSTEM_PROMPT: string = `You turn walkie-talkie transcripts into short written notes for teammates who cannot hear the audio: people who are deaf or hard of hearing, or who are in a noisy place. The transcript comes from automatic speech recognition, so it may contain filler words or small recognition mistakes.

Write the note so it can be read in two seconds:
- At most 12 words, plain and direct, no filler.
- Keep every name, number, room, line and location.
- Do not add facts, advice or guesses that are not in the transcript.
- If the transcript is empty or makes no sense, reply exactly: Unclear message.

Reply with the note only.`;

// Frontend-only MVP: the key lives in the browser (.env, VITE_ANTHROPIC_API_KEY), so anyone who
// opens the page could read it. Fine for a local demo; in production a backend would hold it.
const envApiKey: string | undefined = import.meta.env.VITE_ANTHROPIC_API_KEY;
const apiKey: string = envApiKey === undefined ? "" : envApiKey;

const client: Anthropic | null =
  apiKey === "" ? null : new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

export const isLlmAvailable = (): boolean => client !== null;

// Resolves with the note, or null when there is no key or the call fails (the radio never
// depends on the AI: everyone still sees the transcript).
export const writeSimpleNote = async (transcript: string): Promise<string | null> => {
  if (client === null) {
    return null;
  }
  try {
    const response: Anthropic.Message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" }, // a one-line rewrite needs little thinking
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `<transcript>${transcript}</transcript>` }],
    });
    if (response.stop_reason === "refusal") {
      return null;
    }
    const note: string = response.content
      .map((block: Anthropic.ContentBlock): string => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    return note === "" ? null : note;
  } catch (error: unknown) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.warn("Claude: invalid API key (check VITE_ANTHROPIC_API_KEY in .env)");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.warn("Claude: rate limited, try again in a moment");
    } else if (error instanceof Anthropic.APIError) {
      console.warn(`Claude: API error ${error.status}`, error.message);
    } else {
      console.warn("Claude: request failed", error);
    }
    return null;
  }
};
