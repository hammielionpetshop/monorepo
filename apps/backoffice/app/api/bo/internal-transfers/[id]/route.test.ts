import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const verifyAccessToken = vi.fn();

const { tables } = vi.hoisted(() => ({
  tables: {
    interBranchTransfers: {},
    interBranchTransferItems: {},
    branches: {},
    users: {},
    products: {},
    productUomConversions: {},
    productUomCosts: {},
    unitsOfMeasure: {},
    customers: {},
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

vi.mock("@/lib/db", () => ({
  db,
  ...tables,
  eq: vi.fn((left, right) => ({ op: "eq", left, right })),
  and: vi.fn((...conditions) => ({ op: "and", conditions })),
  inArray: vi.fn((left, values) => ({ op: "inArray", left, values })),
}));

// Chainable select mock — mendukung `.limit()` (query dengan limit) maupun `await` langsung
// setelah `.where()` (query tanpa limit), meniru pola status/route.test.ts.
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

function makeTx({
  lockedResult = [{ id: 1 }],
  finalUpdateResult = [{ id: 1, status: "PENDING_APPROVAL" }] as unknown[],
}: { lockedResult?: unknown[]; finalUpdateResult?: unknown[] } = {}) {
  const deletedTables: unknown[] = [];
  const updatedTables: unknown[] = [];
  const insertedTables: unknown[] = [];

  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => lockedResult,
        }),
      }),
    }),
    delete: (table: unknown) => {
      deletedTables.push(table);
      return { where: async () => undefined };
    },
    update: (table: unknown) => {
      updatedTables.push(table);
      return {
        set: () => ({
          where: () => ({
            returning: async () => finalUpdateResult,
            then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
          }),
        }),
      };
    },
    insert: (table: unknown) => {
      insertedTables.push(table);
      return { values: async () => undefined };
    },
  };

  return { tx, deletedTables, updatedTables, insertedTables };
}

function patchRequest(body: unknown) {
  return new Request("http://test.local/api/bo/internal-transfers/1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const params = Promise.resolve({ id: "1" });

const baseTransfer = {
  id: 1,
  ibtNumber: "IBT-1",
  sourceBranchId: 2,
  destinationBranchId: 3,
  status: "PENDING_APPROVAL",
};

const existingItemRows = [
  { id: 10, productId: 100, uomId: 1, costPriceAtTransfer: 5000 },
];

beforeEach(() => {
  // `mockReturnValueOnce` antre di implementation queue — `clearAllMocks()` saja tidak
  // membersihkannya, jadi sisa antrean dari test sebelumnya bisa bocor ke test berikutnya.
  // `mockReset()` eksplisit di sini memastikan tiap test mulai dari queue kosong.
  verifyAccessToken.mockReset();
  db.select.mockReset();
  db.transaction.mockReset();
});

function mockAuth(overrides: Partial<Record<string, unknown>> = {}) {
  verifyAccessToken.mockResolvedValue({
    userId: 7,
    userName: "Owner",
    branchId: 3,
    branchName: "Cabang B",
    role: "OWNER",
    branchScope: "ALL",
    permissions: ["internal_transfer.manage", "internal_transfer.approve"],
    ...overrides,
  });
}

describe("PATCH /api/bo/internal-transfers/[id] — edit isi transfer", () => {
  it("sukses edit qty item yang sudah ada", async () => {
    mockAuth();
    db.select
      .mockReturnValueOnce(selectChain([baseTransfer])) // transfer lookup
      .mockReturnValueOnce(selectChain(existingItemRows)); // existing items lookup

    const { updatedTables } = makeTx();
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const { tx } = makeTx();
      return cb(tx);
    });

    const { PATCH } = await import("./route");
    const res = await PATCH(
      patchRequest({ items: [{ id: 10, qtyRequested: 20 }] }),
      { params }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("PENDING_APPROVAL");
    void updatedTables;
  });

  it("sukses tambah item baru (produk & UOM valid)", async () => {
    mockAuth();
    db.select
      .mockReturnValueOnce(selectChain([baseTransfer])) // transfer lookup
      .mockReturnValueOnce(selectChain(existingItemRows)) // existing items lookup
      .mockReturnValueOnce(selectChain([{ id: 200, baseUomId: 1, defaultCostPrice: 1000 }])) // products
      .mockReturnValueOnce(selectChain([])) // productUomConversions (uom = base, tak perlu konversi)
      .mockReturnValueOnce(selectChain([])); // productUomCosts

    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const { tx } = makeTx();
      return cb(tx);
    });

    const { PATCH } = await import("./route");
    const res = await PATCH(
      patchRequest({
        items: [
          { id: 10, qtyRequested: 5 },
          { productId: 200, uomId: 1, qtyRequested: 3 },
        ],
      }),
      { params }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("PENDING_APPROVAL");
  });

  it("sukses hapus item yang sudah ada", async () => {
    mockAuth();
    db.select
      .mockReturnValueOnce(selectChain([baseTransfer])) // transfer lookup
      .mockReturnValueOnce(
        selectChain([
          ...existingItemRows,
          { id: 11, productId: 101, uomId: 1, costPriceAtTransfer: 2000 },
        ])
      ); // existing items lookup — dua item, satu akan dihapus

    let capturedDeletes: unknown[] = [];
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const { tx, deletedTables } = makeTx();
      const result = await cb(tx);
      capturedDeletes = deletedTables;
      return result;
    });

    const { PATCH } = await import("./route");
    const res = await PATCH(
      patchRequest({ items: [{ id: 10, qtyRequested: 5 }] }), // item id 11 tidak disertakan -> dihapus
      { params }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("PENDING_APPROVAL");
    expect(capturedDeletes).toContain(tables.interBranchTransferItems);
  });

  it("sukses ganti cabang tujuan", async () => {
    mockAuth();
    db.select
      .mockReturnValueOnce(selectChain([baseTransfer])) // transfer lookup
      .mockReturnValueOnce(selectChain([{ id: 4, isActive: true }])) // destBranch lookup
      .mockReturnValueOnce(selectChain(existingItemRows)); // existing items lookup

    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const { tx } = makeTx({ finalUpdateResult: [{ id: 1, status: "PENDING_APPROVAL", destinationBranchId: 4 }] });
      return cb(tx);
    });

    const { PATCH } = await import("./route");
    const res = await PATCH(
      patchRequest({ destinationBranchId: 4, items: [{ id: 10, qtyRequested: 5 }] }),
      { params }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.destinationBranchId).toBe(4);
  });

  it("ditolak — status sudah IN_TRANSIT (tidak boleh diedit lagi)", async () => {
    mockAuth();
    db.select.mockReturnValueOnce(selectChain([{ ...baseTransfer, status: "IN_TRANSIT" }]));

    const { PATCH } = await import("./route");
    const res = await PATCH(
      patchRequest({ items: [{ id: 10, qtyRequested: 5 }] }),
      { params }
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toMatch(/tidak dapat diedit/i);
  });

  it("ditolak — role tanpa permission internal_transfer.manage pada fase requester", async () => {
    mockAuth({ role: "KASIR", permissions: [], branchScope: "OWN", branchId: 3 });
    db.select.mockReturnValueOnce(selectChain([baseTransfer]));

    const { PATCH } = await import("./route");
    const res = await PATCH(
      patchRequest({ items: [{ id: 10, qtyRequested: 5 }] }),
      { params }
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/akses ditolak/i);
  });

  it("ditolak — cabang user tidak cocok (MANAGER cabang lain saat fase approver)", async () => {
    mockAuth({
      role: "MANAGER",
      permissions: ["internal_transfer.approve"],
      branchScope: "OWN",
      branchId: 99, // bukan cabang pengirim (2)
    });
    db.select.mockReturnValueOnce(selectChain([{ ...baseTransfer, status: "APPROVED" }]));

    const { PATCH } = await import("./route");
    const res = await PATCH(
      patchRequest({ items: [{ id: 10, qtyRequested: 5 }] }),
      { params }
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/cabang Anda sendiri/i);
  });

  it("ditolak — UOM tidak valid untuk produk baru", async () => {
    mockAuth();
    db.select
      .mockReturnValueOnce(selectChain([baseTransfer])) // transfer lookup
      .mockReturnValueOnce(selectChain(existingItemRows)) // existing items lookup
      .mockReturnValueOnce(selectChain([{ id: 200, baseUomId: 1, defaultCostPrice: 1000 }])) // products
      .mockReturnValueOnce(selectChain([])) // productUomConversions — kosong, uomId 99 tak terdaftar
      .mockReturnValueOnce(selectChain([])); // productUomCosts

    const { PATCH } = await import("./route");
    const res = await PATCH(
      patchRequest({
        items: [
          { id: 10, qtyRequested: 5 },
          { productId: 200, uomId: 99, qtyRequested: 2 }, // uomId bukan base (1) & tak ada di konversi
        ],
      }),
      { params }
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toMatch(/satuan ukur tidak valid/i);
  });
});
