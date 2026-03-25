---
id: sbom-signing-verification
title: Full SBOM signing and verification pipeline
status: seed
tags: [security, supply-chain, release]
open_questions: []
jj_change_id: yuxytpvrovzlulsvutxolyzltyrzproz
---

# Full SBOM signing and verification pipeline

## Overview

End-to-end SBOM signing: CycloneDX generation (already in CI), cosign signature on the SBOM (already in CI), local SBOM generation via just recipe, verification tooling for consumers (cosign verify-blob on SBOM + attestation check). Also: reproducible build investigation, SLSA Level 3 compliance check.

## Open Questions

*No open questions.*
