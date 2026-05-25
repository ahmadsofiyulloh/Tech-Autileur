# Release and Deploy Runbook

## Identitas

- Nama aplikasi: `Banplex OS`
- Pemilik: `Dzul Qornain`
- Hak cipta: `Copyright 2026 Dzul Qornain`
- Versi app tampil di footer shell dan `Settings > Tentang`.

## Versioning

- Format build number: `YYYY.MM.DD.N`.
- `N` berasal dari jumlah commit pada tanggal commit HEAD.
- `npm run build` menjalankan `prebuild`, lalu `scripts/write-release-meta.mjs` membuat `public/release-meta.json`.
- `public/release-meta.json` di-ignore supaya build lokal tidak membuat worktree dirty.
- Fallback jika metadata tidak ada: `package.json` version.

Command lokal:

```powershell
npm run release:meta
npm run build
```

## Changelog

- `docs/CHANGELOG.md` wajib diupdate untuk setiap perubahan code, schema, docs, workflow, atau UI.
- AI agent harus menulis changelog dari diff, commit, dan docs aktual.
- Jangan menulis release note spekulatif.
- Gunakan generator jika ingin mengisi riwayat dari commit:

```powershell
npm run changelog:generate
npm run changelog:check
```

## Supabase DB Push

Project refs:

```text
Dev:        czpjccljowyldtvycxlq
Production: laychawloumnhvzgegmj
```

Repo-local token file:

```powershell
.\scripts\supabase.ps1 set-token <SUPABASE_ACCESS_TOKEN>
```

Token disimpan di `.env.supabase.local` pada root repo dan file itu sudah diabaikan oleh `.gitignore` melalui pola `.env.*.local`. Wrapper ini hanya menyuntikkan token ke proses Supabase yang sedang berjalan, tanpa menyimpan sesi CLI global.

Apply ke dev lebih dulu:

```powershell
.\scripts\supabase.ps1 link --project-ref czpjccljowyldtvycxlq
Get-Content supabase/.temp/project-ref
.\scripts\supabase.ps1 migration list --linked
.\scripts\supabase.ps1 db push --dry-run --linked
.\scripts\supabase.ps1 db push --linked
.\scripts\supabase.ps1 db lint --linked --fail-on warning
```

Apply ke production setelah dev pass:

```powershell
.\scripts\supabase.ps1 link --project-ref laychawloumnhvzgegmj
Get-Content supabase/.temp/project-ref
.\scripts\supabase.ps1 migration list --linked
.\scripts\supabase.ps1 db push --dry-run --linked
.\scripts\supabase.ps1 db push --linked
.\scripts\supabase.ps1 migration list --linked
```

Verify RLS dan grants:

```powershell
.\scripts\supabase.ps1 db query --linked --agent=no "select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('external_api_keys','external_api_key_secrets','external_generation_tasks','share_product_links','share_generations');"
```

Catatan: Supabase mulai mengetatkan Data API exposure untuk tabel baru, jadi migration Share Workspace menambahkan grants eksplisit untuk role `authenticated` dan tetap revoke `anon`.

## Git Push

Setelah DB production sudah siap:

```powershell
npm run audit:colors
npm run audit:typography
npm run audit:neutral-ui
npm run lint
npm run typecheck
npm run build
npm run changelog:check
git status --short
git push origin main
```
