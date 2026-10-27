import { describe, expect, it } from 'vitest';
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { emptyBucket } from './s3.ts';

describe('emptyBucket', () => {
  it('deletes what it lists until nothing is left', async () => {
    let objects = Array.from({ length: 1500 }, (_, i) => `apps/${i}`);
    const sent: string[] = [];
    const client = {
      async send(command: ListObjectsV2Command | DeleteObjectsCommand) {
        if (command instanceof ListObjectsV2Command) {
          sent.push('list');
          return { Contents: objects.slice(0, command.input.MaxKeys).map((Key) => ({ Key })) };
        }
        const gone = new Set(command.input.Delete!.Objects!.map((o) => o.Key));
        sent.push(`delete ${gone.size}`);
        objects = objects.filter((k) => !gone.has(k));
        return {};
      },
    } as never;
    expect(await emptyBucket({ endpoint: 'http://garage:3900', bucket: 'notes-pr3', secret: 'a'.repeat(64), client })).toBe(1500);
    expect(sent).toEqual(['list', 'delete 1000', 'list', 'delete 500', 'list']);
  });
});
