/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adresse des Backends, z. B. https://meine-app.herokuapp.com. Leer = gleiche Herkunft. */
  readonly VITE_API_URL?: string
  /** Aktiviert /dev auch in einem ausdrücklich dafür gebauten Vorschau-Build. */
  readonly VITE_DEV_PREVIEW?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
