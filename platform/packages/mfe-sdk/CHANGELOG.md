# @platform/mfe-sdk

## 1.0.0

### Major Changes

- First versioned release of the contract between the shell and apps. Exports `SDK_VERSION`, and every manifest entry says which SDK releases its app works with in `sdk`, a semver range such as `^1.0.0`. The shell refuses to open an app whose range its SDK doesn't satisfy.
