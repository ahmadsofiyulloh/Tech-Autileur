---
name: share-workspace-redesign
description: Share workspace UX redesign — multi-page route with platform picker, product list, drawer input/output/history, and regenerate flow
type: feature
date: 2026-05-23
---

# Share Workspace Redesign — Design Specification

## Context

Operator membutuhkan workspace terpisah untuk generate caption manual share ke platform sosial (Facebook, Threads, X, Pinterest). Flow saat ini adalah prototype mock-only di `/share` dengan single-page state. Redesign ini mengubah UX menjadi multi-page route dengan platform picker, product list lintas workspace, drawer input/output, dan history regenerate seperti prompt history.

**Tujuan:**
- Operator pilih platform dulu → list produk → generate caption per produk per platform.
- Affiliate URL wajib sebelum generate, dipakai untuk CTA caption hasil Gemini.
- History menyimpan semua versi generate per produk per platform; operator bisa regenerate dari batch lama.
- UI seamless dengan pattern `/products` di semua breakpoint.

## Route Architecture

### Multi-page URL-driven state (approved approach)

```
/share
  → Platform workspace picker (entrypoint)

/share/[platform]
  → Product list untuk platform terpilih
  → [platform] = facebook | threads | x | pinterest

/share/[platform]?detail=[productId]&tab=[output|history]
  → Drawer input/output/history
  → detail = product ID
  → tab = output (default after generate) | history (all versions)
```

**Rationale:**
- URL-driven state = deep-linkable, back button natural, SSR-friendly.
- Consistent dengan pattern `/products` yang sudah ada.
- Platform jadi segment URL, bisa bookmark/share link langsung ke workspace platform tertentu.
- Drawer state lewat searchParam `detail` dan `tab` seperti product detail existing.

## UX Flow

### Step 1: Platform Workspace Picker (`/share`)

- Halaman entrypoint menampilkan 4 platform cards: Facebook, Threads, X, Pinterest.
- Card layout: 2-column grid mobile (360-767), 3-4 column tablet/desktop (768+).
- Card visual mengikuti rasa tool picker seperti ai-media, tapi memakai token dan bahasa visual operator dashboard.
- Klik card → navigate ke `/share/[platform]`.

### Step 2: Product List (`/share/[platform]`)

- List produk nyata dari Supabase, **lintas semua affiliate profile/workspace** (tidak terisolasi per workspace seperti `/products`).
- Pattern UI mengikuti `/products`:
  - Desktop (1024+): dense table, operator detail layout (list kiri, drawer kanan).
  - Mobile (360-767): product cards, drawer jadi full-screen mobile drawer (seperti product/prompt detail).
  - Tablet (768-1023): hybrid pattern existing.
- Toolbar: search input, summary badge (jumlah item, platform context), filter chips bila diperlukan.
- Status badge per produk: `Perlu Link Affiliate`, `Siap Generate`, `Selesai`, `Error`.
- Pagination: keyset desktop, infinite scroll mobile (seperti product list existing).

### Step 3: Drawer Input

- Operator pilih produk → drawer terbuka di mode input (tabless state).
- Drawer menampilkan:
  - **Product hero**: image, nama, marketplace platform, status badge.
  - **Tombol Buka Produk**: deep-link ke `product_url` (field existing di products table). Membuka aplikasi marketplace ke halaman produk.
  - **Field Affiliate URL**: input text, wajib sebelum generate. Satu nilai umum per produk (bukan per platform). Dipakai hanya untuk CTA caption hasil Gemini.
  - **Platform selector**: readonly/display-only, sudah terpilih dari route `/share/[platform]`.
  - **Angle selector**: 6 opsi (Fokus Manfaat, Solusi Masalah, Bukti Sosial, Urgensi & Kelangkaan, Edukatif, Cerita).
  - **Variant count**: 1-4 varian.
  - **CTA Generate**: disabled bila affiliate_url kosong.
- Validasi: affiliate_url wajib. Bila kosong, tampilkan inline warning dan disable tombol generate.

### Step 4: Generate

- Operator klik Generate → API call ke backend generate endpoint.
- Backend memakai:
  - `product_id` dari drawer.
  - `platform` dari route segment.
  - `angle` dan `variant_count` dari drawer input.
  - `affiliate_url` dari field input (dimasukkan ke prompt Gemini untuk CTA caption).
- Generate membuat batch baru di `share_generations` table.
- Setelah sukses, URL redirect ke `?detail=[productId]&tab=output`.

### Step 5: Drawer Output & History

- Drawer beralih ke mode tabbed: **Output** dan **History**.
- **Tab Output**: menampilkan hasil generate terbaru (latest batch).
  - Layout: list varian caption dengan action Copy dan Manual Share per varian.
  - Status badge per varian: angle, platform.
- **Tab History**: menampilkan semua batch generate per produk per platform.
  - Layout mengikuti prompt history pattern: list batch dengan timestamp, angle, varian count, preview caption.
  - Action per batch: **Regenerate** (buka drawer input dengan setting batch tersebut, operator bisa edit, lalu generate lagi).
- **Regenerate flow**: klik batch di History → drawer input terbuka dengan angle/varian dari batch tersebut → operator edit bila perlu → generate → hasil baru jadi Output terbaru, batch lama tetap di History.

## Data Model

### Existing tables (reuse)

**`products`**
- `id`, `name`, `image_url`, `marketplace_platform`, `product_url` (existing).
- `product_url` dipakai untuk tombol **Buka Produk** di drawer input.

### New tables (to be created)

**`share_product_links`**
- `id` (uuid, PK)
- `user_id` (uuid, FK auth.users, RLS owner)
- `product_id` (uuid, FK products)
- `affiliate_url` (text, wajib)
- `created_at`, `updated_at`
- Unique constraint: `(user_id, product_id)`
- Satu affiliate URL per produk per owner, dipakai untuk semua platform share.

**`share_generations`**
- `id` (uuid, PK)
- `user_id` (uuid, FK auth.users, RLS owner)
- `product_id` (uuid, FK products)
- `platform` (text: facebook | threads | x | pinterest)
- `angle` (text: benefit_focused | problem_solution | social_proof | urgency_scarcity | educational | storytelling)
- `variant_count` (int: 1-4)
- `output_json` (jsonb: array of {caption, angle, platform_specific_fields})
- `status` (text: generating | generated | error)
- `error_message` (text, nullable)
- `created_at`
- Index: `(user_id, product_id, platform, created_at DESC)` untuk query history per produk per platform.

## UI Composition Per Breakpoint

### `/share` (platform picker)

- **360-767**: 2-column card grid, stack vertical, safe-area padding.
- **768-1023**: 3-column card grid, lebih lega.
- **1024+**: 4-column card grid atau 2-column dengan card lebih besar (pilih saat implementasi).

### `/share/[platform]` (product list + drawer)

- **360-767**:
  - Product cards mobile (seperti `/products` mobile).
  - Drawer jadi full-screen mobile drawer, mengikuti behavior detail product/prompt existing; bukan bottom sheet.
  - Search/filter toolbar stack vertical.
- **768-1023**:
  - Hybrid pattern existing (table atau cards tergantung breakpoint threshold existing).
  - Drawer overlay kanan atau full-screen mobile drawer (ikuti pattern existing product/prompt detail).
- **1024-1279 dan 1280+**:
  - Operator detail layout: list kiri (dense table), drawer kanan.
  - Drawer fixed width, scroll independent.
  - Toolbar horizontal: search kiri, summary kanan.

### Drawer states

- **Input (tabless)**: product hero, tombol Buka Produk, field affiliate URL, angle/varian selector, CTA generate.
- **Output/History (tabbed)**: tab nav seperti product detail tabs, content area scroll independent.

## Component Reuse

- `OperatorDetailDrawer` (drawer shell — full-screen on mobile, side panel on desktop)
- `operator-detail-layout` (list + drawer split)
- `product-list-contract` pattern (URL state, pagination, filter)
- `StatusBadge`, `SectionCard`, `CopyableReadOnlyField`, `PendingActionButton`
- `EmptyState`, `ErrorState`, `LoadingState`
- Prompt history tab pattern untuk History layout dan regenerate action

## Generate Behavior

1. Operator pilih produk dari list → drawer input terbuka.
2. Bila `affiliate_url` belum ada, field kosong dan generate disabled.
3. Operator isi `affiliate_url`, pilih angle, varian count.
4. Klik Generate → backend call dengan `product_id`, `platform` (dari route), `angle`, `variant_count`, `affiliate_url`.
5. Backend generate caption lewat Gemini, memakai `affiliate_url` untuk CTA caption.
6. Hasil disimpan ke `share_generations`, status `generated`.
7. URL redirect ke `?detail=[productId]&tab=output`.
8. Tab Output menampilkan hasil terbaru; tab History menampilkan semua batch.
9. Dari History, operator bisa klik batch → regenerate → drawer input terbuka dengan setting batch tersebut → edit → generate lagi → hasil baru jadi Output terbaru.

## Verification & Testing

- Run `npm run audit:colors`, `npm run audit:typography`, `npm run audit:neutral-ui`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Smoke test: `npm run smoke:e2e` untuk route behavior dan responsive shell.
- Manual test per breakpoint: 360px, 768px, 1024px, 1280px.
- Test flow: platform picker → list → drawer input → generate (mock atau live) → output → history → regenerate.
- Test states: loading, empty, error, affiliate URL missing, generate success/error.

## Critical Files

- `src/app/share/page.tsx` (platform picker)
- `src/app/share/[platform]/page.tsx` (product list)
- `src/app/share/[platform]/share-product-list.tsx` (list component)
- `src/app/share/[platform]/share-drawer.tsx` (drawer input/output/history)
- `src/lib/share/share-list-contract.ts` (URL state, pagination)
- `src/lib/server/share-generations.ts` (server actions)
- `src/styles/05-features/share-workspace.css` (feature CSS)
- Migration files untuk `share_product_links` dan `share_generations` tables

## Out of Scope (MVP)

- Auto-generate affiliate URL dari marketplace API.
- Bulk generate untuk multiple produk.
- Schedule/queue share post.
- Direct post ke platform sosial (manual share only).
- Analytics/tracking share performance.
- Workspace isolation untuk share (semua produk eligible muncul lintas profile).

## Design Decisions

- **Multi-page route** dipilih karena URL-driven state, deep-linkable, SSR-friendly, dan consistent dengan `/products` pattern.
- **Affiliate URL terpisah dari product_url** karena product_url adalah link marketplace asli, sementara affiliate_url adalah link komisi operator yang dipakai hanya untuk CTA caption.
- **History per produk per platform** karena operator perlu track versi caption untuk satu produk di satu platform, bukan lintas platform.
- **Regenerate dari History** mengikuti prompt history pattern karena flow sudah familiar dan proven.
- **Data asli Supabase** untuk list produk karena operator mau kerja dengan produk nyata, bukan mock.
- **Platform picker sebagai entrypoint** karena operator perlu pilih platform dulu sebelum melihat list produk (context-first workflow).
