import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const createTransaction = vi.fn();
const eq = vi.fn((left, right) => ({ type: "eq", left, right }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    if (name === "posBranchId") return { value: "2" };
    return undefined;
  }),
};

const db = {
  query: {
    shifts: {
      findFirst: vi.fn(),
    },
    transactions: {
      findFirst: vi.fn(),
    },
  },
  select: vi.fn(),
};

// Jasa grooming menempel ke nota lewat modul ini; tes ini memakai DB tiruan, jadi modulnya ditiru.
vi.mock('@/lib/services/grooming-order-service', () => ({
  GROOMING_CONDITION_MAX: 500,
  DELIVERY_ADDRESS_MAX: 500,
  attachDeliveryInTx: vi.fn(async () => undefined),
  GroomingOrderError: class GroomingOrderError extends Error { status = 400 },
  attachGroomingOrderInTx: vi.fn(async () => undefined),
  cancelGroomingOrdersForVoidInTx: vi.fn(async () => 0),
  cancelGroomingOrdersForReturInTx: vi.fn(async () => 0),
  restoreGroomingOrdersAfterReturCancelInTx: vi.fn(async () => 0),
}))
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({
  verifyAccessToken,
}));

vi.mock("@/lib/services/transaction-service", () => ({
  TransactionService: {
    createTransaction,
  },
}));

vi.mock("@/lib/db", () => ({
  db,
  shifts: {
    id: "shifts.id",
    branchId: "shifts.branchId",
    status: "shifts.status",
  },
  shiftCashierSessions: {
    shiftId: "shiftCashierSessions.shiftId",
    cashierId: "shiftCashierSessions.cashierId",
    status: "shiftCashierSessions.status",
  },
  interBranchTransfers: {
    id: "interBranchTransfers.id",
    sourceBranchId: "interBranchTransfers.sourceBranchId",
    status: "interBranchTransfers.status",
    convertedTransactionId: "interBranchTransfers.convertedTransactionId",
  },
  transactions: {
    clientRequestId: "transactions.clientRequestId",
  },
  eq,
  and,
}));

// Chain `db.select().from().where().limit()` yang resolve ke `rows`.
function selectResult(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    branchId: 2,
    shiftId: 10,
    cashierId: 7,
    customerId: null,
    items: [
      {
        productId: 1,
        productName: "Produk A",
        uomId: 1,
        uomCode: "PCS",
        qty: 1,
        unitPrice: 10000,
        priceTier: "RETAIL",
        discountAmount: 0,
        subtotal: 10000,
      },
    ],
    payments: [{ paymentMethodId: 1, amount: 10000, referenceNumber: null }],
    totals: {
      subtotal: 10000,
      discountTotal: 0,
      grandTotal: 10000,
      itemCount: 1,
    },
    amountPaid: 10000,
    change: 0,
    ...overrides,
  };
}

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/pos/transactions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockImplementation((name: string) => {
    if (name === "accessToken") return { value: "token" };
    if (name === "posBranchId") return { value: "2" };
    return undefined;
  });
  verifyAccessToken.mockResolvedValue({
    userId: 7,
    userName: "Kasir",
    branchId: 2,
    branchName: "Pusat",
    role: "KASIR",
    permissions: [],
  });
  db.query.shifts.findFirst.mockResolvedValue({
    id: 10,
    branchId: 2,
    status: "OPEN",
  });
  db.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ cashierId: 7 }]),
      }),
    }),
  });
  createTransaction.mockResolvedValue({ id: 99, trxNumber: "TRX-1" });
  db.query.transactions.findFirst.mockResolvedValue(undefined);
});

describe("POST /api/pos/transactions", () => {
  it("rejects spoofed cashierId from request body", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({ cashierId: 999 })));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain("kasir");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("uses JWT cashierId and POS session branchId for valid payload", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload()));

    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 2, cashierId: 7 }),
    );
  });

  // Regresi: baris hadiah "beli X gratis Y" membawa promo.gift = true. Tanpa field itu di skema
  // Zod, tanda gift dibuang diam-diam, lalu server mengira baris hadiah = barang beli berpromo
  // dan menolak nota ("Promo ... sudah tidak berlaku"). Pastikan gift diteruskan apa adanya.
  it("preserves promo.gift on free-gift lines through the schema (beli X gratis Y)", async () => {
    const { POST } = await import("./route");

    const payload = validPayload({
      items: [
        { productId: 1, productName: "Oricat Dry Kotak Adult", uomId: 1, uomCode: "PCS", qty: 1, unitPrice: 20000, priceTier: "RETAIL", discountAmount: 0, subtotal: 20000 },
        { productId: 2, productName: "Bosscat Creamy Tuna Cheese (hadiah)", uomId: 1, uomCode: "PCS", qty: 1, unitPrice: 2500, priceTier: "RETAIL", discountAmount: 2500, subtotal: 0, promo: { promoId: 5, amount: 2500, gift: true } },
      ],
      totals: { subtotal: 20000, discountTotal: 0, grandTotal: 20000, itemCount: 2 },
    });

    const res = await POST(jsonRequest(payload));

    expect(res.status).toBe(201);
    const arg = createTransaction.mock.calls[0]![0] as { items: { productId: number; promo?: unknown }[] };
    const giftLine = arg.items.find((i) => i.productId === 2);
    expect(giftLine?.promo).toEqual({ promoId: 5, amount: 2500, gift: true });
  });
});

describe("POST /api/pos/transactions — sourceIbtId (proses PO Internal)", () => {
  const withPermission = () =>
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      userName: "Kasir",
      branchId: 2,
      branchName: "Pusat",
      role: "KASIR",
      permissions: ["internal_transfer.process_pos"],
    });

  it("403 bila kasir tak punya permission internal_transfer.process_pos", async () => {
    // verifyAccessToken default: permissions: []
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ sourceIbtId: 5 })));
    expect(res.status).toBe(403);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("400 bila PO Internal sumber tidak ada", async () => {
    withPermission();
    db.select
      .mockReturnValueOnce(selectResult([{ cashierId: 7 }]))
      .mockReturnValueOnce(selectResult([]));
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ sourceIbtId: 5 })));
    expect(res.status).toBe(400);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("400 bila cabang pengirim PO Internal ≠ cabang sesi POS", async () => {
    withPermission();
    db.select
      .mockReturnValueOnce(selectResult([{ cashierId: 7 }]))
      .mockReturnValueOnce(selectResult([{ id: 5, sourceBranchId: 99, status: "PENDING_APPROVAL", convertedTransactionId: null }]));
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ sourceIbtId: 5 })));
    expect(res.status).toBe(400);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("400 bila PO Internal sudah dibatalkan", async () => {
    withPermission();
    db.select
      .mockReturnValueOnce(selectResult([{ cashierId: 7 }]))
      .mockReturnValueOnce(selectResult([{ id: 5, sourceBranchId: 2, status: "CANCELLED", convertedTransactionId: null }]));
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ sourceIbtId: 5 })));
    expect(res.status).toBe(400);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("409 bila PO Internal sudah pernah dikonversi", async () => {
    withPermission();
    db.select
      .mockReturnValueOnce(selectResult([{ cashierId: 7 }]))
      .mockReturnValueOnce(selectResult([{ id: 5, sourceBranchId: 2, status: "APPROVED", convertedTransactionId: 88 }]));
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ sourceIbtId: 5 })));
    expect(res.status).toBe(409);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("meneruskan saleType BULK + sourceIbtId ke TransactionService untuk PO Internal valid", async () => {
    withPermission();
    db.select
      .mockReturnValueOnce(selectResult([{ cashierId: 7 }]))
      .mockReturnValueOnce(selectResult([{ id: 5, sourceBranchId: 2, status: "PENDING_APPROVAL", convertedTransactionId: null }]));
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ sourceIbtId: 5 })));

    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 2, cashierId: 7, saleType: "BULK", sourceIbtId: 5 }),
    );
    // Task kanban #38 Bagian C: ship ke IN_TRANSIT tidak lagi otomatis dari sini.
    expect(createTransaction.mock.calls[0][0]).not.toHaveProperty("autoShipIbt");
  });

  it("balas 409 saat TransactionService melempar SOURCE_IBT_ALREADY_CONVERTED (race)", async () => {
    withPermission();
    db.select
      .mockReturnValueOnce(selectResult([{ cashierId: 7 }]))
      .mockReturnValueOnce(selectResult([{ id: 5, sourceBranchId: 2, status: "PENDING_APPROVAL", convertedTransactionId: null }]));
    createTransaction.mockRejectedValueOnce(new Error("SOURCE_IBT_ALREADY_CONVERTED"));
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ sourceIbtId: 5 })));
    expect(res.status).toBe(409);
  });

  it("transaksi retail biasa (tanpa sourceIbtId) tetap saleType RETAIL", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload()));
    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ saleType: "RETAIL", sourceIbtId: null }),
    );
  });
});

describe("POST /api/pos/transactions — clientRequestId (idempotensi)", () => {
  const KEY = "3f1c2b4a-1111-4222-8333-444455556666";

  it("request pertama meneruskan clientRequestId ke TransactionService", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ clientRequestId: KEY })));
    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ clientRequestId: KEY }),
    );
  });

  it("percobaan ulang dengan kunci sama mengembalikan transaksi lama tanpa membuat baru", async () => {
    db.query.transactions.findFirst.mockResolvedValue({ id: 55, trxNumber: "TRX-LAMA", branchId: 2, cashierId: 7 });
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ clientRequestId: KEY })));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.replayed).toBe(true);
    expect(json.transaction.trxNumber).toBe("TRX-LAMA");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("409 bila kunci milik kasir/cabang lain", async () => {
    db.query.transactions.findFirst.mockResolvedValue({ id: 55, trxNumber: "TRX-LAIN", branchId: 2, cashierId: 8 });
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ clientRequestId: KEY })));
    expect(res.status).toBe(409);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("race: insert kalah di unique index → kembalikan transaksi pemenang, bukan 500", async () => {
    db.query.transactions.findFirst
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 56, trxNumber: "TRX-MENANG", branchId: 2, cashierId: 7 });
    createTransaction.mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: "23505" }));
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ clientRequestId: KEY })));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.transaction.trxNumber).toBe("TRX-MENANG");
  });

  it("tanpa clientRequestId tidak melakukan lookup replay", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload()));
    expect(res.status).toBe(201);
    expect(db.query.transactions.findFirst).not.toHaveBeenCalled();
  });

  it("400 untuk clientRequestId berformat aneh", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest(validPayload({ clientRequestId: "x; drop" })));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/pos/transactions — diskon per barang", () => {
  const discountedItem = (manualDiscount: unknown) => ({
    productId: 1,
    uomId: 1,
    qty: 2,
    unitPrice: 10000,
    priceTier: "RETAIL",
    discountAmount: 3000,
    subtotal: 17000,
    manualDiscount,
  });
  const totals = { subtotal: 17000, discountTotal: 0, grandTotal: 17000 };
  const payments = [{ paymentMethodId: 1, amount: 17000, referenceNumber: null }];

  it("meneruskan diskon per barang ke TransactionService", async () => {
    const { POST } = await import("./route");
    const manualDiscount = { amount: 3000, reasonCode: "LAINNYA", reasonNote: "teman owner" };
    const res = await POST(jsonRequest(validPayload({ items: [discountedItem(manualDiscount)], totals, payments, amountPaid: 17000 })));

    expect(res.status).toBe(201);
    expect(createTransaction.mock.calls[0][0].items[0].manualDiscount).toEqual(manualDiscount);
  });

  it("400 bila potongan nol atau alasan kosong", async () => {
    const { POST } = await import("./route");
    for (const manualDiscount of [{ amount: 0, reasonCode: "LANGGANAN" }, { amount: 3000, reasonCode: " " }]) {
      const res = await POST(jsonRequest(validPayload({ items: [discountedItem(manualDiscount)], totals, payments, amountPaid: 17000 })));
      expect(res.status).toBe(400);
    }
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("penolakan mesin diskon dibalas 400 dengan pesannya, bukan 500", async () => {
    const { POST } = await import("./route");
    const { LineDiscountError } = await import("@/lib/services/line-discount-service");
    createTransaction.mockRejectedValue(new LineDiscountError("Pilih alasan diskon"));

    const res = await POST(jsonRequest(validPayload({ items: [discountedItem({ amount: 3000, reasonCode: "ASAL" })], totals, payments, amountPaid: 17000 })));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Pilih alasan diskon");
  });
});
