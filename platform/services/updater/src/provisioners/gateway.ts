/** augur-gateway: the app's sign-in and the one way it reaches AUGUR (spec 4.6, 4.10, 8). */
import { appClientId, CALLER_KEYS_PATH } from '@augur/service-kit';
import { envValue } from '../env-file.ts';
import { GATEWAY_INSIDE, TOKEN_PATH, type Provisioner } from './types.ts';

export const gateway: Provisioner = {
  type: 'augur-gateway',
  uri: 'template://augur/gateway',
  params: ['inbound'],
  check: (params) => (params.inbound === undefined || typeof params.inbound === 'boolean' ? [] : ['inbound is true or false.']),
  // The secret is issued through identity once per app; its parts share it.
  needs: ['sign-in'],
  outputs: ({ app, env, secrets, params }) => ({
    url: { value: GATEWAY_INSIDE },
    public_url: { value: envValue(env, 'PLATFORM_URL') ?? '' },
    client_id: { value: appClientId(app) },
    client_secret: { value: secrets.signIn, secret: true },
    token_url: { value: `${GATEWAY_INSIDE}${TOKEN_PATH}` },
    caller_keys_url: { value: `${GATEWAY_INSIDE}${CALLER_KEYS_PATH}` },
    inbound: { value: String(params.inbound === true) },
  }),
  compose: () => ({}),
};
