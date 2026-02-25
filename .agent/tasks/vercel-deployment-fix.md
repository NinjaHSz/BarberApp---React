# Task: Vercel Deployment Fix & Build Optimization

## 1. Goal

Resolve the Vercel build failure caused by missing environment variables and clean up build warnings related to deprecated metadata fields.

## 2. Problem Analysis

- **Build Error**: `supabaseUrl is required.` occurs during static site generation (SSG) because `process.env.NEXT_PUBLIC_SUPABASE_URL` is undefined.
- **Build Warnings**: `Unsupported metadata viewport/themeColor` are triggered in multiple pages due to Next.js 14+ deprecations.

## 3. Proposed Changes

### 🔧 Fix Build Failure (Supabase)

- Add instructions for the user to add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel.
- Update `src/lib/supabase.ts` to log a clearer error instead of crashing if possible (optional but good for debugging).

### 🧹 Fix Build Warnings (Metadata)

- Update `layout.tsx` and all affected regular pages to use the new `export const viewport` syntax.

## 4. Work Breakdown

### Phase 1: Metadata Cleanup

- [x] Update `src/app/layout.tsx`
- [x] Update `src/app/page.tsx` (Verified no extra metadata)
- [x] Update `src/app/agenda/page.tsx` (Verified no extra metadata)
- [x] Update `src/app/ajustes/page.tsx` (Verified no extra metadata)
- [x] Update `src/app/cartoes/page.tsx` (Verified no extra metadata)
- [x] Update `src/app/clientes/page.tsx` (Verified no extra metadata)

### Phase 2: Supabase Initialization Safety

- [x] Modify `src/lib/supabase.ts` to handle missing env vars better during build.

### Phase 3: Deployment Instructions

- [ ] Provide step-by-step guide for Vercel Dashboard env var configuration.

## 5. Verification

- [ ] Run `npm run build` locally (must simulate missing env vars to test safety).
- [ ] Check console for metadata warnings.
