import pg from 'pg';

/** Who Keycloak's email says it is from: the organisation's sender as an admin set it (ADR 0042). */
export interface RealmSender {
  name: string;
  address?: string;
}

/**
 * Reads the organisation's sender from identity's own tables, for the realm job: the sender an admin set in
 * Admin → Organisation, else the organisation's name. Undefined on a first install, before identity has made its
 * tables, or when the database can't be read; the job then keeps SMTP_FROM and the product's name, and says so.
 */
export const realmSenderFromDb = async (databaseUrl: string, warn: (message: string) => void = () => undefined, schema = 'identity'): Promise<RealmSender | undefined> => {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    const org = await client.query<{ name: string }>(`select name from ${schema}.workspaces where kind = 'org'`);
    const kept = await client.query<{ sender_name: string | null; sender_address: string | null }>(`select sender_name, sender_address from ${schema}.organisation`).catch((err: { code?: string }) => {
      // The organisation's table comes with a later release of identity than its floors.
      if (err.code === '42P01') return { rows: [] };
      throw err;
    });
    const name = kept.rows[0]?.sender_name ?? org.rows[0]?.name;
    if (!name) return undefined;
    const address = kept.rows[0]?.sender_address ?? undefined;
    return { name, ...(address ? { address } : {}) };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== '42P01') warn(`The organisation’s email sender couldn’t be read (${(err as Error).message}), so Keycloak’s email keeps SMTP_FROM and the product’s name.`);
    return undefined;
  } finally {
    await client.end().catch(() => undefined);
  }
};
