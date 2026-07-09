import * as dotenv from 'dotenv';
import path from 'path';
import { createDb } from '../index';
import { roles, permissions, rolePermissions } from '../schema/users';

/**
 * Seed katalog permission + peta role -> permission (Fase Plumbing RBAC, item R2).
 *
 * PRINSIP: PARITY. Peta `roles` di tiap entri meniru konstanta `_ROLES` yang dipakai
 * route saat ini (verifikasi 2026-07-08) — TIDAK mengubah siapa boleh apa. Perubahan
 * kebijakan (bila ada) diputuskan saat migrasi domain (fase R6), bukan di sini.
 *
 * IDEMPOTENT: `permissions.code` unique & `role_permissions` PK (roleId, permissionId),
 * jadi `onConflictDoNothing()` membuat seed aman dijalankan berulang.
 *
 * ANOMALI — KEPUTUSAN FINAL (Owner, 2026-07-09; ditegakkan di R6, lihat backlog domain-migration):
 * - A1 `stock_opname.approve`: aktual approve/reject = ['OWNER','MANAGER'] (GM tak bisa). KEPUTUSAN:
 *   TAMBAH GM → OWNER/GM/MANAGER (GM di atas MANAGER secara hierarki; eksklusi lama dianggap bug).
 *   Perubahan perilaku → ditegakkan + dicatat CHANGELOG saat M4.
 * - A2 `return.cancel`: hanya OWNER (retur/[id]/cancel: `payload.role !== 'OWNER'`). KEPUTUSAN:
 *   PERTAHANKAN OWNER-only (aksi sensitif). Tanpa perubahan perilaku.
 * - A3 `inventory.adjustment.manage`: route `inventory/stock-adjustment` saat ini TIDAK punya gate
 *   role — hanya scope cabang (role apa pun boleh untuk cabang sendiri). KEPUTUSAN: KETATKAN ke
 *   matriks OWNER/GM/MANAGER (tutup celah). Perubahan perilaku → ditegakkan + CHANGELOG saat M4.
 */

type RoleName = 'OWNER' | 'GM' | 'MANAGER' | 'KASIR' | 'GUDANG' | 'FINANCE';

interface PermissionSeed {
  code: string;
  name: string;
  description: string;
  roles: RoleName[];
}

// Satu sumber kebenaran: katalog (§4) + matriks role (§5) rencana RBAC.
export const PERMISSION_CATALOG: PermissionSeed[] = [
  // --- Master Data (route asal: ['OWNER','GM']) ---
  { code: 'master.category.manage', name: 'Kelola Kategori', description: 'CRUD kategori', roles: ['OWNER', 'GM'] },
  { code: 'master.brand.manage', name: 'Kelola Brand', description: 'CRUD brand', roles: ['OWNER', 'GM'] },
  { code: 'master.supplier.manage', name: 'Kelola Supplier', description: 'CRUD supplier', roles: ['OWNER', 'GM'] },
  { code: 'master.uom.manage', name: 'Kelola Satuan', description: 'CRUD satuan (UOM)', roles: ['OWNER', 'GM'] },
  { code: 'master.payment_method.manage', name: 'Kelola Metode Bayar', description: 'CRUD metode pembayaran', roles: ['OWNER', 'GM'] },
  { code: 'master.product.manage', name: 'Kelola Produk', description: 'Ubah produk, konversi UOM, barcode', roles: ['OWNER', 'GM'] },
  { code: 'master.price.manage', name: 'Kelola Harga', description: 'Ubah harga jual/beli, salin harga', roles: ['OWNER', 'GM'] },

  // --- Inventory ---
  { code: 'inventory.adjustment.manage', name: 'Stock Adjustment', description: 'Penyesuaian stok manual', roles: ['OWNER', 'GM', 'MANAGER'] },
  { code: 'stock_opname.create', name: 'Buat Stock Opname', description: 'Membuat sesi stock opname', roles: ['OWNER', 'GM', 'MANAGER'] },
  { code: 'stock_opname.read', name: 'Lihat Stock Opname', description: 'Lihat riwayat stock opname', roles: ['OWNER', 'GM', 'MANAGER'] },
  { code: 'stock_opname.approve', name: 'Approve Stock Opname', description: 'Approve/reject stock opname', roles: ['OWNER', 'GM', 'MANAGER'] },
  { code: 'damaged_goods.read_global', name: 'Barang Rusak Lintas Cabang', description: 'Lihat barang rusak semua cabang', roles: ['OWNER', 'GM'] },

  // --- Purchase Order & Internal Transfer ---
  { code: 'po.manage', name: 'Kelola PO', description: 'Buat/ubah/hapus purchase order', roles: ['OWNER', 'GM', 'MANAGER'] },
  { code: 'po.approve', name: 'Approve PO', description: 'Approve PO & penerimaan barang', roles: ['OWNER', 'GM'] },
  { code: 'po.financial', name: 'Finansial PO', description: 'Ubah invoice/nilai finansial PO', roles: ['OWNER', 'GM'] },
  { code: 'internal_transfer.manage', name: 'Kelola Transfer Internal', description: 'Buat/ubah IBT', roles: ['OWNER', 'GM'] },
  { code: 'internal_transfer.stock_check', name: 'Cek Stok Transfer', description: 'Cek & potong stok IBT', roles: ['OWNER', 'GM', 'MANAGER', 'GUDANG'] },
  { code: 'internal_transfer.receive', name: 'Terima Transfer', description: 'Terima barang IBT', roles: ['OWNER', 'GM', 'MANAGER', 'FINANCE', 'GUDANG', 'KASIR'] },

  // --- Transaksi & Keuangan ---
  { code: 'transaction.bulk_sale', name: 'Bulk Sale', description: 'Buat transaksi bulk sale', roles: ['OWNER', 'GM', 'MANAGER'] },
  { code: 'void.approve', name: 'Approve Void', description: 'Approve/reject permintaan void', roles: ['OWNER', 'GM'] },
  { code: 'return.cancel', name: 'Batalkan Retur', description: 'Batalkan retur', roles: ['OWNER'] },
  { code: 'debt.payment_void', name: 'Void Pembayaran Hutang', description: 'Void pembayaran hutang customer', roles: ['OWNER', 'GM'] },
  { code: 'payable.pay', name: 'Bayar Hutang', description: 'Bayar hutang supplier/antar-cabang', roles: ['OWNER', 'GM', 'MANAGER', 'FINANCE'] },
  { code: 'payable.waive', name: 'Hapus Hutang Antar-Cabang', description: 'Waive hutang antar-cabang', roles: ['OWNER', 'GM'] },
  { code: 'cashflow.category.manage', name: 'Kelola Kategori Kas', description: 'CRUD kategori cash flow', roles: ['OWNER', 'GM', 'MANAGER'] },

  // --- Sistem ---
  { code: 'user.manage', name: 'Kelola User', description: 'CRUD user', roles: ['OWNER'] },
  { code: 'branch.manage', name: 'Kelola Cabang', description: 'CRUD cabang', roles: ['OWNER'] },
  { code: 'shift.read', name: 'Lihat Shift', description: 'Lihat shift lintas cabang', roles: ['OWNER', 'GM'] },
];

/**
 * Seed idempotent. Menerima instance `db` (drizzle) agar bisa dipanggil dari script lain
 * maupun dijalankan standalone (lihat blok main di bawah).
 */
export async function seedPermissions(db: ReturnType<typeof createDb>) {
  // 1. Upsert katalog permission (conflict pada `code` unique → skip).
  await db
    .insert(permissions)
    .values(PERMISSION_CATALOG.map(({ code, name, description }) => ({ code, name, description })))
    .onConflictDoNothing();

  // 2. Ambil id role & permission aktual dari DB (seed tak berasumsi id tetap).
  const [roleRows, permRows] = await Promise.all([
    db.select({ id: roles.id, name: roles.name }).from(roles),
    db.select({ id: permissions.id, code: permissions.code }).from(permissions),
  ]);
  const roleId = new Map(roleRows.map((r) => [r.name, r.id]));
  const permId = new Map(permRows.map((p) => [p.code, p.id]));

  // 3. Bangun baris role_permissions sesuai matriks.
  const rows: { roleId: number; permissionId: number }[] = [];
  for (const perm of PERMISSION_CATALOG) {
    const pid = permId.get(perm.code);
    if (pid === undefined) continue;
    for (const role of perm.roles) {
      const rid = roleId.get(role);
      if (rid === undefined) continue;
      rows.push({ roleId: rid, permissionId: pid });
    }
  }

  if (rows.length > 0) {
    await db.insert(rolePermissions).values(rows).onConflictDoNothing();
  }

  return { permissions: PERMISSION_CATALOG.length, rolePermissions: rows.length };
}

// Runnable standalone: `pnpm --filter @petshop/db db:seed-permissions`
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('seed/permissions.ts')) {
  dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in .env');
  }
  const db = createDb(connectionString);
  seedPermissions(db)
    .then((res) => {
      console.log(`✅ Seed permissions selesai: ${res.permissions} permission, ${res.rolePermissions} baris role_permissions.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seed permissions gagal:');
      console.error(err);
      process.exit(1);
    });
}
