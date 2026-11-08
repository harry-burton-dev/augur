/** augur-files: a read-only folder the admin fills, listed under its label in Admin → Apps (spec 4.6). */
import { volumeName } from './scratch.ts';
import type { Provisioner } from './types.ts';

export const files: Provisioner = {
  type: 'augur-files',
  uri: 'template://augur/files',
  params: ['label', 'detail'],
  check: ({ label, detail }) => [
    ...(typeof label === 'string' && label.trim() ? [] : ['label is required: what the admin is asked to put in it.']),
    ...(detail === undefined || typeof detail === 'string' ? [] : ['detail is text.']),
  ],
  needs: [],
  outputs: () => ({}),
  compose: ({ app, storageId, part, resource, params }) => ({
    // Kept apart from a preview's, like its other data; the part never writes to it.
    volume: {
      name: volumeName(storageId, part, resource),
      readOnly: true,
      labels: {
        'augur.app': app,
        'augur.resource': 'augur-files',
        'augur.label': String(params.label),
      },
    },
  }),
};
