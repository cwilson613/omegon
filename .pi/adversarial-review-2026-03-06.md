# pi-kit Adversarial Code Review

**Date:** 2026-03-06  
**Scope:** All 49 extension source files (~20,500 lines)  
**Methodology:** Manual security audit, correctness review, consistency analysis  

---

## Summary

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 3     | 3     | 0         |
| Warning  | 6     | 1     | 5         |
| Note     | 4     | 0     | 4         |

---

## Critical Issues — All Fixed ✅

### C1: Path traversal in OpenSpec `addSpec` (FIXED — 10da000)
**File:** `extensions/openspec/spec.ts`  
**Issue:** `domain` parameter passed directly to `path.join()` without validation. A domain like `../../etc/passwd` would write outside `specs/`.  
**Fix:** Added `validateDomain()` with regex, double-dot, backslash, absolute path checks + defense-in-depth resolved path containment check. Same validation added to `getChange()` (`validateChangeName`) and `archiveChange()`.  
**Tests:** 16 new security tests covering traversal, backslash, absolute path, dot-prefix rejection.

### C2: Path traversal in OpenSpec `getChange`/`archiveChange` (FIXED — 10da000)
**File:** `extensions/openspec/spec.ts`  
**Issue:** `changeName` parameter not validated — `../../../etc` would resolve outside `changes/`.  
**Fix:** Added `validateChangeName()` — lowercase alphanumeric with hyphens/underscores only, no path separators, no `..`, no dot prefix, max 80 chars.

### C3: Command injection in view extension (FIXED — 10da000)
**File:** `extensions/view/index.ts`  
**Issue:** `filePath` from tool parameters interpolated into `execSync()` shell strings via template literals. Double quotes don't prevent `$(...)` or backtick injection inside bash.  
**Affected calls:** `sips`, `file`, `rsvg-convert`, `pdfinfo`, `pdftoppm`, `pdftotext`, `pandoc`, `d2` — 10 separate injection vectors.  
**Fix:** Added `runSafe()` wrapper using `execFileSync()` (argument array, no shell). Migrated all 10 file-path-dependent calls. The `run()` function is retained only for `which` checks (no user input).

---

## Warnings — Remaining (non-blocking)

### W1: Cleave worktree childLabel unsanitized (FIXED — 10da000)
**File:** `extensions/cleave/worktree.ts`  
**Issue:** `childLabel` from the agent's plan was used directly in branch names and filesystem paths. A label containing `/` or `..` could escape `~/.pi/cleave/wt/`.  
**Fix:** Sanitize with `replace(/[^a-zA-Z0-9_-]/g, "-").replace(/^\.+/, "")`.

### W2: Duplicated OpenSpec code between cleave and openspec extensions
**Files:** `extensions/cleave/openspec.ts` (681 lines) and `extensions/openspec/spec.ts` (658 lines)  
**Issue:** Both implement change detection, listing, task parsing, and spec reading with different APIs. Will drift and create inconsistencies.  
**Recommendation:** Refactor `cleave/openspec.ts` to import from `openspec/spec.ts` for shared primitives (`listChanges`, `getChange`, `parseSpecsDir`). Keep cleave-specific logic (`taskGroupsToChildPlans`, `writeBackTaskCompletion`) in the cleave module.

### W3: Hardcoded model IDs in model-budget
**File:** `extensions/model-budget.ts`  
**Issue:** `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5` hardcoded. Will need updates when Anthropic releases new versions.  
**Recommendation:** Use a config file or pattern-based model resolution (find latest by prefix).

### W4: Anthropic connectivity check sends billable API request
**File:** `extensions/offline-driver.ts`  
**Issue:** `checkAnthropic()` sends a real `POST /v1/messages` with `max_tokens: 1`. This uses API credits on every session start.  
**Recommendation:** Use a HEAD request or DNS resolution check instead.

### W5: AGENTS.md marker-based management can lose user edits
**File:** `extensions/defaults.ts`  
**Issue:** If a user edits `~/.pi/agent/AGENTS.md` without removing the `<!-- managed by pi-kit -->` marker, their changes are silently overwritten on next session start.  
**Recommendation:** Add a content hash check — if the file has been modified from the last deployed version, warn rather than overwrite.

### W6: SSRF potential in local inference URL
**File:** `extensions/local-inference/index.ts`, `extensions/offline-driver.ts`  
**Issue:** `LOCAL_INFERENCE_URL` env var is used in `fetch()` without validation. Could be pointed at internal network endpoints.  
**Risk:** Low — requires system-level access to set env vars. Standard risk accepted for development tools.

---

## Notes (informational)

### N1: Silent error swallowing
**Files:** Multiple (`00-secrets`, `view`, `mcp-bridge`)  
**Note:** 15+ locations with `catch {}` or `.catch(() => {})`. All are for cleanup, optional tool detection, or fire-and-forget operations. Acceptable pattern but makes debugging harder. Consider adding `catch { /* <reason> */ }` comments consistently.

### N2: No tests for command/UI paths
**Files:** `extensions/design-tree/index.ts`, `extensions/openspec/index.ts`, `extensions/cleave/index.ts`  
**Note:** All domain logic is well-tested via `tree.ts`, `spec.ts`, etc. But the `/design`, `/opsx:*`, and `/cleave` command handlers, tool `execute()` functions, and message renderers have zero test coverage. These are integration-heavy and harder to test without pi mocks, but represent ~40% of the code.

### N3: Design-tree has no SKILL.md
**Note:** Unlike openspec and cleave, design-tree lacks a `SKILL.md` file. The agent relies on system prompt guidelines but has no on-demand skill reference for design exploration workflows.

### N4: Cleave `parseDesignFileChanges` silently drops directory paths
**File:** `extensions/cleave/openspec.ts`  
**Note:** The regex requires file extensions — paths like `src/auth/` are silently ignored. This means design.md entries without file extensions don't get included in the generated task scope.

---

## Extensions Reviewed

| Extension | Lines | Security | Logic | Tests |
|-----------|-------|----------|-------|-------|
| 00-secrets | 832 | ✅ Clean — execSync with `which` only, secret blocklist present | ✅ | ✅ |
| 01-auth | 400 | ✅ Clean — domain logic extracted, pi-tui dependency isolated | ✅ | ✅ 50 tests |
| auto-compact | 42 | ✅ N/A | ✅ | ⚠️ None |
| chronos | 148 | ✅ pi.exec with args array | ✅ | ⚠️ None |
| cleave | ~2300 | ✅ Fixed (W1) | ⚠️ W2 (duplication) | ✅ 231 tests |
| defaults | 78 | ⚠️ W5 (marker overwrite) | ✅ | ⚠️ None |
| design-tree | ~780 | ✅ Has validateNodeId | ✅ | ✅ 54 tests |
| distill | 127 | ✅ N/A | ✅ | ⚠️ None |
| lib/ | ~30 | ✅ N/A | ✅ | ⚠️ None |
| local-inference | ~300 | ⚠️ W6 (SSRF, accepted) | ✅ | ⚠️ None |
| mcp-bridge | 951 | ✅ Clean | ✅ | ⚠️ None |
| model-budget | 178 | ✅ N/A | ⚠️ W3 (hardcoded IDs) | ⚠️ None |
| offline-driver | 270 | ⚠️ W4 (API billing) | ✅ | ⚠️ None |
| openspec | ~1870 | ✅ Fixed (C1, C2) | ✅ | ✅ 53 tests |
| project-memory | ~4600 | ✅ Parameterized SQL, safe spawn | ✅ | ✅ 289 tests |
| render | 508 | ✅ pi.exec with args array | ✅ | ⚠️ None |
| session-log | 174 | ✅ N/A | ✅ | ⚠️ None |
| shared-state | ~60 | ✅ N/A | ✅ | ⚠️ None |
| spinner-verbs | 91 | ✅ N/A | ✅ | ⚠️ None |
| status-bar | 123 | ✅ N/A | ✅ | ⚠️ None |
| style | 281 | ✅ N/A | ✅ | ⚠️ None |
| terminal-title | 92 | ✅ N/A | ✅ | ⚠️ None |
| view | ~650 | ✅ Fixed (C3) | ✅ | ⚠️ None |
| web-search | 303 | ✅ JSON body params, no shell | ✅ | ⚠️ None |

---

## Test Coverage Summary

- **Total tests:** 677 passing, 0 failing
- **Extensions with tests:** 5 of 24 (01-auth, cleave, design-tree, openspec, project-memory)
- **Extensions without tests:** 19 — mostly thin integration layers or simple config extensions
- **Recommended for test coverage:** mcp-bridge (complex state machine), view (rendering paths), render (CLI integration)
