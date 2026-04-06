# Implementation Plan - Zero-State Auth & Tenant Reconciliation

This plan implements the **P0 Security Directive** to fortify the authentication layer and rehydrate the system with a master tenant user following the database reconstruction.

## User Review Required

> [!IMPORTANT]
> **Schema Evolution:** The current `users` table lacks an `email` field and uses `pin_hash` instead of `passwordHash`. I propose evolving the schema to align with the Security Architect's vision while maintaining backward compatibility where possible.
> 
> **Session Architecture Change:** The requested `requireManagerSession` currently assumes the `session_token` cookie value matches the `user.id`. This differs from the existing JWT-based session in `auth.ts`. I will implement the requested logic, which focuses on database-backed session validation.

## Proposed Changes

### 1. Database Schema Evolution

#### [MODIFY] [schema.ts](file:///d:/Musica%20Descargada/BurgerMusic/src/db/schema.ts)
- Update `users` table:
  - Add `email` field (text, unique).
  - Add `passwordHash` field (text) to replace or coexist with `pin_hash`.
  - Update `role` enum to include `MANAGER_LOCAL`, `OWNER_GLOBAL`, etc.

### 2. Authentication Logic

#### [NEW] [auth-action.ts](file:///d:/Musica%20Descargada/BurgerMusic/src/lib/auth-action.ts)
- Implement `requireManagerSession` with:
  - **Fail-Closed Shield:** Validates `session_token` existence.
  - **O(1) Extraction:** Queries Turso DB and resolves the array result.
  - **Orphan Guard:** Validates that the returned user has a valid `storeId`.

### 3. System Rehydration

#### [NEW] [seed-users.ts](file:///d:/Musica%20Descargada/BurgerMusic/src/db/seed-users.ts)
- Implement the master user seed script:
  - Injects `admin@burgermusic.com` with `STR_DEFAULT` and `MANAGER_LOCAL` role.
  - Uses `onConflictDoNothing` for idempotencia.

## Verification Plan

### Automated Verification
- Run `npx drizzle-kit generate` and `npx drizzle-kit migrate` to apply schema changes.
- Execute the seed script: `npx tsx src/db/seed-users.ts`.
- Verify the user exists in `local.db` using a test query.

### Manual Verification
- Verify that the application correctly catches the `AUTH_MISSING` error when no cookie is present.
- Verify that a valid session (cookie matching user ID) allows access to protected data fetchers.
