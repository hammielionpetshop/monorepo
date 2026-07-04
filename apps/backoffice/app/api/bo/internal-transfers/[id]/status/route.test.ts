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
    permissions: [],
  });
});

function setupShip({ convertedTransactionId }: { convertedTransactionId: number | null }) {
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
  db.select
    .mockReturnValueOnce(selectChain([transfer])) // transfer lookup
    .mockReturnValueOnce(selectChain(items)); // items lookup

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
});
