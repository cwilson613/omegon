# TS→Rust Migration: Make omegon repo Rust-primary

## Intent

Migrate the omegon repo from TS+pi-mono harness to Rust-primary. The Rust binary in core/ reimplements most functionality. Archive the TS/pi layer to a separate omegon-pi repo. Before migration, audit each TS extension to confirm Rust parity or intentional deprecation.

See [design doc](../../../docs/ts-to-rust-migration.md).
