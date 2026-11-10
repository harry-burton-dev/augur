# AUGUR's sign-in and email theme

The pages Keycloak shows at sign-in (sign in, set up a code app or passkey, change a password, choose
another way in) and the emails it sends, in AUGUR's Endstate look (ADR 0041).
Built with [Keycloakify](https://www.keycloakify.dev) from Common's tokens and parts (`@augur/kit-common`),
and shipped as a jar in AUGUR's Keycloak image (`infra/service.Dockerfile`, target `keycloak`).

- **Pages** (`src/login`): every page is Keycloakify's own, so every page Keycloak can show is covered and
  follows Keycloak's behaviour. `Template.tsx` is the frame: the shell's still horizon behind, the band along the top (the
  organisation, the product and the languages) and one solid panel in front (the page's title, Keycloak's
  message and the page). `sign-in.css` gives the pages Common's Keycap buttons and Well fields, in the
  horizon greys, and `@augur/kit-common/fonts.css` brings Common's typefaces, served from the jar.
  Keycloak's own stylesheet isn't loaded.
- **Emails** (`src/email`): Keycloak's own emails, in AUGUR's layout. `email-layout.ftl` is the layout;
  `scripts/email-layout.mjs` fills in Common's values (email clients don't read CSS variables) and writes
  `src/email/html/template.ftl` when the jar is built.
- **Names, not literals:** the product's name is the realm's display name, which the realm job sets from the deployment's
  `ORG_PRODUCT_NAME` (default AUGUR); the organisation's name and
  logo come from Keycloak's environment (`ORG_NAME`, `ORG_LOGO_URL`, the same settings identity reads),
  until they move to identity's organisation settings (ADR 0042).
- **Languages:** every word is Keycloak's own message, so each page and email comes in every language
  Keycloak has. The realm job offers the ones in `REALM_LANGUAGES` (docs/deploy.md).

The realm job (`platform/services/identity/src/realm.ts`, `applyLook`) turns the theme on when Keycloak has
it, and leaves Keycloak's own look on a Keycloak that doesn't (Keycloak's own image).

## Working on it

- `pnpm build`, `pnpm test`, `pnpm typecheck`: the pages only. No Java needed.
- `pnpm jar`: the theme as `dist_keycloak/augur-theme.jar`. Keycloakify packs it with Maven, so this needs
  a JDK (17 or later) and Maven.
- To see it: `docker compose -f infra/docker-compose.yml up -d --build keycloak keycloak-config`, then open
  any sign-in. `start-dev` keeps no theme cache.
- After a Keycloak upgrade, check the pages against the new version (ADR 0041), and move Keycloakify on
  if Keycloak's pages changed.
