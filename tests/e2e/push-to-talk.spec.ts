import { expect, test } from "@playwright/test";

import { joinChannel, uniqueChannel } from "./channel-helpers.ts";

import type { BrowserContext, Locator, Page } from "@playwright/test";

// Holds the mouse down on the push-to-talk button (pointerdown), like a finger on the button.
const holdToTalk = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Hold to talk" }).hover();
  await page.mouse.down();
};

const releaseTalk = async (page: Page): Promise<void> => {
  await page.mouse.up();
};

const talkButton = (page: Page): Locator =>
  page.getByRole("button", { name: /Hold to talk|Talking|Channel busy/ });

interface ThreePeople {
  dispatch: Page;
  bob: Page;
  cleo: Page;
}

const joinThreePeople = async (context: BrowserContext): Promise<ThreePeople> => {
  const channel: string = uniqueChannel();
  const dispatch: Page = await context.newPage();
  const bob: Page = await context.newPage();
  const cleo: Page = await context.newPage();
  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });
  await joinChannel(bob, { name: "Bob", channel, role: "member" });
  await joinChannel(cleo, { name: "Cleo", channel, role: "member" });
  await expect(cleo.getByText("Hearing 2 people")).toBeVisible();
  return { dispatch, bob, cleo };
};

test("holding the button gives the floor to one speaker, and everyone sees it", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const { dispatch, bob, cleo }: ThreePeople = await joinThreePeople(context);
  await expect(dispatch.getByText("Channel free")).toBeVisible();

  await holdToTalk(bob);

  await expect(talkButton(bob)).toHaveText(/Talking/);
  await expect(dispatch.getByText("Bob is talking")).toBeVisible();
  await expect(cleo.getByText("Bob is talking")).toBeVisible();
  await expect(talkButton(cleo)).toHaveText("Channel busy");
  await expect(talkButton(cleo)).toBeDisabled();
  await expect(talkButton(dispatch)).toBeDisabled();

  await releaseTalk(bob);

  await expect(dispatch.getByText("Channel free")).toBeVisible();
  await expect(cleo.getByText("Channel free")).toBeVisible();
  await expect(talkButton(cleo)).toBeEnabled();
});

test("dispatch follows the same one-speaker rule as members", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const { dispatch, bob }: ThreePeople = await joinThreePeople(context);

  await holdToTalk(dispatch);

  await expect(bob.getByText("Ana is talking")).toBeVisible();
  await expect(talkButton(bob)).toBeDisabled();

  await releaseTalk(dispatch);

  await expect(bob.getByText("Channel free")).toBeVisible();
});

test("if the speaker's tab closes mid-sentence, the floor is freed", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const { dispatch, bob, cleo }: ThreePeople = await joinThreePeople(context);

  await holdToTalk(bob);
  await expect(cleo.getByText("Bob is talking")).toBeVisible();

  await bob.close();

  await expect(dispatch.getByText("Channel free")).toBeVisible({ timeout: 30000 });
  await expect(cleo.getByText("Channel free")).toBeVisible({ timeout: 30000 });
  await expect(talkButton(cleo)).toBeEnabled();
});
