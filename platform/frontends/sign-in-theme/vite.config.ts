import react from '@vitejs/plugin-react';
import { keycloakify } from 'keycloakify/vite-plugin';
import { defineConfig } from 'vitest/config';

// AUGUR's Keycloak theme (ADR 0041): `pnpm build` builds the pages, `pnpm jar` also packs them, with the
// email theme in src/email, into dist_keycloak/augur-theme.jar (Keycloakify runs Maven for that). The
// Keycloak image copies the jar into Keycloak's providers (infra/service.Dockerfile, target keycloak).
export default defineConfig({
  plugins: [
    react(),
    keycloakify({
      themeName: 'augur',
      accountThemeImplementation: 'none',
      artifactId: 'augur-theme',
      groupId: 'augur',
      // One jar, for the Keycloak AUGUR runs (26.x): the other range Keycloakify can build for is 22 to 25.
      keycloakVersionTargets: { '22-to-25': false, 'all-other-versions': 'augur-theme.jar' },
      // Read from Keycloak's environment when a page is shown. ORG_NAME is the organisation's name until the
      // realm job has applied the one in Admin → Organisation (ADR 0042). ORG_LOGO_URL is optional: without it
      // the page shows the logo kept in Admin → Organisation, or none.
      environmentVariables: [
        { name: 'ORG_NAME', default: 'Organisation' },
        { name: 'ORG_LOGO_URL', default: '' },
      ],
    }),
  ],
  // One React for the pages and Common's parts.
  resolve: { dedupe: ['react', 'react-dom'] },
  test: {
    environment: 'happy-dom',
    // The pages add Keycloak's own scripts to the head, which happy-dom doesn't load: count them as loaded.
    environmentOptions: { happyDOM: { settings: { handleDisabledFileLoadingAsSuccess: true } } },
    include: ['src/**/*.test.tsx', 'scripts/*.test.mjs'],
  },
});
