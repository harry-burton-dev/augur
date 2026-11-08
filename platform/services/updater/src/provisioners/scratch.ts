/** augur-scratch: a private writable folder of the size asked, emptied on uninstall (spec 4.6). */
import { bytesOf } from '../score.ts';
import type { Provisioner } from './types.ts';

/** A named volume for one resource of one part: app-<storage id>-<part>-<resource>. */
export const volumeName = (storageId: string, part: string, resource: string) => `app-${storageId}-${part}-${resource}`;

export const scratch: Provisioner = {
  type: 'augur-scratch',
  uri: 'template://augur/scratch',
  params: ['size'],
  check: ({ size }) => (typeof size === 'string' && /^\d+(Mi|Gi)$/.test(size) ? [] : ['size is required, as <n>Mi or <n>Gi.']),
  needs: [],
  outputs: () => ({}),
  compose: ({ app, storageId, part, resource, params }) => ({
    volume: {
      name: volumeName(storageId, part, resource),
      readOnly: false,
      size: bytesOf(params.size as string),
      labels: { 'augur.app': app, 'augur.resource': 'augur-scratch' },
    },
  }),
};
