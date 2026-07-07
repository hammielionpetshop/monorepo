import { beforeEach, describe, expect, it, vi } from "vitest";

const { tables, db, deductStock } = vi.hoisted(() => ({
  tables: {
    transactions: {},
    transactionItems: {},
    transactionPayments: {},
    paymentMethods: {},
    customerDebts: {},
    products: {},
    productUomConversions: {},
    productUomCosts: {},
    productStockBatches: {},
    productStocks: {},
    auditLogs: {},
    ownerPriceOverrides: {},
    interBranchTransfers: {},
    interBranchTransferItems: {},
  },
  db: { transaction: vi.fn() },
  deductStock: vi.fn(),
}));

vi.mock("../db", () => ({
  db,
  ...tables,
  eq: vi.fn((left, right) => ({ op: "eq", left, right })),
  and: vi.fn((...conditions) => ({ op: "and", conditions })),
  inArray: vi.fn((left, values) => ({ op: "inArray", left, values })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ op: "sql", strings, values }),
    {},
  ),
}));

vi.mock("./stock-service", () => ({
  StockService: { deductStock, addStock: vi.fn() },
}));

import { TransactionService } from "./transaction-service";

// Hasil select per-tabel yang dipakai createTransaction.
function resultFor(table: unknown, ctx: { ibtItems: unknown[] }): unknown[] {
  if (table === tables.products)
    return [{ id: 10, baseUomId: 1, defaultCostPrice: 0, name: "Produk A", sku: "SKU10" }];
  if (table === tables.productUomConversions) return [];
  if (table === tables.productStockBatches) return [];
  if (table === tables.productUomCosts) return [];
  if (table === tables.productStocks) return [];
  if (table === tables.interBranchTransferItems) return ctx.ibtItems;
  if (table === tables.paymentMethods) return [{ id: 1, type: "CASH" }];
  return [];
}

function thenable(result: unknown[]) {
  const chain: Record<string, unknown> = {
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

type UpdateCall = { table: unknown; payload: Record<string, unknown> };

function makeTx(opts: {
  ibtItems: unknown[];
  linkResult: unknown[];
  updates: UpdateCall[];
  insertedItems: unknown[][];
}) {
  const ctx = { ibtItems: opts.ibtItems };
  return {
    select: () => ({ from: (table: unknown) => thenable(resultFor(table, ctx)) }),
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        if (table === tables.transactionItems) opts.insertedItems.push(vals as unknown[]);
        return {
          returning: async () =>
            table === tables.transactions ? [{ id: 99, trxNumber: "TRX-TEST-1" }] : [{ id: 1 }],
          then: (resolve: (v: unknown[]) => unknown) => Promise.resolve([{ id: 1 }]).then(resolve),
        };
      },
    }),
    update: (table: unknown) => ({
      set: (payload: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => (table === tables.interBranchTransfers ? opts.linkResult : [{ id: 1 }]),
          then: (resolve: (v: unknown[]) => unknown) => {
            opts.updates.push({ table, payload });
            return Promise.resolve([{ id: 1 }]).then(resolve);
          },
        }),
      }),
    }),
  };
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    branchId: 2,
    shiftId: null,
    cashierId: 7,
    customerId: 151,
    saleType: "BULK",
    items: [
      { productId: 10, uomId: 1, unitPrice: 5000, qty: 2, subtotal: 10000, discountAmount: 0, priceTier: "GROSIR" },
    ],
    payments: [{ paymentMethodId: 1, amount: 10000 }],
    totals: { subtotal: 10000, discountTotal: 0, grandTotal: 10000 },
    change: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deductStock.mockResolvedValue({ totalCogs: 3000, shortfallQty: 0, deductions: [], success: true });
});

describe("TransactionService.createTransaction — modal toko = harga jual gudang (G7)", () => {
  it("IBT baru dikonversi: costPriceAtTransfer item IBT di-set ke harga jual bulk sale", async () => {
    const updates: UpdateCall[] = [];
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(
        makeTx({
          ibtItems: [{ id: 1, productId: 10, uomId: 1 }],
          linkResult: [{ id: 55 }], // update menautkan → IBT baru terkonversi
          updates,
          insertedItems: [],
        }),
      ),
    );

    const trx = await TransactionService.createTransaction(basePayload({ sourceIbtId: 55 }));
    expect(trx).toEqual({ id: 99, trxNumber: "TRX-TEST-1" });

    const itemUpdates = updates.filter((u) => u.table === tables.interBranchTransferItems);
    expect(itemUpdates).toHaveLength(1);
    expect(itemUpdates[0].payload).toEqual({ costPriceAtTransfer: 5000 });
  });

  it("IBT sudah terkonversi sebelumnya: costPriceAtTransfer TIDAK diubah", async () => {
    const updates: UpdateCall[] = [];
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(
        makeTx({
          ibtItems: [{ id: 1, productId: 10, uomId: 1 }],
          linkResult: [], // update tidak menautkan (sudah terkonversi)
          updates,
          insertedItems: [],
        }),
      ),
    );

    await TransactionService.createTransaction(basePayload({ sourceIbtId: 55 }));

    const itemUpdates = updates.filter((u) => u.table === tables.interBranchTransferItems);
    expect(itemUpdates).toHaveLength(0);
  });

  it("tanpa sourceIbtId: tidak menyentuh item IBT", async () => {
    const updates: UpdateCall[] = [];
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(
        makeTx({
          ibtItems: [{ id: 1, productId: 10, uomId: 1 }],
          linkResult: [{ id: 55 }],
          updates,
          insertedItems: [],
        }),
      ),
    );

    await TransactionService.createTransaction(basePayload());

    expect(updates.filter((u) => u.table === tables.interBranchTransferItems)).toHaveLength(0);
    expect(updates.filter((u) => u.table === tables.interBranchTransfers)).toHaveLength(0);
  });
});
