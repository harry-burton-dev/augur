/**
 * The keys under which AUGUR keeps personal values in Activity entries' `detail` (ADR 0040). When a person's account
 * is deleted, the events service replaces every value under these keys, in entries by or about them, with
 * `REMOVED`, including inside `{ from, to }` pairs. A service writing Activity keeps names, usernames, email
 * addresses, IP addresses and free text only under these keys, so redaction finds them.
 */
export const PERSONAL_DETAIL_KEYS = ['username', 'email', 'firstName', 'lastName', 'name', 'ip', 'ips', 'message'] as const;

/** What a redacted value reads as. */
export const REMOVED = '[removed]';
