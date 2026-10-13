# Implementation Plan - Restrict Reconciliation to Uploaded Machines Sheet

## Problem
When the user uploads only the machines sheet (`s1`), the system previously synthesized extra machines from payment and cash sheets (`repMap`), causing machines not in the uploaded sheet to appear or be searched. The user wants: **"Only show machines that exist in the uploaded sheet"**.

## Proposed Changes

### 1. Update `executeReconciliation` in `src/App.tsx`
- **Strict Machines Sheet Baseline**: If `s1` (machines sheet) has data (`s1.length > 0`), build `reconciliationItems` **strictly** from `s1`. Do **not** add synthetic machines from `repMap` (payment/cash sheets) for machines absent from `s1`.
- **Fallback**: If `s1` is not uploaded (`s1.length === 0`), allow building reconciliation items from `repMap` so payment/cash sheets can still be inspected if uploaded alone.
- This ensures that when the user uploads only the machines sheet, only the machines present in that sheet appear in the reconciliation results and searches.

## Verification Plan
- Compile applet with `compile_applet`.
- Lint codebase with `lint_applet`.
