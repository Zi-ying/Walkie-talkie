import { expect, test } from "@playwright/test";

import { expectHearing, joinChannel, uniqueChannel } from "./channel-helpers.ts";

import type { BrowserContext, Locator, Page, Route } from "@playwright/test";
import type { SimpleNote } from "@/lib/types.ts";

const TRANSCRIPT: string =
  "hey uh so mrs jones in room twelve is asking for her pain medication again can a nurse come";
const NOTE: string = "Mrs Jones, room 12, asks for pain medication. Nurse needed.";
const INFO_NOTE: SimpleNote = { note: NOTE, priority: "info" };

// Headless Chrome can't recognise speech: replace the Web Speech API with a fake that
// "hears" TRANSCRIPT and reports it when listening stops.
const installFakeSpeechRecognition = async (context: BrowserContext): Promise<void> => {
  await context.addInitScript((heardText: string): void => {
    class FakeSpeechRecognition {
      continuous: boolean = false;
      interimResults: boolean = false;
      lang: string = "";
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      start(): void {}
      stop(): void {
        if (this.onresult !== null) {
          this.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: heardText } }] });
        }
        if (this.onend !== null) {
          this.onend();
        }
      }
    }
    // globalThis is `window` in the browser (the tests' tsconfig has no DOM types).
    Object.defineProperty(globalThis, "SpeechRecognition", { value: FakeSpeechRecognition });
  }, TRANSCRIPT);
};

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "content-type": "application/json",
};

// Intercepts every call to the Claude API: nothing leaves the machine. Records the request bodies.
// The reply is the JSON a structured-output answer contains. `answer` null = like an invalid API key.
const fakeClaude = async (
  context: BrowserContext,
  answer: SimpleNote | null,
  requestBodies: string[],
): Promise<void> => {
  await context.route("https://api.anthropic.com/**", async (route: Route): Promise<void> => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const body: string | null = route.request().postData();
    requestBodies.push(body === null ? "" : body);
    if (answer === null) {
      await route.fulfill({
        status: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          type: "error",
          error: { type: "authentication_error", message: "invalid x-api-key" },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "claude-haiku-5-5",
        content: [{ type: "text", text: JSON.stringify(answer) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 120, output_tokens: 12 },
      }),
    });
  });
};

interface Team {
  dispatch: Page;
  bob: Page;
  cleo: Page;
}

const joinTeam = async (context: BrowserContext): Promise<Team> => {
  const channel: string = uniqueChannel();
  const dispatch: Page = await context.newPage();
  const bob: Page = await context.newPage();
  const cleo: Page = await context.newPage();
  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });
  await joinChannel(bob, { name: "Bob", channel, role: "member" });
  await joinChannel(cleo, { name: "Cleo", channel, role: "member" });
  await expectHearing(cleo, 2);
  return { dispatch, bob, cleo };
};

// Holds the push-to-talk button until we're on air, then releases it.
const sayOneMessage = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Hold to talk" }).hover();
  await page.mouse.down();
  await expect(page.getByRole("button", { name: /Talking/ })).toBeVisible();
  await page.mouse.up();
};

test("a transmission is transcribed, and Claude's simple note reaches everyone", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const requestBodies: string[] = [];
  await installFakeSpeechRecognition(context);
  await fakeClaude(context, INFO_NOTE, requestBodies);
  const { dispatch, bob, cleo }: Team = await joinTeam(context);

  await sayOneMessage(bob);

  // Everyone sees the AI note; only dispatch sees the original words.
  for (const page of [dispatch, bob, cleo]) {
    await expect(page.getByRole("region", { name: "Latest note" })).toContainText(NOTE);
  }
  await expect(dispatch.getByRole("list", { name: "Messages" })).toContainText(TRANSCRIPT);
  await expect(cleo.getByText(TRANSCRIPT)).toHaveCount(0);

  // Only dispatch calls Claude, once, with the cheap model and the transcript.
  expect(requestBodies).toHaveLength(1);
  expect(requestBodies[0]).toContain("claude-haiku-5-5");
  expect(requestBodies[0]).toContain(TRANSCRIPT);
});

test("a note Claude marks urgent is shown as urgent to everyone", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const requestBodies: string[] = [];
  await installFakeSpeechRecognition(context);
  await fakeClaude(context, { note: NOTE, priority: "urgent" }, requestBodies);
  const { dispatch, bob, cleo }: Team = await joinTeam(context);

  await sayOneMessage(bob);

  for (const page of [dispatch, bob, cleo]) {
    await expect(page.getByRole("region", { name: "Latest note" })).toContainText("URGENT");
  }
  await expect(dispatch.getByRole("list", { name: "Messages" })).toContainText("🔴 Urgent");
});

test("if Claude fails, dispatch still gets the transcript and members see no note", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const requestBodies: string[] = [];
  await installFakeSpeechRecognition(context);
  await fakeClaude(context, null, requestBodies);
  const { dispatch, bob, cleo }: Team = await joinTeam(context);

  await sayOneMessage(bob);

  const messages: Locator = dispatch.getByRole("list", { name: "Messages" });
  await expect(messages).toContainText(TRANSCRIPT);
  await expect(messages).toContainText("AI note unavailable");
  for (const page of [dispatch, cleo]) {
    await expect(page.getByRole("region", { name: "Latest note" })).toHaveCount(0);
  }
});

test("someone who joins later receives the earlier messages", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const requestBodies: string[] = [];
  await installFakeSpeechRecognition(context);
  await fakeClaude(context, INFO_NOTE, requestBodies);
  const channel: string = uniqueChannel();
  const dispatch: Page = await context.newPage();
  const bob: Page = await context.newPage();
  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });
  await joinChannel(bob, { name: "Bob", channel, role: "member" });
  await expectHearing(bob, 1);

  await sayOneMessage(bob);
  await expect(dispatch.getByRole("region", { name: "Latest note" })).toContainText(NOTE);

  const lateComer: Page = await context.newPage();
  await joinChannel(lateComer, { name: "Dee", channel, role: "member" });

  await expect(lateComer.getByRole("region", { name: "Latest note" })).toContainText(NOTE);
});
