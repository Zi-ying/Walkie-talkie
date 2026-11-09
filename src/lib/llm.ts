import { SimpleNoteSchema } from "@/lib/types";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import type { ParsedMessage } from "@anthropic-ai/sdk/lib/parser";
import type { SimpleNote } from "@/lib/types";

const MODEL: Anthropic.Model = "claude-haiku-5-5";

const SYSTEM_PROMPT: string = `You turn walkie-talkie transcripts from care teams (hospitals, care homes) into short written notes for teammates who cannot hear the audio: people who are deaf or hard of hearing, or who are in a noisy place. The transcript comes from automatic speech recognition, so it may contain filler words or small recognition mistakes.

Write the note so it can be read in two seconds:
- At most 12 words, plain and direct, no filler.
- Keep every name, number, room, bed, ward, medication and dose.
- Do not add facts, advice or guesses that are not in the transcript.
- Short, clear messages stay as they are (a greeting, "yes", "copy that", "on my way"): they matter on a radio too.
- Only if the words make no sense at all, the note is exactly: Unclear message.

Then set the priority:
- "urgent": a patient, resident or staff member in danger right now (fall, not breathing, chest pain, bleeding, choking, aggression, fire, someone needs help immediately).
- "info": everything else (updates, questions, routine care, meals, supplies, handover). When in doubt, choose "info".`;

const envApiKey: string | undefined = import.meta.env.VITE_ANTHROPIC_API_KEY;
const apiKey: string = envApiKey === undefined ? "" : envApiKey;

const client: Anthropic | null =
  apiKey === ""
    ? null
    : new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

export const isLlmAvailable = (): boolean => client !== null;

export const writeSimpleNote = async (
  transcript: string,
): Promise<SimpleNote | null> => {
  if (client === null) {
    return null;
  }
  try {
    const response: ParsedMessage<SimpleNote> = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: zodOutputFormat(SimpleNoteSchema),
      },
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `<transcript>${transcript}</transcript>` },
      ],
    });
    if (response.stop_reason === "refusal" || response.parsed_output === null) {
      return null;
    }
    const note: string = response.parsed_output.note.trim();
    return note === ""
      ? null
      : { note, priority: response.parsed_output.priority };
  } catch (error: unknown) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.warn(
        "Claude: invalid API key (check VITE_ANTHROPIC_API_KEY in .env)",
      );
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
