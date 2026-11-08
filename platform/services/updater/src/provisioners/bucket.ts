/** augur-bucket: bucket `<id>` and a key that opens only it (spec 4.6). */
import { createHash } from 'node:crypto';
import type { Provisioner } from './types.ts';

/** The key id Garage knows the app's key by, made from its secret as the storage container makes it. */
export const keyIdFor = (secret: string) => `GK${createHash('sha256').update(secret).digest('hex').slice(0, 24)}`;

export const bucket: Provisioner = {
  type: 'augur-bucket',
  uri: 'template://augur/bucket',
  params: [],
  check: () => [],
  needs: ['storage'],
  outputs: ({ storageId, secrets }) => ({
    endpoint: { value: 'http://garage:3900' },
    region: { value: 'garage' },
    bucket: { value: storageId },
    access_key_id: { value: keyIdFor(secrets.bucket) },
    secret_access_key: { value: secrets.bucket, secret: true },
  }),
  compose: () => ({}),
};
