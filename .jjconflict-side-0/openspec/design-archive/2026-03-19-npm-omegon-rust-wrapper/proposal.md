# Repurpose `omegon` npm package as Rust binary platform wrapper

## Intent

Now that the TS harness lives at `omegon-pi`, the `omegon` npm package name is free to become a thin wrapper that installs the Rust binary via platform-specific optionalDependencies (`@omegon/darwin-arm64`, etc.). This gives users `npm i -g omegon` → native Rust binary on PATH, same pattern as esbuild/claude-code. The existing platform package scaffolds in `omegon-pi/npm/platform-packages/` can be repurposed or moved to the Rust repo's release pipeline.

See [design doc](../../../docs/npm-omegon-rust-wrapper.md).
