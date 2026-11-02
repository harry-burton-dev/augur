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
