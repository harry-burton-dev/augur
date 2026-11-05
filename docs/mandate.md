# Mandate: intent

Mandate holds **intent**: what a floor means to achieve and why, and the parts of it passed down to the teams and people who'll do it. It is one of the pillar apps, with Artifacts and Data Atlas, and ships with every deployment.

Mandate lives in its own repository, [augur-mandate](https://github.com/harry-burton-dev/augur-mandate) (ADR 0047), which builds, signs and releases it. Its guide is `docs/mandate.md` there. AUGUR ships the release of it that `release/shipped-apps.json` pins (ADR 0049), as the `mandate` container. Before that, servers installed it with the app runner; docs/upgrade.md, Mandate ships with AUGUR, says how those servers carry its data over.
