import { defineConfig, devices } from "@playwright/test";

// End-to-end tests: real Chrome pages talking to each other.
// Chrome's fake media flags give every page a fake microphone (a test tone), with no permission prompt.
// The tests start their own servers, so they need no internet and use nothing from .env:
// - a local PeerJS signaling server (instead of the shared cloud one, which rate-limits),
// - the app (port 5174) pointed at it, with a fake API key: calls to Claude are intercepted
//   in the tests and cost nothing.
const TEST_PORT: number = 5174;
const PEER_SERVER_PORT: number = 9001;

export default defineConfig({
  testDir: "./tests/e2e",
  tsconfig: "./tsconfig.node.json", // for the "@/..." import alias
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 2,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${TEST_PORT}`,
    permissions: ["microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    },
  },
  webServer: [
    {
      command: `yarn peerjs --port ${PEER_SERVER_PORT}`,
      url: `http://localhost:${PEER_SERVER_PORT}`,
      reuseExistingServer: false,
    },
    {
      command: `yarn dev --port ${TEST_PORT} --strictPort`,
      url: `http://localhost:${TEST_PORT}`,
      reuseExistingServer: false,
      env: {
        VITE_PEERJS_HOST: "localhost",
        VITE_PEERJS_PORT: String(PEER_SERVER_PORT),
        VITE_ANTHROPIC_API_KEY: "test-key-not-real",
      },
    },
  ],
});
