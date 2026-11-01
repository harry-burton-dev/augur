/** The realm role that may change versions and settings on this deployment (ADR 0022). */
export const DEPLOYMENT_ADMIN = 'deployment-admin';

export type Gate = { allowed: true } | { allowed: false; requiredRole: string; reason: string };

/**
 * Whether the person may act. Reading never needs a role beyond seeing the app.
 * A refusal says which role is needed; who holds it comes from the server's 403.
 */
export const canChange = (roles: string[]): Gate =>
  roles.includes(DEPLOYMENT_ADMIN)
    ? { allowed: true }
    : { allowed: false, requiredRole: DEPLOYMENT_ADMIN, reason: `Changing versions and settings needs the ${DEPLOYMENT_ADMIN} role.` };

/** A refusal from the gateway, as the security work shapes it. */
export type Refusal =
  | { error: 'forbidden'; requiredRole: string; message: string }
  | { error: 'step_up_required'; acr: string; maxAge: number; message: string };

export const isRefusal = (body: unknown): body is Refusal =>
  typeof body === 'object' && body !== null && ['forbidden', 'step_up_required'].includes((body as { error?: string }).error ?? '') && typeof (body as { message?: unknown }).message === 'string';
