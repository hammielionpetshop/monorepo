import { sql as realSql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

// `sql` asli dipakai agar SQL yang diperiksa benar-benar SQL yang dikirim ke Postgres,
// bukan hasil template palsu. Hanya `db` yang dipalsukan (butuh DATABASE_URL).
vi.mock("@/lib/db", () => ({ db: { execute }, sql: realSql }));

const { buildStockLedgerQuery, mapStockLogRow, fetchStockLedger } = await import(
  "./stock-ledger"
);

function ledgerSQL(filters: ReturnType<typeof realSql>[] = []): string {
  return new PgDialect().sqlToQuery(buildStockLedgerQuery(filters)).sql;
}

describe("buku besar mutasi stok — cabang SALE", () => {
  it("mencatat penjualan yang di-void sebagai dua baris: keluar saat jual, masuk saat void", () => {
    const text = ledgerSQL();

    // Bug lama: satu baris per item dengan qty dibalik saat VOIDED, sehingga void
    // tampil menambah stok dan penjualan aslinya hilang dari riwayat.
    expect(text).not.toContain("THEN ti.qty      ELSE -ti.qty");
    expect(text).not.toContain("THEN 'SALE_VOID' ELSE 'SALE_OUT'");

    expect(text).toContain("'SALE_' || ti.id::text");
    expect(text).toContain("'SALEVOID_' || ti.id::text");
  });

  it("tetap mencatat SALE_OUT untuk transaksi VOIDED dan PENDING_VOID", () => {
    // Stok sudah dipotong saat menjual. VOIDED dikoreksi oleh baris SALE_VOID,
    // sedangkan PENDING_VOID belum dikembalikan sama sekali — keduanya wajib ada.
    expect(ledgerSQL()).toContain(
      "WHERE t.status IN ('COMPLETED', 'VOIDED', 'PENDING_VOID')",
    );
  });

  it("mencatat baris void pada jam void, bukan jam penjualan", () => {
    const text = ledgerSQL();
    expect(text).toContain("COALESCE(va.voided_at, t.updated_at)");
  });

  it("mencatat baris void atas nama pelaku void, bukan kasir yang menjual", () => {
    const text = ledgerSQL();
    expect(text).toContain("COALESCE(va.actor_id, t.cashier_id)");
    expect(text).toContain("'VOID_TRANSACTION', 'VOID_REQUEST_APPROVED'");
  });

  it("memakai DISTINCT ON untuk audit void agar baris mutasi tidak tergandakan", () => {
    // Satu transaksi bisa punya >1 audit log void (mis. VOID_REQUEST_APPROVED +
    // percobaan sebelumnya). Tanpa DISTINCT ON, join akan menggandakan tiap item.
    expect(ledgerSQL()).toContain("SELECT DISTINCT ON (al.record_id)");
  });
});

describe("buku besar mutasi stok — barang rusak", () => {
  it("menyertakan barang rusak sebagai stok keluar", () => {
    const text = ledgerSQL();

    expect(text).toContain("'DAMAGED_OUT'");
    expect(text).toContain("petshop.damaged_goods_items dgi");
    expect(text).toContain("-dgi.qty");
    expect(text).toContain("dg.reported_at");
  });
});

describe("buku besar mutasi stok — transfer antar cabang", () => {
  it("memakai received_at untuk transfer masuk", () => {
    expect(ledgerSQL()).toContain("COALESCE(ibt.received_at, ibt.updated_at)");
  });
});

describe("buildStockLedgerQuery — filter", () => {
  it("tanpa filter tidak menghasilkan klausa WHERE di query luar", () => {
    const text = ledgerSQL();
    // WHERE hanya boleh muncul di dalam CTE (cabang union), bukan setelah join.
    expect(text).not.toMatch(/LEFT JOIN petshop\.users usr[\s\S]*?WHERE/);
  });

  it("menggabungkan beberapa filter dengan AND dan memparameterkan nilainya", () => {
    const query = buildStockLedgerQuery([
      realSql`sm.branch_id = ${2}`,
      realSql`sm.movement_type = ${"DAMAGED_OUT"}`,
    ]);
    const { sql: text, params } = new PgDialect().sqlToQuery(query);

    expect(text).toContain("sm.branch_id = $1 AND sm.movement_type = $2");
    // $3 = LIMIT, ikut diparameterkan oleh drizzle
    expect(params).toEqual([2, "DAMAGED_OUT", 300]);
  });
});

describe("mapStockLogRow", () => {
  const row = {
    id: "DMG_5",
    created_at: new Date("2026-07-16T03:00:00.000Z"),
    movement_type: "DAMAGED_OUT",
    qty_change: -3,
    reference_number: "RUSAK-5",
    unit_price: 1000,
    cogs: 3000,
    notes: "RUSAK — kemasan sobek",
    product_name: "Royal Canin 1kg",
    product_sku: "RC-1KG",
    branch_name: "Toko Pusat",
    uom_code: "PCS",
    actor_name: "Budi",
  };

  it("memetakan baris lengkap apa adanya", () => {
    expect(mapStockLogRow(row)).toEqual({
      id: "DMG_5",
      createdAt: "2026-07-16T03:00:00.000Z",
      movementType: "DAMAGED_OUT",
      qtyChange: -3,
      referenceNumber: "RUSAK-5",
      unitPrice: 1000,
      cogs: 3000,
      notes: "RUSAK — kemasan sobek",
      productName: "Royal Canin 1kg",
      productSku: "RC-1KG",
      branchName: "Toko Pusat",
      uomCode: "PCS",
      actorName: "Budi",
    });
  });

  it("mempertahankan nilai kosong sebagai null, bukan string 'null'", () => {
    const mapped = mapStockLogRow({
      ...row,
      unit_price: null,
      cogs: null,
      notes: null,
      product_sku: null,
      reference_number: null,
    });

    expect(mapped.unitPrice).toBeNull();
    expect(mapped.cogs).toBeNull();
    expect(mapped.notes).toBeNull();
    expect(mapped.productSku).toBeNull();
    expect(mapped.referenceNumber).toBe("-");
  });

  it("tidak memaksa qty 0 jadi nilai lain", () => {
    expect(mapStockLogRow({ ...row, qty_change: 0 }).qtyChange).toBe(0);
  });
});

describe("fetchStockLedger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menjalankan query dan memetakan hasilnya", async () => {
    execute.mockResolvedValue([
      {
        id: "SALEVOID_9",
        created_at: new Date("2026-07-16T04:00:00.000Z"),
        movement_type: "SALE_VOID",
        qty_change: 2,
        reference_number: "TRX-1",
        unit_price: 5000,
        cogs: 4000,
        notes: null,
        product_name: "Whiskas",
        product_sku: null,
        branch_name: "Toko Pusat",
        uom_code: "PCS",
        actor_name: "Owner",
      },
    ]);

    const data = await fetchStockLedger([]);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ movementType: "SALE_VOID", qtyChange: 2 });
  });
});
