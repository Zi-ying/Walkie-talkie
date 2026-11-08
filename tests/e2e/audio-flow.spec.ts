import { expect, test } from "@playwright/test";

import { expectHearing, joinChannel, uniqueChannel } from "./channel-helpers.ts";

import type { BrowserContext, Page } from "@playwright/test";

// Proves the audio really flows, and only while the button is held, using WebRTC's own statistics.
// Chrome's fake microphone plays a test tone, so a receiver gets sound only while the sender's mic is on.

// Keeps a list of every RTCPeerConnection the page creates, so the test can read their statistics.
// Plain JavaScript string: it runs in the browser, and the tests' tsconfig has no DOM types.
const RECORD_PEER_CONNECTIONS: string = `
  const OriginalPeerConnection = globalThis.RTCPeerConnection;
  const recorded = [];
  globalThis.__recordedPeerConnections = recorded;
  globalThis.RTCPeerConnection = class extends OriginalPeerConnection {
    constructor(...args) {
      super(...args);
      recorded.push(this);
    }
  };
`;

// Total energy of all audio this page has received so far (grows only while someone's mic is on).
const RECEIVED_AUDIO_ENERGY: string = `
  (async () => {
    let total = 0;
    for (const connection of globalThis.__recordedPeerConnections) {
      const report = await connection.getStats();
      report.forEach((stat) => {
        if (stat.type === "inbound-rtp" && stat.kind === "audio" && typeof stat.totalAudioEnergy === "number") {
          total += stat.totalAudioEnergy;
        }
      });
    }
    return total;
  })()
`;

// Thresholds for the energy received over 2 seconds, with wide margins on both sides.
const SILENCE: number = 0.001;
const SOUND: number = 0.05;

const receivedAudioEnergy = async (page: Page): Promise<number> => {
  const energy: number = await page.evaluate(RECEIVED_AUDIO_ENERGY);
  return energy;
};

// Energy received during the next `milliseconds`.
const energyReceivedDuring = async (page: Page, milliseconds: number): Promise<number> => {
  const before: number = await receivedAudioEnergy(page);
  await page.waitForTimeout(milliseconds);
  const after: number = await receivedAudioEnergy(page);
  return after - before;
};

test("audio reaches the others only while the button is held", async ({
  context,
}: { context: BrowserContext }): Promise<void> => {
  await context.addInitScript({ content: RECORD_PEER_CONNECTIONS });
  const channel: string = uniqueChannel();
  const dispatch: Page = await context.newPage();
  const bob: Page = await context.newPage();
  const cleo: Page = await context.newPage();
  await joinChannel(dispatch, { name: "Ana", channel, role: "dispatch" });
  await joinChannel(bob, { name: "Bob", channel, role: "member" });
  await joinChannel(cleo, { name: "Cleo", channel, role: "member" });
  await expectHearing(cleo, 2);

  const silenceBefore: number = await energyReceivedDuring(cleo, 2000);

  await bob.getByRole("button", { name: "Hold to talk" }).hover();
  await bob.mouse.down();
  await expect(cleo.getByText("Bob is talking")).toBeVisible();
  const whileTalkingCleo: number = await energyReceivedDuring(cleo, 2000);
  const whileTalkingDispatch: number = await energyReceivedDuring(dispatch, 2000);

  await bob.mouse.up();
  await expect(cleo.getByText("Channel free")).toBeVisible();
  await cleo.waitForTimeout(500); // let the last packets arrive
  const silenceAfter: number = await energyReceivedDuring(cleo, 2000);

  // Measured: about 0.000000005 when silent, about 0.46 while talking.
  expect(silenceBefore).toBeLessThan(SILENCE);
  expect(whileTalkingCleo).toBeGreaterThan(SOUND); // member → member (mesh)
  expect(whileTalkingDispatch).toBeGreaterThan(SOUND); // member → dispatch
  expect(silenceAfter).toBeLessThan(SILENCE);
});
