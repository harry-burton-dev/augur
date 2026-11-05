# V3: Before and after

Writers copy examples more readily than they follow rules. Three real notes
from the guide, each as written and as it should be. Match the "after".

## A condition hidden behind "nothing to do"

**Before**
> Nothing to do on most servers: the upgrade recreates each container
> with its limits. Existing logs bigger than the cap go when the container
> is recreated. On a server with less than 8 GB of memory, set
> `KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT` lower in `.env` first.

**After**
> **Check** · **If** your server has less than 8 GB of memory, set
> `KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT` lower in `.env` before
> you upgrade. Otherwise nothing to do. You lose existing logs bigger than
> the cap when containers are recreated.

*What changed:* the condition comes first, as an "if". The loss is named.

## A consequence at the end of a history lesson

**Before**
> AUGUR's repository was renamed from `im-platform` to `augur` on
> 5 November 2026. Every release is signed by the repository's workflows,
> so from this release the updater and registry take AUGUR's releases,
> dev builds and feed signed under either name. A server must run this
> release **before** the rename, or it refuses everything released after it.

**After**
> ### Don't skip this release: without it, your server refuses every later one
> **From** unreleased · **Check** · **Way back** [open]
> - **Skip it and** the server refuses everything released after it.
> - **Why:** the repository was renamed from `im-platform` to `augur` on
>   5 November 2026. From this release the updater and registry take
>   releases signed under either name.

*What changed:* the consequence is the heading. The history is the why.

## Steps mixed with explanation

**Before**
> 3. Upgrade as usual. A new container, `keycloak-config`, runs once
> Keycloak is up, sets the realm up and stops; identity starts after it.
> Keycloak's first start on 26.8 takes a minute or two longer while it migrates.

**After**
> 3. Upgrade by hand. Keycloak's first start takes a minute or two longer.
> 4. **Check:** `pc logs keycloak-config` ends with "The platform realm is
>    up to date".
>
> *(What `keycloak-config` is goes in **Why**.)*

*What changed:* one action per step; the check is a step; the explanation moves.
