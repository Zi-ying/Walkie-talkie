import { expect } from "@playwright/test";

import { generateId } from "@/lib/ids.ts";

import type { Dialog, Page } from "@playwright/test";
import type { Role } from "@/lib/types.ts";

interface JoinOptions {
  name: string;
  channel: string;
  role: Role;
}

// Every test gets its own channel, so tests never hear each other on the shared PeerJS server.
export const uniqueChannel = (): string => `test${generateId()}`;

export const joinChannel = async (
  page: Page,
  { name, channel, role }: JoinOptions,
): Promise<void> => {
  const roleLabel: string = role === "dispatch" ? "Dispatch" : "Member";
  await page.goto("/");
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page.getByLabel("Channel", { exact: true }).fill(channel);
  await page.getByRole("radio", { name: roleLabel, exact: true }).click();
  await page.getByRole("button", { name: "Join channel" }).click();
};

// The page receives audio from `count` people (read from the connection status label).
export const expectHearing = async (page: Page, count: number): Promise<void> => {
  const label: string = `Hearing ${count} ${count === 1 ? "person" : "people"}`;
  await expect(page.getByLabel(label, { exact: true })).toBeVisible();
};

// Accepts the "End your shift?" / "Close the channel?" confirmation.
export const leaveChannel = async (page: Page): Promise<void> => {
  page.once("dialog", (dialog: Dialog): void => {
    void dialog.accept();
  });
  await page.getByRole("button", { name: /End shift|Close channel/ }).click();
};
