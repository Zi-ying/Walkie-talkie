import { expect, test } from "@playwright/test";

import { joinChannel, leaveChannel, uniqueChannel } from "./channel-helpers.ts";

import type { BrowserContext, Page } from "@playwright/test";

// Each page is a different person on the channel (like separate tabs).

test("dispatch and member hear each other and share the roster and shift log", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const channel: string = uniqueChannel();
  const dispatch: Page = await context.newPage();
  const member: Page = await context.newPage();

  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });
  await expect(dispatch.getByText(`Connected as wt-${channel}-dispatch`)).toBeVisible();

  await joinChannel(member, { name: "Bob", channel, role: "member" });

  await expect(dispatch.getByText("Hearing 1 person")).toBeVisible();
  await expect(member.getByText("Hearing 1 person")).toBeVisible();

  const memberRoster = member.getByRole("list", { name: "On the channel" });
  await expect(memberRoster).toContainText("Ana");
  await expect(memberRoster).toContainText("Bob");

  const memberLog = member.getByRole("list", { name: "Shift log" });
  await expect(memberLog).toContainText("Ana");
  await expect(memberLog).toContainText("Bob");
  await expect(memberLog.getByText("is on shift")).toHaveCount(2);
});

test("a member who joins first waits, then connects when dispatch arrives", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const channel: string = uniqueChannel();
  const member: Page = await context.newPage();
  const dispatch: Page = await context.newPage();

  await joinChannel(member, { name: "Bob", channel, role: "member" });
  await expect(member.getByText("Waiting for dispatch")).toBeVisible();

  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });

  await expect(member.getByText("Hearing 1 person")).toBeVisible();
  await expect(dispatch.getByText("Hearing 1 person")).toBeVisible();
});

test("a second dispatch on the same channel is refused", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const channel: string = uniqueChannel();
  const firstDispatch: Page = await context.newPage();
  const secondDispatch: Page = await context.newPage();

  await joinChannel(firstDispatch, { name: "Ana", channel, role: "dispatch" });
  await expect(firstDispatch.getByText("Connected as")).toBeVisible();

  await joinChannel(secondDispatch, { name: "Eve", channel, role: "dispatch" });
  await expect(secondDispatch.getByText("already taken")).toBeVisible();
});

test("a member ending their shift is logged as ended shift for dispatch", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const channel: string = uniqueChannel();
  const dispatch: Page = await context.newPage();
  const member: Page = await context.newPage();

  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });
  await joinChannel(member, { name: "Bob", channel, role: "member" });
  await expect(dispatch.getByText("Hearing 1 person")).toBeVisible();

  await leaveChannel(member);

  const dispatchLog = dispatch.getByRole("list", { name: "Shift log" });
  await expect(dispatchLog).toContainText("ended shift");
  await expect(dispatchLog).not.toContainText("lost connection");
  await expect(dispatch.getByText("Hearing 0 people")).toBeVisible();
  await expect(dispatch.getByRole("list", { name: "On the channel" })).not.toContainText("Bob");
});

test("closing the tab is logged as lost connection for dispatch", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const channel: string = uniqueChannel();
  const dispatch: Page = await context.newPage();
  const member: Page = await context.newPage();

  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });
  await joinChannel(member, { name: "Bob", channel, role: "member" });
  await expect(dispatch.getByText("Hearing 1 person")).toBeVisible();

  await member.close();

  await expect(dispatch.getByRole("list", { name: "Shift log" })).toContainText(
    "lost connection",
    { timeout: 45000 },
  );
  await expect(dispatch.getByText("Hearing 0 people")).toBeVisible();
});

test("when dispatch closes and reopens the channel, members come back", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const channel: string = uniqueChannel();
  const dispatch: Page = await context.newPage();
  const member: Page = await context.newPage();

  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });
  await joinChannel(member, { name: "Bob", channel, role: "member" });
  await expect(member.getByText("Hearing 1 person")).toBeVisible();

  await leaveChannel(dispatch);

  await expect(member.getByText("Waiting for dispatch")).toBeVisible();
  await expect(member.getByRole("list", { name: "Shift log" })).toContainText("ended shift");

  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });

  await expect(dispatch.getByText("Hearing 1 person")).toBeVisible();
  await expect(member.getByText("Hearing 1 person")).toBeVisible();
});
