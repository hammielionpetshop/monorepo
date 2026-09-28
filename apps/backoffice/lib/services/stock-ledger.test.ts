import { sql as realSql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

// `sql` asli dipakai agar SQL yang diperiksa benar-benar SQL yang dikirim ke Postgres,
// bukan hasil template palsu. Hanya `db` yang dipalsukan (butuh DATABASE_URL).
vi.mock("@/lib/db", () => ({ db: { execute }, sql: realSql }));

const {
  buildStockLedgerQuery,
  mapStockLogRow,
  fetchStockLedger,
  productSearchFilter,
  wibDateRangeFilters,
} = await import("./stock-ledger");

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

describe("buku besar mutasi stok — Bulk Sale PO Internal", () => {
  it("mencatat penjualan & void Bulk Sale PO Internal sebagai transfer keluar", () => {
    const text = ledgerSQL();
    expect(text).toContain(
      "CASE WHEN t.source_ibt_id IS NULL THEN 'SALE_OUT' ELSE 'TRANSFER_OUT' END AS movement_type",
    );
    expect(text).toContain(
      "CASE WHEN t.source_ibt_id IS NULL THEN 'SALE_VOID' ELSE 'TRANSFER_OUT' END AS movement_type",
    );
  });

  it("tidak mencatat pengiriman IBT terkonversi dua kali", () => {
    // Stok pengirim dipotong oleh transaksi Bulk Sale; pengiriman IBT-nya tidak
    // memotong lagi, jadi baris TRANSFER_OUT dari IBT itu wajib disaring.
    expect(ledgerSQL()).toMatch(
      /WHERE iti\.qty_shipped > 0\s+AND ibt\.converted_transaction_id IS NULL/,
    );
  });
});

describe("buku besar mutasi stok — reference_id", () => {
  it("setiap cabang union punya reference_id bertipe teks", () => {
    // UNION ALL wajib seragam; retur ber-id UUID jadi semuanya teks.
    const text = ledgerSQL();
    const branches = text.split("UNION ALL").length;
    expect(text.match(/::text AS reference_id/g)).toHaveLength(branches);
  });
});

describe("buku besar mutasi stok — stock opname", () => {
  it("membuang item SO Besar yang ditolak", () => {
    // Header SO Besar tetap ditutup APPROVED walau ada item REJECTED, padahal item
    // yang ditolak tidak pernah menyesuaikan stok.
    expect(ledgerSQL()).toContain("soi.item_status IS DISTINCT FROM 'REJECTED'");
  });

  it("memakai selisih hitung ulang untuk item yang dihitung ulang", () => {
    expect(ledgerSQL()).toContain(
      "CASE WHEN soi.is_recounted THEN soi.recount_variance_qty ELSE soi.variance_qty END AS qty_change",
    );
  });

  it("mencatat pada jam keputusan per item bila ada", () => {
    expect(ledgerSQL()).toContain("COALESCE(soi.decided_at, so.approved_at");
  });
});

describe("buku besar mutasi stok — produk yang sudah dihapus", () => {
  it("tidak membuang mutasi produk terhapus (LEFT JOIN, bukan INNER)", () => {
    const text = ledgerSQL();
    // `transaction_items.product_id` ber-onDelete SET NULL. INNER JOIN ke products
    // membuang mutasi itu diam-diam padahal stoknya benar-benar terpotong.
    expect(text).toContain("LEFT JOIN petshop.products p");
    expect(text).not.toMatch(/\n\s+JOIN petshop\.products p ON p\.id = sm\.product_id/);
  });

  it("memakai snapshot nama/SKU dari item transaksi sebagai fallback", () => {
    const text = ledgerSQL();
    expect(text).toContain(
      "COALESCE(p.name, sm.product_name_snapshot, 'Produk Dihapus')",
    );
    expect(text).toContain("COALESCE(p.sku, sm.product_sku_snapshot)");
    expect(text).toContain("ti.product_name");
    expect(text).toContain("ti.product_sku");
  });

  it("productSearchFilter ikut mencari lewat snapshot", () => {
    const { sql: text, params } = new PgDialect().sqlToQuery(
      productSearchFilter("whiskas"),
    );
    expect(text).toContain("sm.product_name_snapshot");
    expect(text).toContain("sm.product_sku_snapshot");
    expect(params).toEqual(["%whiskas%", "%whiskas%"]);
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

describe("wibDateRangeFilters", () => {
  const toQuery = (f: ReturnType<typeof realSql>) => new PgDialect().sqlToQuery(f);

  it("menghitung batas hari WIB di Postgres, bukan lewat string ber-offset", () => {
    // Bug lama: '...T00:00:00.000+07:00' di-cast ke timestamp tanpa zona → offset
    // dibuang, rentangnya jadi hari UTC (07:00–06:59 WIB).
    const [start, end] = wibDateRangeFilters("2026-09-01", "2026-09-28").map(toQuery);

    expect(start.sql).toContain("sm.created_at >= (($1::date)::timestamp AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC'");
    expect(start.params).toEqual(["2026-09-01"]);
    // Tanggal akhir inklusif: < awal hari berikutnya, tanpa pembulatan .999.
    expect(end.sql).toContain("sm.created_at < (($1::date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC'");
    expect(end.params).toEqual(["2026-09-28"]);
  });

  it("melewati batas yang kosong", () => {
    expect(wibDateRangeFilters()).toEqual([]);
    expect(wibDateRangeFilters(undefined, "2026-09-28")).toHaveLength(1);
  });
});
