# Mandate: intent

Mandate holds **intent**: what a floor means to achieve and why, and the parts of it passed down to the teams and people who'll do it. It is one of three pillar apps, with Artifacts and Data Atlas.

Mandate lives in its own repository, [augur-mandate](https://github.com/harry-burton-dev/augur-mandate) (ADR 0047), which builds, signs and releases it. Its guide is `docs/mandate.md` there. AUGUR's release feed lists its releases because `release/app-repos.json` names that repository, and the updater trusts that repository's release workflow to sign Mandate and nothing else.
