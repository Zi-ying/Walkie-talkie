import { expect, test } from "@playwright/test";

import { expectHearing, joinChannel, leaveChannel, uniqueChannel } from "./channel-helpers.ts";

import type { BrowserContext, Locator, Page } from "@playwright/test";

// Each page is a different person on the channel (like separate tabs).

test("dispatch and member hear each other; members see who's online, dispatch sees the shift log", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const channel: string = uniqueChannel();
  const dispatch: Page = await context.newPage();
  const member: Page = await context.newPage();

  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });
  await expect(dispatch.getByText("Connected", { exact: true })).toBeVisible();

  await joinChannel(member, { name: "Bob", channel, role: "member" });

  await expectHearing(dispatch, 1);
  await expectHearing(member, 1);

  // Members: who's online, as avatars in the top bar (no roster list, no shift log).
  const memberOnline: Locator = member.getByRole("list", { name: "Online" });
  await expect(memberOnline.getByLabel("Ana (Dispatch)")).toBeVisible();
  await expect(memberOnline.getByLabel("Bob")).toBeVisible();
  await expect(member.getByRole("list", { name: "Shift log" })).toHaveCount(0);

  const dispatchLog: Locator = dispatch.getByRole("list", { name: "Shift log" });
  await expect(dispatchLog).toContainText("Ana");
  await expect(dispatchLog).toContainText("Bob");
  await expect(dispatchLog.getByText("is on shift")).toHaveCount(2);
});

test("with three people, everyone hears everyone, and a member who leaves is hung up on by all", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const channel: string = uniqueChannel();
  const dispatch: Page = await context.newPage();
  const firstMember: Page = await context.newPage();
  const secondMember: Page = await context.newPage();

  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });
  await joinChannel(firstMember, { name: "Bob", channel, role: "member" });
  await joinChannel(secondMember, { name: "Cleo", channel, role: "member" });

  await expectHearing(dispatch, 2);
  await expectHearing(firstMember, 2);
  await expectHearing(secondMember, 2);

  await leaveChannel(secondMember);

  await expectHearing(dispatch, 1);
  await expectHearing(firstMember, 1);
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

  await expectHearing(member, 1);
  await expectHearing(dispatch, 1);
});

test("a second dispatch on the same channel is refused", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const channel: string = uniqueChannel();
  const firstDispatch: Page = await context.newPage();
  const secondDispatch: Page = await context.newPage();

  await joinChannel(firstDispatch, { name: "Ana", channel, role: "dispatch" });
  await expect(firstDispatch.getByText("Connected", { exact: true })).toBeVisible();

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
  await expectHearing(dispatch, 1);

  await leaveChannel(member);

  const dispatchLog = dispatch.getByRole("list", { name: "Shift log" });
  await expect(dispatchLog).toContainText("ended shift");
  await expect(dispatchLog).not.toContainText("lost connection");
  await expectHearing(dispatch, 0);
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
  await expectHearing(dispatch, 1);

  await member.close();

  await expect(dispatch.getByRole("list", { name: "Shift log" })).toContainText(
    "lost connection",
    { timeout: 45000 },
  );
  await expectHearing(dispatch, 0);
});

test("when dispatch closes and reopens the channel, members come back", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  const channel: string = uniqueChannel();
  const dispatch: Page = await context.newPage();
  const member: Page = await context.newPage();

  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });
  await joinChannel(member, { name: "Bob", channel, role: "member" });
  await expectHearing(member, 1);

  await leaveChannel(dispatch);

  await expect(member.getByText("Waiting for dispatch")).toBeVisible();

  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });

  await expectHearing(dispatch, 1);
  await expectHearing(member, 1);
});
