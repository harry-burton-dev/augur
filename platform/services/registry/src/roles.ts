import { noShadow, type Caller, type Shadow, type ShadowQuestion } from '@augur/service-kit';

/**
 * The realm role that runs the deployment (ADR 0022): only its holders upgrade AUGUR, go back to an
 * earlier release, take back a waiting upgrade or change how updates are taken (policy, pin, windows).
 * `admin` alone runs the organisation, not the server.
 */
export const DEPLOYMENT_ADMIN = 'deployment-admin';

/** The 403 for someone without it: names the role, so the Upgrade Centre can say who to ask. */
export const needsDeploymentAdmin = (doing: string) => ({
  error: 'forbidden',
  requiredRole: DEPLOYMENT_ADMIN,
  message: `Only a deployment admin can ${doing}. Ask someone who holds the deployment-admin role (Admin, People).`,
});

/**
 * How recently someone must have entered their password to change what the server runs (ADR 0022).
 * The ADR's OIDC step-up (`acr_values`, `max_age`) replaces this check once identity offers it.
 */
export const CHANGE_SIGN_IN_MS = 10 * 60 * 1000;

/**
 * Today's two realm roles, each check compared with the permissions service's answer to the same question
 * (shadow mode, ADR 0085). Today's role decides, except at a site the deployment has moved over
 * (`PERMISSIONS_DECIDES`), where the permissions service does; when it can't answer there, the check throws
 * `PermissionsUnavailable`, which the service answers as a 503. `admin` runs the organisation's apps (the org's
 * `can_manage_apps`, or `admin` where the check is about the server's state); `deployment-admin` runs the
 * server (one of the deployment's relations, such as `can_upgrade`). Both are asked as any persona the caller
 * holds, which is how today's roles are copied in (one admin persona each).
 */
export interface RoleChecks {
  /** Whether the caller holds `admin`. `site` names the check, the same at every call, such as `registry.catalogue`. */
  admin(site: string, caller: Caller | undefined, action?: OrgAction): Promise<boolean>;
  /** Whether the caller holds `deployment-admin`, for one of the deployment's relations. */
  deploymentAdmin(site: string, caller: Caller | undefined, action: DeploymentAction): Promise<boolean>;
}

/** What `admin` lets someone do, in the model: manage the org's apps, or be its admin. */
export type OrgAction = 'can_manage_apps' | 'admin';
/** What `deployment-admin` lets someone do, in the model. */
export type DeploymentAction = 'can_upgrade' | 'can_install_apps' | 'can_remove_apps' | 'can_pin_versions' | 'can_allow_sites' | 'can_set_app_secrets';

export const roleChecks = (shadow: Shadow = noShadow): RoleChecks => {
  const holds = async (site: string, caller: Caller | undefined, role: string, question: ShadowQuestion): Promise<boolean> => {
    if (!caller) return false;
    return shadow.decide(site, caller, question, caller.roles.includes(role));
  };
  return {
    admin: (site, caller, action = 'can_manage_apps') => holds(site, caller, 'admin', { action, resource: { type: 'org', id: 'this' }, as: 'persona' }),
    deploymentAdmin: (site, caller, action) => holds(site, caller, DEPLOYMENT_ADMIN, { action, resource: { type: 'deployment', id: 'this' }, as: 'persona' }),
  };
};
