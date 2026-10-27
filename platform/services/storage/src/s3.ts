import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { keyIdFor } from './garage.ts';

/** Deletes everything in a bucket through S3's API, with the bucket's own key: Garage's admin API can't. */
export const emptyBucket = async ({ endpoint, bucket, secret, client }: { endpoint: string; bucket: string; secret: string; client?: Pick<S3Client, 'send'> }) => {
  const s3 = client ?? new S3Client({ endpoint, region: 'garage', forcePathStyle: true, credentials: { accessKeyId: keyIdFor(secret), secretAccessKey: secret } });
  let deleted = 0;
  for (;;) {
    // Always the first page: what's listed is deleted before the next is asked for.
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1000 }));
    const keys = (listed.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (!keys.length) return deleted;
    await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
    deleted += keys.length;
  }
};
