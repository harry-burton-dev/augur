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

/** The idle-account days an admin set in Admin → Organisation, with the defaults for what they didn't. */
export interface RealmIdle {
  on: boolean;
  warningDays: number;
  turnOffDays: number;
}

/**
 * Reads the idle-account days from identity's own tables, for the realm job (PER-194). The defaults when
 * nothing is set, or on an identity older than the days; undefined when the database can't be read, and the
 * job then leaves Keycloak's idle Workflow as it is.
 */
export const realmIdleFromDb = async (
  databaseUrl: string,
  defaults: RealmIdle,
  warn: (message: string) => void = () => undefined,
  schema = 'identity',
): Promise<RealmIdle | undefined> => {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    const { rows } = await client
      .query<{ idle_on: boolean | null; idle_warning_days: number | null; idle_turn_off_days: number | null }>(
        `select idle_on, idle_warning_days, idle_turn_off_days from ${schema}.organisation`,
      )
      .catch((err: { code?: string }) => {
        // No table yet (first install), or an identity from before the idle days.
        if (err.code === '42P01' || err.code === '42703') return { rows: [] };
        throw err;
      });
    const r = rows[0];
    return { on: r?.idle_on ?? defaults.on, warningDays: r?.idle_warning_days ?? defaults.warningDays, turnOffDays: r?.idle_turn_off_days ?? defaults.turnOffDays };
  } catch (err) {
    warn(`The idle-account days couldn’t be read (${(err as Error).message}), so Keycloak’s idle-account Workflow is left as it is.`);
    return undefined;
  } finally {
    await client.end().catch(() => undefined);
  }
};
