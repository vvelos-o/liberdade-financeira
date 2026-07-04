# Debug Complete - All Fixes Applied

## Root Causes Found and Fixed

### Bug 1: AI Categorization Not Working
**Root Cause:** The `applyCategories` procedure was missing `pessoal` and `imprevistos` from its z.enum validation. If the AI suggested these categories, the validation would fail silently.
**Fix Applied:** Added `pessoal` and `imprevistos` to all 4 z.enum definitions in pluggy.ts (lines 236, 349, 363, 378).
**Also Fixed:** `applyCategories` now returns `{ applied: number }` so the frontend toast works.

### Bug 2: Salary Added But Not Showing
**Root Cause:** `createIncomeSource` returned MySQL `ResultSetHeader` (which has `insertId` not `id`). The frontend checked `created?.id` which was always `undefined`, so `upsertEntry` was never called. The source was created but no entry (amount) was saved.
**Fix Applied:** Changed `return result[0]` to `return { id: (result[0] as any).insertId as number }` in both `createIncomeSource` and `createFixedExpenseCategory`.
**DB State:** income_entries has 0 rows. income_sources has 5 rows (IDs 1, 60001, 90001, 120001, 120002). User needs to re-add salary with the fix in place.

### Bug 3: Sync Resets Previously Categorized Transactions
**Root Cause (Part A):** `upsertPluggyTransaction` always overwrote the `category` field on duplicate key update, even if the user had already manually categorized it.
**Fix Applied:** Changed to `IF(isReviewed = 0, newCategory, existingCategory)` in the onDuplicateKeyUpdate SQL.

**Root Cause (Part B):** The sync loop used only `autoCategorize()` (hardcoded keywords) and never checked the `category_rules` table (learned rules from user corrections).
**Fix Applied:** Before the sync loop, fetch all learned rules. In the loop, check rules first (pattern match), then fall back to autoCategorize.

### Bug 4: Investment Showing R$1000/month Incorrectly
**Root Cause:** Default value was hardcoded as `"1000"` in getDashboardFunnel and the Historico page.
**Fix Applied:** Changed default to `"0"` in both server/db.ts and client/src/pages/Historico.tsx.

### Bug 5: Only Consider Data from July 2026 Forward
**Root Cause:** Historico investment chart counted from January of current year.
**Fix Applied:** Changed to only count months from July 2026 forward using `(year - 2026) * 12 + (month - 7) + 1`.

## Files Modified
1. `server/db.ts` - createIncomeSource, createFixedExpenseCategory, upsertPluggyTransaction, getDashboardFunnel
2. `server/routers/pluggy.ts` - syncTransactions (rules + autoCategorize), all z.enum definitions, applyCategories return value
3. `client/src/pages/Historico.tsx` - investmentData calculation

## Remaining Issue
The user's existing income_sources (5 rows) have NO income_entries. After the fix, when the user clicks to edit the amount on an existing source and saves, it will call `upsertEntry` which should now work correctly. The user may need to re-enter their salary amount.

## Key Backend API Reference
- `income.createSource` → creates source, returns `{ id: number }`
- `income.upsertEntry` → creates/updates entry for source+year+month
- `income.getSources` → returns all active sources
- `income.getEntries` → returns entries for year+month
- `pluggy.syncTransactions` → syncs from Pluggy, applies rules first, then autoCategorize
- `pluggy.aiSuggestCategories` → calls LLM to suggest categories for uncategorized transactions
- `pluggy.applyCategories` → bulk updates categories, returns `{ applied: number }`
- `pluggy.correctCategory` → updates single transaction + saves rule for future
- `dashboard.getFunnel` → returns totalIncome, totalFixed, investmentTarget, totalCompromissos, disponivel, categories[]
