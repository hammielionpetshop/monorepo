<!-- markdownlint-disable MD013 -->

# Backoffice POS Branch Bound Read Hold Design

## Goal

Stage 3 mengunci endpoint POS read dan hold bill agar data cabang selalu mengikuti sesi POS terautentikasi, bukan `branchId` dari query atau body request.

## Scope

File yang masuk Stage 3:

- `apps/backoffice/app/api/pos/bootstrap/route.ts`
- `apps/backoffice/app/api/pos/stock-snapshot/route.ts`
- `apps/backoffice/app/api/pos/users/route.ts`
- `apps/backoffice/app/api/pos/open-bills/route.ts`
- `apps/backoffice/app/api/pos/open-bills/[id]/route.ts`
- Test route untuk endpoint di atas bila diperlukan.
- `apps/backoffice/CHANGELOG.md`

Di luar scope Stage 3:

- POS purchase order receiving.
- POS stock opname.
- Shift join/stop/settle hardening.
- Stock FIFO concurrency dan UOM conversion validation.
- Ekstraksi helper auth besar lintas seluruh API.

## Current Risk

Beberapa endpoint POS masih memakai `branchId` dari query atau body, dengan default `1` bila kosong. Akibatnya user yang sudah login bisa membaca bootstrap data, snapshot stok, daftar user POS, atau hold bill cabang lain dengan mengganti parameter. Open bill delete juga menghapus berdasarkan `id` saja tanpa branch scope.

## Selected Approach

Gunakan pola Stage 2: route-local cookie auth, `verifyAccessToken`, dan `getPosBranchId(payload, cookieStore)`. Endpoint boleh menerima `branchId` lama demi kompatibilitas client, tetapi nilainya harus sama dengan cabang sesi POS. Bila berbeda, route menolak request dengan error Bahasa Indonesia.

Pendekatan ini kecil blast radius-nya karena tidak mengubah bentuk response utama. Query tetap mengembalikan data yang sama, hanya cabang sumbernya yang dikunci ke sesi.

## Endpoint Behaviour

### Bootstrap

`GET /api/pos/bootstrap`:

- Invalid session: `401`.
- Query `branchId` berbeda dari sesi POS: `403`.
- Query `branchId` kosong: gunakan cabang sesi POS.
- Data produk, stok, harga, customer, kategori, payment method, supplier tetap dalam shape yang sama.

### Stock Snapshot

`GET /api/pos/stock-snapshot`:

- Invalid session: `401`.
- Query `branchId` berbeda dari sesi POS: `403`.
- Query `branchId` kosong: gunakan cabang sesi POS.
- Response tetap array `{ id, stock }`.

### POS Users

`GET /api/pos/users`:

- Invalid session: `401`.
- Query `branchId` berbeda dari sesi POS: `403`.
- Query `branchId` kosong: gunakan cabang sesi POS.
- Response tetap user POS untuk cabang sesi.

### Open Bills

`GET /api/pos/open-bills`:

- Invalid session: `401`.
- Query `branchId` berbeda dari sesi POS: `403`.
- Query `branchId` kosong: gunakan cabang sesi POS.
- Response tetap daftar open bill cabang sesi.

`POST /api/pos/open-bills`:

- Invalid session: `401`.
- Non-JSON: `415`.
- Payload invalid: `400`.
- Body `branchId` berbeda dari sesi POS: `403`.
- Insert selalu memakai cabang sesi POS.

`DELETE /api/pos/open-bills/[id]`:

- Invalid session: `401`.
- ID invalid: `400`.
- Delete memakai `id` dan cabang sesi POS.
- Jika tidak ada row terhapus: `404`.

## Testing Strategy

Gunakan Vitest route tests dengan mock `next/headers`, `@/lib/auth`, dan `@/lib/db`, mengikuti pola Stage 2.

Minimal test:

- Bootstrap menolak query branch spoof dan tidak menjalankan query data.
- Stock snapshot memakai branch sesi saat query kosong.
- Users menolak branch spoof.
- Open bills POST memakai branch sesi dan menolak body branch spoof.
- Open bills DELETE memakai `id` dan cabang sesi.

## Acceptance Criteria

- Semua endpoint Stage 3 memiliki route-local auth.
- Tidak ada endpoint Stage 3 yang memakai default branch `1`.
- `branchId` query/body tidak bisa dipakai untuk akses cabang lain.
- Open bill delete tidak bisa menghapus bill cabang lain.
- Error response memakai Bahasa Indonesia dan tidak mengembalikan raw `err.message`.
- Targeted Vitest Stage 3 lulus.
- `pnpm --filter backoffice exec tsc --noEmit` lulus.
- Markdownlint untuk dokumen Stage 3 dan changelog lulus.
