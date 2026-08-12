# Trade Market Direction Fix

## Problem

The trade engine treats all market entries as possible sources when a commodity has no explicit source entry. In Freelancer market data, `src: true` means the base sells the commodity to the player, while `src: false` means the base only buys it from the player.

Discovery 5.3.2 exposes the defect clearly: every `commodity_pob_restock` market entry is buy-only, but their differing purchase prices currently produce tens of thousands of artificial routes because the engine promotes those buyers to sources.

## Scope

Apply the correction in the shared trade engine so it affects every supported mod. Keep the exported JSON schema and existing datasets unchanged because their `src` values already represent the source INI flags correctly.

## Design

During commodity route-index construction, sources consist only of accessible entries whose `src` value is true. If a commodity has no such entries, its source list remains empty and route generation naturally skips it. Sink selection continues to use accessible entries whose `src` value is false.

No Discovery-specific commodity list, exporter filtering, or UI behavior is introduced. All route consumers (`candidateRoutes`, per-system routes, journey routes, and round trips) continue to use the same central index. The current-base calculation already requires an explicit source and therefore needs no behavioral change.

## Testing

Add a synthetic regression fixture containing one commodity with two buy-only bases at different prices. Before the fix, this fixture produces an artificial profitable route; after the fix, it must produce no candidate route.

Retain coverage for a normal commodity with one explicit source and one explicit sink to prove legitimate routes remain available. As an integration check, load the committed Discovery dataset and verify that `commodity_pob_restock` produces no route after the engine correction.

Run the focused trade-engine test first, then all repository Node-based tests.
