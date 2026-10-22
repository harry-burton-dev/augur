interface ImportMetaEnv {
  /** The OIDC issuer the shell signs in with. */
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
}
/** The shell's release version, from its package.json at build time. */
declare const __SHELL_VERSION__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Set only under `pnpm dev:app`: the app being developed, its entry pointing at its source. */
declare const __DEV_APP__: import('@platform/mfe-sdk').AppManifestEntry;
/** Set only under `pnpm dev:app`: extra roles for the stand-in person, from DEV_ROLES. */
declare const __DEV_ROLES__: string[];
