import type { Migration } from '@augur/service-kit';

/**
 * The permissions service's own tables, in the `permissions` schema beside OpenFGA's, under its own login:
 * who is acting as which admin persona (sessions.ts), and the roles made in AUGUR and every grant given, with
 * who gave it, why, until when, and how it ended (grants.ts). OpenFGA keeps no metadata on a relationship, so
 * the ledger is what Admin shows and what a cascade revokes from (ADR 0085, spec section 5).
 */
export const migrations: Migration[] = [
  {
    id: '001-persona-sessions',
    sql: `
      create table permissions.persona_sessions (
        id uuid primary key,
        person text not null,
        persona text not null,
        reason text not null,
        started_at timestamptz not null,
        ends_at timestamptz not null,
        ended_at timestamptz
      );
      create index persona_sessions_live on permissions.persona_sessions (person) where ended_at is null;`,
  },
  {
    id: '002-roles-and-grants',
    sql: `
      create table permissions.roles (
        id uuid primary key,
        name text not null,
        scope text not null,
        made_by text not null,
        made_as text,
        made_at timestamptz not null
      );
      create index roles_scope on permissions.roles (scope);
      create table permissions.grants (
        id uuid primary key,
        giver text not null,
        giver_as text,
        subject text not null,
        relation text not null,
        object text not null,
        needs text not null,
        reason text not null,
        made_at timestamptz not null,
        expires_at timestamptz,
        revoked_at timestamptz,
        revoked_by text,
        revoke_reason text
      );
      create index grants_object on permissions.grants (object) where revoked_at is null;
      create index grants_live on permissions.grants (made_at) where revoked_at is null;`,
  },
];
