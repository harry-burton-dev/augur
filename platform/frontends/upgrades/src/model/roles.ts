/** The realm role that may change versions and settings on this deployment (ADR 0022, 0084). */
const DEPLOYMENT_ADMIN = 'deployment-admin';

/** Said wherever a change needs deployment-admin and the person doesn't hold it. */
export const NEEDS_DEPLOYMENT_ADMIN = `Needs the ${DEPLOYMENT_ADMIN} role. Ask a deployment admin.`;

/** Whether the person may act, and the reason shown when they may not. */
export type Gate = { allowed: true } | { allowed: false; requiredRole: string; reason: string };

/**
 * Whether the person may change versions and settings, from what the registry says of them (`you.deploymentAdmin`
 * on the overview): a contract 3 frontend is never told anyone's roles. Reading needs no role beyond seeing the app.
 */
export const gateFor = (deploymentAdmin: boolean): Gate =>
  deploymentAdmin ? { allowed: true } : { allowed: false, requiredRole: DEPLOYMENT_ADMIN, reason: NEEDS_DEPLOYMENT_ADMIN };

/** A refusal from the gateway, as the security work shapes it. */
export type Refusal =
  | { error: 'forbidden'; requiredRole: string; message: string }
  | { error: 'step_up_required'; acr: string; maxAge: number; message: string };

export const isRefusal = (body: unknown): body is Refusal =>
  typeof body === 'object' && body !== null && ['forbidden', 'step_up_required'].includes((body as { error?: string }).error ?? '') && typeof (body as { message?: unknown }).message === 'string';
