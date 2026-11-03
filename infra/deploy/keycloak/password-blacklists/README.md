# Breached-password lists

Keycloak's password policy checks every new password against `ncsc-top100k.txt` (ADR 0038, realm job in
`platform/services/identity/src/realm.ts`). The policy names one file here;
each holds one password per line, in lower case.

`ncsc-top100k.txt` is the UK NCSC's list of the 100,000 passwords most often found in breaches (via
SecLists, MIT licence: `Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt`), cut to the
entries of 15 characters or more, lower-cased and de-duplicated. A shorter one can never be chosen,
because the policy's floor is 15 characters.

To use a bigger list, put it here and set `REALM_PASSWORD_DENYLIST=<file name>` in `.env`.
