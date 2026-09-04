import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const verifyAccessToken = vi.fn();

const { tables } = vi.hoisted(() => ({
  tables: {
    interBranchTransfers: {},
    interBranchTransferItems: {},
    interBranchPayables: {},
    productStocks: {},
    productStockBatches: {},
    products: {},
    productUomConversions: {},
    transactionItems: {},
    ownerAssignments: {},
    users: {},
    auditLogs: {},
  },
}));

const db = {
  select: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "token" }) })),
}));

vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

vi.mock("argon2", () => ({ verify: vi.fn(async () => true) }));

vi.mock("@/lib/services/stock-service", () => ({
  StockService: { addStock: vi.fn(), deductStock: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  db,
  ...tables,
  eq: vi.fn((left, right) => ({ op: "eq", left, right })),
  and: vi.fn((...conditions) => ({ op: "and", conditions })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ op: "sql", strings, values }),
    {},
  ),
  inArray: vi.fn((left, values) => ({ op: "inArray", left, values })),
  asc: vi.fn((col) => ({ op: "asc", col })),
}));

// Chainable non-transaction select mock (awaitable + .limit)
function selectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    limit: async () => result,
    then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

// Result per-table for tx.select().from(table)...
function txResultFor(table: unknown): unknown[] {
  if (table === tables.interBranchTransfers) return [{ id: 1 }]; // locked check
  if (table === tables.products) return [{ baseUomId: 1 }];
  if (table === tables.productUomConversions) return [];
  if (table === tables.productStocks) return [{ id: 100, uomId: 1, qty: 10 }];
  if (table === tables.productStockBatches) return [];
  return [];
}

function makeTxChain(result: unknown[]) {
  const chain: Record<string, unknown> = {
    where: () => chain,
    limit: async () => result,
    orderBy: async () => result,
    then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function makeTx(updatedTables: unknown[]) {
  return {
    select: () => ({
      from: (table: unknown) => makeTxChain(txResultFor(table)),
    }),
    update: (table: unknown) => {
      updatedTables.push(table);
      return {
        set: () => ({
          where: () => ({
            returning: async () => [{ id: 1, status: "IN_TRANSIT" }],
            then: (resolve: (v: unknown[]) => unknown) => Promise.resolve([{ id: 1 }]).then(resolve),
          }),
        }),
      };
    },
    insert: () => ({ values: async () => [{ id: 1 }] }),
  };
}

function shipRequest(body: unknown) {
  return new Request("http://test.local/api/bo/internal-transfers/1/status", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const params = Promise.resolve({ id: "1" });

beforeEach(() => {
  vi.clearAllMocks();
  verifyAccessToken.mockResolvedValue({
    userId: 7,
    userName: "Gudang",
    branchId: 2,
    branchName: "Gudang",
    role: "MANAGER",
    branchScope: "OWN",
    permissions: [
      "internal_transfer.approve",
      "internal_transfer.stock_check",
      "internal_transfer.receive",
    ],
  });
});

function setupShip({
  convertedTransactionId,
  soldItems = [{ productId: 10, uomId: 1, qty: 5 }],
  productRows = [{ id: 10, baseUomId: 1 }],
  convRows = [] as { productId: number; uomId: number; ratio: number }[],
}: {
  convertedTransactionId: number | null;
  soldItems?: unknown[];
  productRows?: { id: number; baseUomId: number }[];
  convRows?: { productId: number; uomId: number; ratio: number }[];
}) {
  const transfer = {
    id: 1,
    ibtNumber: "IBT-1",
    status: "PREPARING",
    sourceBranchId: 2,
    destinationBranchId: 3,
    convertedTransactionId,
  };
  const items = [
    { id: 1, productId: 10, uomId: 1, qtyRequested: 5, qtyShipped: 0, qtyReceived: 0, costPriceAtTransfer: 1000, expiryDate: null },
  ];
  db.select.mockReturnValueOnce(selectChain([transfer])); // transfer lookup
  db.select.mockReturnValueOnce(selectChain(items)); // items lookup
  if (convertedTransactionId != null) {
    // resolveBulkSaleQtyByItem: transactionItems -> products -> productUomConversions (Promise.all).
    db.select.mockReturnValueOnce(selectChain(soldItems));
    db.select.mockReturnValueOnce(selectChain(productRows));
    db.select.mockReturnValueOnce(selectChain(convRows));
  }

  const updatedTables: unknown[] = [];
  db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx(updatedTables)));
  return updatedTables;
}

describe("PATCH internal-transfers ship — guard dobel-potong stok (G5)", () => {
  it("IBT terkonversi: ship TIDAK memotong stok gudang, status jadi IN_TRANSIT", async () => {
    const updatedTables = setupShip({ convertedTransactionId: 900 });
    const { PATCH } = await import("./route");

    const res = await PATCH(shipRequest({ action: "ship", items: [{ itemId: 1, qty: 5 }] }), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("IN_TRANSIT");
    // qtyShipped (interBranchTransferItems) & status header (interBranchTransfers) tetap di-update
    expect(updatedTables).toContain(tables.interBranchTransferItems);
    expect(updatedTables).toContain(tables.interBranchTransfers);
    // Stok gudang TIDAK dipotong lagi
    expect(updatedTables).not.toContain(tables.productStocks);
    expect(updatedTables).not.toContain(tables.productStockBatches);
  });

  it("IBT non-terkonversi: ship tetap memotong stok gudang", async () => {
    const updatedTables = setupShip({ convertedTransactionId: null });
    const { PATCH } = await import("./route");

    const res = await PATCH(shipRequest({ action: "ship", items: [{ itemId: 1, qty: 5 }] }), { params });

    expect(res.status).toBe(200);
    expect(updatedTables).toContain(tables.productStocks);
  });

  it("IBT terkonversi: item yang tidak ikut terjual di Bulk Sale tidak ikut terkirim walau client kirim qty>0", async () => {
    // Bulk Sale sama sekali tidak menjual produk 10/uom 1 (mis. stok kosong saat itu) —
    // qty kirim harus 0 walau client (form lama / manipulasi request) mengirim qty:5.
    setupShip({ convertedTransactionId: 900, soldItems: [] });
    const { PATCH } = await import("./route");

    const res = await PATCH(shipRequest({ action: "ship", items: [{ itemId: 1, qty: 5 }] }), { params });
    const json = await res.json();

    // totalShipped berakhir 0 untuk semua item -> ditolak dengan SEMUA_QTY_NOL
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/qty kirim lebih dari 0/i);
  });

  it("IBT terkonversi: item yang terjual dengan satuan BEDA dari yang direquest tetap ikut terkirim", async () => {
    // Direquest dalam uom 1 (base, PCS). Kasir menjual dalam uom 2 (DUS, 1 DUS = 5 PCS) —
    // qty kirim harus tetap terhitung lewat konversi ke base, bukan dianggap tidak terjual.
    const updatedTables = setupShip({
      convertedTransactionId: 900,
      soldItems: [{ productId: 10, uomId: 2, qty: 1 }],
      productRows: [{ id: 10, baseUomId: 1 }],
      convRows: [{ productId: 10, uomId: 2, ratio: 5 }],
    });
    const { PATCH } = await import("./route");

    const res = await PATCH(shipRequest({ action: "ship", items: [{ itemId: 1, qty: 0 }] }), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("IN_TRANSIT");
    expect(updatedTables).toContain(tables.interBranchTransferItems);
    // Jalur terkonversi tidak pernah menyentuh stok gudang lagi.
    expect(updatedTables).not.toContain(tables.productStocks);
  });
});

// Merekam tabel + payload tiap update/insert agar bisa diperiksa nilainya, bukan sekadar tabelnya.
type WriteRecord = { table: unknown; values: Record<string, unknown> };

function makeRecordingTx(
  writes: { updates: WriteRecord[]; inserts: WriteRecord[] },
  stockRows: unknown[],
) {
  const resultFor = (table: unknown): unknown[] => {
    if (table === tables.interBranchTransfers) return [{ id: 1 }];
    if (table === tables.products) return [{ baseUomId: 1 }];
    if (table === tables.productStocks) return stockRows;
    return [];
  };
  return {
    select: () => ({ from: (table: unknown) => makeTxChain(resultFor(table)) }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        writes.updates.push({ table, values });
        return {
          where: () => ({
            returning: async () => [{ id: 1, status: "IN_TRANSIT" }],
            then: (resolve: (v: unknown[]) => unknown) => Promise.resolve([{ id: 1 }]).then(resolve),
          }),
        };
      },
    }),
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        writes.inserts.push({ table, values });
        return [{ id: 1 }];
      },
    }),
  };
}

describe("PATCH internal-transfers ship — bypass stok kurang tidak bikin stok minus", () => {
  it("kirim 5 padahal stok 2: agregat turun 2 saja, tidak ada baris stok minus, kekurangan masuk audit", async () => {
    const transfer = {
      id: 1,
      ibtNumber: "IBT-1",
      status: "PREPARING",
      sourceBranchId: 2,
      destinationBranchId: 3,
      convertedTransactionId: null,
    };
    const items = [
      { id: 1, productId: 10, uomId: 1, qtyRequested: 5, qtyShipped: 0, qtyReceived: 0, costPriceAtTransfer: 1000, expiryDate: null },
    ];
    db.select.mockReturnValueOnce(selectChain([transfer])); // transfer lookup
    db.select.mockReturnValueOnce(selectChain([{ userId: 99 }])); // ownerAssignments
    db.select.mockReturnValueOnce(selectChain([{ pinHash: "hash" }])); // users (PIN owner)
    db.select.mockReturnValueOnce(selectChain(items)); // items lookup

    const writes = { updates: [] as WriteRecord[], inserts: [] as WriteRecord[] };
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(makeRecordingTx(writes, [{ id: 100, uomId: 1, qty: 2 }])),
    );

    const { PATCH } = await import("./route");
    const res = await PATCH(
      shipRequest({ action: "ship", items: [{ itemId: 1, qty: 5 }], ownerPin: "123456" }),
      { params },
    );

    expect(res.status).toBe(200);

    // Agregat dipotong tepat satu kali, sebesar stok yang benar-benar ada (2), bukan 5.
    const stockUpdates = writes.updates.filter((w) => w.table === tables.productStocks);
    expect(stockUpdates).toHaveLength(1);
    expect((stockUpdates[0].values.qty as { values: unknown[] }).values).toContain(2);

    // Kekurangan 3 tidak boleh jadi baris product_stocks bernilai minus.
    expect(writes.inserts.filter((w) => w.table === tables.productStocks)).toHaveLength(0);

    // Kekurangannya tercatat di audit log bypass.
    const audit = writes.inserts.find((w) => w.table === tables.auditLogs);
    expect(audit).toBeDefined();
    expect(audit!.values.action).toBe("INTERNAL_TRANSFER_SHIP_STOCK_BYPASS");
    expect(JSON.parse(audit!.values.newData as string).items).toEqual([
      { productId: 10, qtyShipped: 5, shortInBase: 3 },
    ]);
  });
});

describe("PATCH internal-transfers receive — sekali-jalan (final)", () => {
  it("ditolak — status sudah PARTIALLY_RECEIVED, tidak boleh receive lagi", async () => {
    const transfer = {
      id: 1,
      ibtNumber: "IBT-1",
      status: "PARTIALLY_RECEIVED",
      sourceBranchId: 2,
      destinationBranchId: 3,
      convertedTransactionId: null,
    };
    db.select.mockReturnValueOnce(selectChain([transfer])); // transfer lookup

    const { PATCH } = await import("./route");
    const res = await PATCH(
      shipRequest({ action: "receive", items: [{ itemId: 1, qty: 1 }] }),
      { params }
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toMatch(/tidak valid untuk status transfer saat ini/i);
  });
});
