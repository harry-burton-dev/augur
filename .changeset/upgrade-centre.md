---
"@augur/registry": minor
"@augur/admin": minor
---

The Upgrade Centre replaces Admin → Updates. It shows this server, then the line from dev to production: each part's version on dev, preview and production from the new pipeline feed, where this server sits, what's waiting between the branches, and the open Version packages and Promote pull requests, linked to GitHub. Set `PORTAL_URL` to the company's Backstage for links to each part there. The registry reads the pipeline beside the release feed (`PIPELINE_FEED_URL` overrides it) and adds `line` and `portalUrl` to the updates page.
