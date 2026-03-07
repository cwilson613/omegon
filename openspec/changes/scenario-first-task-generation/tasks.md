# Tasks: Scenario-First Task Generation

## 1. Annotation Parsing and TaskGroup Extension
<!-- specs: cleave/spec -->
- [ ] Add `specDomains: string[]` field to TaskGroup interface in openspec.ts
- [ ] Parse `<!-- specs: domain/name, ... -->` comments in parseTasksFile — extract from line following group header
- [ ] Handle edge cases: no annotation, multiple domains, whitespace variations
- [ ] Add tests for annotation parsing (3 scenarios from spec)

## 2. Scenario Matching Rewrite
<!-- specs: cleave/spec -->
- [ ] Rewrite scenario-to-child matching in workspace.ts buildDesignSection
- [ ] Implement 3-tier priority: annotation match → scope match → word-overlap fallback
- [ ] Extract matching into a standalone function for testability
- [ ] Add tests for annotation-first matching, scope fallback, and word-overlap fallback

## 3. Orphan Detection and Auto-Inject
<!-- specs: cleave/spec -->
- [ ] After per-child matching, collect scenarios that matched zero children
- [ ] Implement injection target selection: parse When clause for file/function refs, match against child scopes, fall back to word overlap
- [ ] Inject orphaned scenarios with `⚠️ CROSS-CUTTING` prefix
- [ ] Add tests for orphan detection, scope-based injection, word-overlap injection fallback
- [ ] Verify invariant: every scenario in at least one child after matching

## 4. Skill Documentation
<!-- specs: openspec-skill/spec -->
- [ ] Update skills/openspec/SKILL.md with scenario-first grouping guidance
- [ ] Add example showing spec-domain grouped tasks.md with `<!-- specs: ... -->` annotations
- [ ] Update skills/cleave/SKILL.md to document annotation syntax and orphan behavior
