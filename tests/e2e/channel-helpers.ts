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
  await page.goto("/");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Channel", { exact: true }).fill(channel);
  await page.getByLabel("Role", { exact: true }).selectOption(role);
  await page.getByRole("button", { name: "Join" }).click();
};

// Accepts the "End your shift?" / "Close the channel?" confirmation.
export const leaveChannel = async (page: Page): Promise<void> => {
  page.once("dialog", (dialog: Dialog): void => {
    void dialog.accept();
  });
  await page.getByRole("button", { name: /End shift|Close channel/ }).click();
};
