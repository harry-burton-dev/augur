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
