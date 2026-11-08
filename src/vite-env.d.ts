/// <reference types="vite/client" />

// Typed environment variables (from .env, see .env.example).
interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY?: string;
  // Optional local PeerJS server (`yarn peer:local`); the PeerJS cloud server is used when unset.
  readonly VITE_PEERJS_HOST?: string;
  readonly VITE_PEERJS_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
