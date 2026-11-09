import { expect } from "@playwright/test";

import { generateId } from "@/lib/ids.ts";

import type { Dialog, Page } from "@playwright/test";
import type { Role } from "@/lib/types.ts";

interface JoinOptions {
  name: string;
  channel: string;
  role: Role;
}

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

export const expectHearing = async (page: Page, count: number): Promise<void> => {
  const label: string = `Hearing ${count} ${count === 1 ? "person" : "people"}`;
  await expect(page.getByLabel(label, { exact: true })).toBeVisible();
};

export const openSection = async (page: Page, title: string): Promise<void> => {
  await page.locator("summary", { hasText: title }).click();
};

export const leaveChannel = async (page: Page): Promise<void> => {
  page.once("dialog", (dialog: Dialog): void => {
    void dialog.accept();
  });
  await page.getByRole("button", { name: /End shift|Close channel/ }).click();
};
