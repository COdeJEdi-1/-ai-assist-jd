/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OMNIDIM_AGENT_ID: string
  readonly VITE_OMNIDIM_API_KEY: string
  readonly VITE_OMNIDIM_PHONE_NUMBER_ID?: string
  readonly VITE_OMNIDIM_CONCURRENT_CALLS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
