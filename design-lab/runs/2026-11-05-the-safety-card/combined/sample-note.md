### Each service now signs in as itself: add three secrets and remove `SERVICE_TOKEN`
**From** unreleased · **Do before** · **Way back** [open: not stated]

- **Do, before you upgrade:**
  1. Add `IDENTITY_CLIENT_SECRET` to `.env`. Make it with `openssl rand -hex 32`.
  2. Add `REGISTRY_CLIENT_SECRET` the same way.
  3. Add `EVENTS_CLIENT_SECRET` the same way.
  4. Remove `SERVICE_TOKEN` from `.env`.
- **If** an app has its own service: in Admin, Apps, choose **Issue a new sign-in**. Use what it gives you as that app's `SERVICE_CLIENT_SECRET`.
- **Check:** [open: what shows that each service signed in. The change's author can say.]
- **Skip it and** [open: what fails without the three secrets, or for an app's service without a new sign-in. The change's author can say.]
- **Upgrading from the Upgrade Centre:** [open: whether the updater makes these three up. Its own note says it makes up any new required setting ending in `_SECRET`.]
- **Why:** the shared token, `SERVICE_TOKEN`, is gone: each service signs in as itself. Identity makes the matching Keycloak clients when it starts, so there is nothing to do in Keycloak.
