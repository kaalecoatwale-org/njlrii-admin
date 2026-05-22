# 🧠 NJLRII Admin Panel - Agent Handover & Technical Context

Welcome, future Antigravity agent! This document contains the complete context, architectural patterns, design guidelines, database schemas, and critical bug resolutions for the **NJLRII Subdomain Admin Panel** (ISSN: 2582-8665). 

Read this first before writing any code or modifying schemas to maintain the codebase's high premium quality and technical stability.

---

## 🚀 1. Project & Technical Stack Summary

* **Domain & Purpose:** Academic double-blind peer-review and scholarly publishing dashboard for managing release volumes, released issues, manuscripts, peer reviewer scorecards, and blog updates.
* **Core Framework:** Next.js 16.2.6 (App Router) + React 19 + TypeScript.
* **Database Backend:** Supabase (PostgreSQL with Row-Level Security, triggers, and automated profile hydration).
* **Styling System:** Vanilla CSS (`src/app/globals.css`). The application uses a custom visual identity characterized by crimson academic accents (`#fc0434`), slate backgrounds (`#f8fafc`), dark charcoal sidebars (`#0f172a`), and glassmorphism drops.
* **No Tailwind Rule:** Avoid utilizing Tailwind CSS unless explicitly requested. Maximize and extend CSS variables within `globals.css` to maintain visual coherence.

---

## ⚠️ 2. Critical Stability Rules & Solved Traps

Any incoming agent must strictly respect these rules to prevent system freezes or build breakages:

### Rule A: Disable Turbopack in Development
* **Trap:** Next.js Turbopack compiler (`next dev --turbo`) crashes regularly under macOS environments due to filesystem compaction errors, deleting SST sorted files, and returning fatal Rust panic traces. This corrupts Hot Module Replacement (HMR) and serves empty JS chunks, freezing page loads.
* **Solution:** We explicitly locked the `dev` script in `package.json` to standard stable Webpack. **Always run development mode using Webpack:**
  ```bash
  npm run dev          # Maps directly to: next dev --webpack
  ```

### Rule B: Routing & Hydration Guards (Preventing White Screens)
* **Trap:** During page refresh, Next.js page components read authentication and profile variables from the React Auth Context. Because profile fetches are asynchronous, rendering `null` during this flight time flashes/freezes into a blank white screen.
* **Solution:** Every page must mount the premium, branded `<PageLoader />` rather than returning `null` during active profile hydration:
  ```typescript
  if (loading || (user && !profile)) return <PageLoader message="Loading workspace..." />;
  if (!user || !profile) return null;
  ```

### Rule C: Guard React Controlled Forms from Null Database Values
* **Trap:** Supabase tables occasionally return `null` for uncompleted fields (e.g., draft paper abstract). React throws fatal controlled warnings when mapping a database `null` value directly to a controlled form element's `value` prop.
* **Solution:** Always wrap database hydration states with fallback empty string guards:
  ```typescript
  setTitle(papData.title || '');
  setAbstract(papData.abstract || '');
  ```

---

## 🎨 3. UI Design Standards & Responsive Grid System

All custom layout blocks are mapped to responsive, viewport-aware classes inside [`src/app/globals.css`](file:///Users/ayush/Downloads/njlrii%20admin%20panel/src/app/globals.css):
* **`.split-grid-users` (User Directory):** 2-column split (Register / Invite Form) on desktop; stacks gracefully on screens `< 1024px`.
* **`.split-grid-editorial` (Volumes & Issues):** Stacks active release catalogs above registration panels on screens `< 768px`.
* **`.split-grid-wysiwyg` (Blog/Announcements):** Stacks compositions above detail logs on screens `< 1024px`.
* **`.responsive-metrics-grid` / `.metrics-grid`:** Scales metric cards fluidly (5 columns on desktop, 3 columns on tablet, 2 columns on mobile, 1 column on phones).
* **Hamburger Drawer Lock:** Mobile sidebars slide completely offscreen on translate triggers. Media queries explicitly set sidebar widths to `260px !important` so that absolute children (logos, headers) do not bleed onto dashboards.

---

## ⚡ 4. High-Performance Server-Side Pagination

The **Research Papers Index** has been upgraded to a high-speed, egress-optimized server-side range paginated system:
* **Pagination State:** Default page sizing is set to **10 items per page** (`pageSize`).
* **Supabase Slicing API:** Fetches only the active range using `.range(from, to)` to keep load speeds blazing fast and database bandwidth near-zero:
  ```typescript
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  ```
* **Unified State Caching:** Counts are obtained in a single round-trip using `{ count: 'exact' }`. Search queries and release filter options are hard-coded to reset `currentPage` back to `1` on change to prevent out-of-bounds mismatches.
* **Monospace Copy chips:** Long text identifiers (e.g., `#njlrii-v6-i3-cybersecurity...`) are contained inside monospace `.monospace-id-chip` capsules using strict max-width boundaries and text overflow ellipsis, alongside an active clipboard copying utility.

---

## 🗄️ 5. Database Schema Snapshot

Our Supabase PostgreSQL layout is structured around these primary tables:

1. **`public.user_profiles`**
   * Fields: `id UUID PRIMARY KEY`, `email TEXT`, `full_name TEXT`, `role TEXT` (super_admin, editor, student_editor, reviewer, author), `created_at TIMESTAMP`.
   * Row-Level Security (RLS) handles automatic profile mapping upon signup using trigger function `public.handle_new_user()`.
2. **`public.manuscripts`**
   * Fields: `id BIGINT IDENTITY PRIMARY KEY`, `primary_author_id UUID REFERENCES auth.users`, `title TEXT`, `abstract TEXT`, `keywords TEXT[]`, `manuscript_pdf_url TEXT`, `status TEXT` (submitted, under_review, revision, accepted, rejected), `assigned_editor_id UUID`.
3. **`public.reviewer_assignments`**
   * Fields: `id BIGINT IDENTITY PRIMARY KEY`, `manuscript_id BIGINT`, `reviewer_id UUID`, `status TEXT` (pending, accepted, declined, completed).
4. **`public.peer_reviews`**
   * Fields: `id BIGINT IDENTITY PRIMARY KEY`, `assignment_id BIGINT REFERENCES public.reviewer_assignments`, `score_originality INT` (1-10), `score_structure INT` (1-10), `score_citation INT` (1-10), `comments_for_author TEXT`, `comments_for_editor TEXT`.
5. **`public.papers`** (Published Academic Registry)
   * Fields: `id` (Auto-incrementing serial or text slug), `issue_id BIGINT REFERENCES issues`, `title TEXT`, `abstract TEXT`, `keywords TEXT[]`, `pdf_url TEXT`, `slug TEXT`, `author_metadata JSONB` (Array of Author structures), `published_at TIMESTAMP`.

---

## 🗺️ 6. Current Roadmap & Next Steps

When resuming or continuing execution, focus on:
1. **Editorial Dashboard Analytics:** Linking the overview page charts directly to database counts using high-performance Supabase aggregate functions rather than mock states.
2. **Double-Blind Anonymizer:** Implementing a reviewer screening view that automatically strips author names and affiliations from manuscripts when rendered inside a reviewer’s profile screen.
3. **Automated PDF Parser:** Integrating a cloud storage validator verifying that files uploaded by authors are valid PDF formats under 10MB prior to triggering database inserts.
