import { fileURLToPath, URL } from "node:url";

import basicSsl from "@vitejs/plugin-basic-ssl";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import type { PluginOption, UserConfig } from "vite";

export default defineConfig(({ mode }: { mode: string }): UserConfig => {
  const isLan: boolean = mode === "lan";
  const plugins: PluginOption[] = [react(), tailwindcss()];
  if (isLan) {
    plugins.push(basicSsl());
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
