# Dashboard and lifecycle publisher consolidation — Tasks

## 1. Consolidate OpenSpec dashboard refresh plumbing
<!-- specs: dashboard/publishers -->

- [ ] 1.1 Introduce a shared OpenSpec dashboard refresh helper around publisher/event emission
- [ ] 1.2 Replace repeated inline refresh boilerplate in `extensions/openspec/index.ts` with the shared helper
- [ ] 1.3 Add regression tests for OpenSpec publisher refresh consolidation

## 2. Consolidate design-tree dashboard refresh plumbing
<!-- specs: dashboard/publishers -->

- [ ] 2.1 Introduce a shared design-tree dashboard refresh helper around publisher/event emission
- [ ] 2.2 Replace repeated inline refresh boilerplate in `extensions/design-tree/index.ts` with the shared helper
- [ ] 2.3 Add regression tests for focus-aware design-tree refresh consolidation

## 3. Validate the consolidation slice
<!-- specs: dashboard/publishers -->

- [ ] 3.1 Run targeted OpenSpec and design-tree tests covering consolidated publisher paths
- [ ] 3.2 Run `npm run typecheck`
