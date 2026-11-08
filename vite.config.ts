import { fileURLToPath, URL } from "node:url";

import basicSsl from "@vitejs/plugin-basic-ssl";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import type { PluginOption, UserConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }: { mode: string }): UserConfig => {
  // `yarn dev:lan` (mode "lan"): serve over HTTPS on the local network, so other laptops can use
  // the microphone (browsers only allow it on https:// or localhost). Self-signed certificate.
  const isLan: boolean = mode === "lan";
  const plugins: PluginOption[] = [react(), tailwindcss()];
  if (isLan) {
    plugins.push(basicSsl());
  }

  return {
    plugins,
    resolve: {
      // "@/hooks/use-channel" → "src/hooks/use-channel" (also set in tsconfig.app.json)
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
