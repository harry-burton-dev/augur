import type { User } from '@platform/mfe-sdk';

/**
 * Who is signed in. Until Identity and gateway sign-in land (the next build step)
 * this is a fixed local user and a placeholder token; nothing else in the shell
 * changes when the real session arrives.
 */
export interface Session {
  user: User;
  workspace: string;
  getToken(): Promise<string>;
}

export const devSession = (): Session => ({
  user: { id: 'dev', name: 'Local developer', departments: ['Finance'], roles: ['editor'] },
  workspace: 'Finance',
  getToken: async () => 'dev-token',
});
