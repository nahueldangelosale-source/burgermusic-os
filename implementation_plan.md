# Fix TypeScript Errors in Financial Scripts

This plan addresses the TypeScript compiler errors reported in `src/scripts/recalibrate-q1-ledger.ts`, `src/scripts/resolve-dlq-items.ts`, and `src/scripts/seed-q1-sales-history.ts`. The errors primarily stem from `string | undefined` values being passed to Drizzle ORM methods that expect non-nullable strings.

## User Review Required

> [!IMPORTANT]
> The fixes involve using non-null assertions (`!`) and type casting for variables that are already validated at runtime (like `storeId`). This is a safe approach given the existing CLI validation checks at the beginning of each script.

## Proposed Changes

### Financial Scripts

#### [MODIFY] [recalibrate-q1-ledger.ts](file:///d:/Musica%20Descargada/BurgerMusic/src/scripts/recalibrate-q1-ledger.ts)
- Assert `storeId` as `string` after the initial check so subsequent usages don't error.
- Use non-null assertion for `txRecord.id` when calling `TransactionExplosionEngine.explode`.
- Ensure `.values()` objects match the schema expectations to satisfy overload selection.

#### [MODIFY] [resolve-dlq-items.ts](file:///d:/Musica%20Descargada/BurgerMusic/src/scripts/resolve-dlq-items.ts)
- Similar to above, ensure `storeId` is treated as a non-nullable string in Drizzle queries.
- Assert `parentTx.id` as non-nullable.

#### [MODIFY] [seed-q1-sales-history.ts](file:///d:/Musica%20Descargada/BurgerMusic/src/scripts/seed-q1-sales-history.ts)
- Apply the same pattern for `storeId` narrowing and transaction ID assertions.

## Open Questions

None at this time. The errors are standard type mismatch issues in a Drizzle/TypeScript environment.

## Verification Plan

### Automated Tests
- Run the TypeScript compiler to verify that the reported errors are resolved:
  ```powershell
  npx tsc --noEmit
  ```
- Run a dry-run of one of the scripts (if possible without database impact) to ensure no regressions:
  ```powershell
  npx tsx src/scripts/recalibrate-q1-ledger.ts --store-id=TEST
  ```
  *(Note: Since these are destructive scripts, I will mainly rely on `tsc` for verification of the specific reported problems.)*
