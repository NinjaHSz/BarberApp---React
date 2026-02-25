# Task: Rebuild BarberApp to Next.js

Reconstruct the BarberApp into a modern Next.js application, maintaining the monochromatic dark pure design and improving code organization.

## 1. Analysis Phase

- **Tech Stack**: Next.js (App Router), TypeScript, Tailwind CSS, TanStack Query (React Query), Supabase.
- **Design System**: Monochromatic Dark Pure (Zero borders, glassmorphism, depth-based elevation).
- **Core Features**: Dashboard (KPIs & Charts), Client Management, Appointment Scheduling, Expense Tracking, Cards/Inventory.

## 2. Planning Phase

- [ ] Initialize Next.js project structure.
- [ ] Configure Tailwind CSS with the design system tokens.
- [ ] Setup Supabase Client and React Query provider.
- [ ] Define shared Types/Interfaces.
- [ ] Implement UI Layout (Sidebar + Shell).

## 3. Solutioning Phase (Implementation Roadmap)

- **Phase 1: Foundation**
  - Setup `tailwind.config.ts` and `globals.css`.
  - Create the UI layout and navigation.
- **Phase 2: Data & API**
  - Setup `useSupabase` and `queryKey` patterns.
  - Implement hooks for Clients, Procedures, and Expenses.
- **Phase 3: Pages & Components**
  - Dashboard with Charts.
  - Client Management (List + Profile).
  - Appointments / Scheduling logic.
  - Expenses tracking.
- **Phase 4: Polish**
  - Offline support (Service Worker/PWA).
  - Premium animations and transitions.

## 4. Implementation Phase

_Pending completion of stages 1-3._

## Verification Criteria

- All frontend features of the original app must be functional.
- Zero borders constraint must be followed.
- Performance (React Query caching) should be visibly improved.
- Mobile experience must be parity with original.
