/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SYNC_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
