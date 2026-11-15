# Modul HRIS

Satu folder = satu modul (mis. `attendance`, `payroll`). Bentuknya:

```
modules/<nama>/
├── index.ts   # satu-satunya pintu: yang boleh diimpor modul lain & app/
├── rules/     # aturan bisnis murni (tanpa DB, tanpa React) — paling banyak dites
├── server/    # akses DB & service; tabel dari @petshop/hris-db/schema/<nama>
└── ui/        # komponen React milik modul
```

Pagar yang dijalankan `pnpm lint` (spec L0 §4):

- `@/modules/<lain>/...` dilarang — lewat `@/modules/<lain>` saja (ESLint).
- `@petshop/db` (tabel petshop) dilarang di seluruh app — baca lewat view schema `hris` (ESLint).
- Impor relatif yang keluar dari folder modulnya dilarang (`scripts/check-module-boundaries.mjs`).
- Dari `@petshop/hris-db`, modul hanya boleh `schema/<namanya>` dan `schema/shared`; root
  `@petshop/hris-db` (berisi semua tabel) dilarang di dalam modul (skrip yang sama).

Di dalam modulnya sendiri, pakai impor relatif (`../rules/x`), bukan `@/modules/<namanya>/...`.

Data modul lain selalu diminta lewat fungsi di `index.ts` pemiliknya, tidak lewat tabelnya.
