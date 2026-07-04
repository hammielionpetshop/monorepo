import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const createTransaction = vi.fn();
const eq = vi.fn((left, right) => ({ type: "eq", left, right }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const db = {
  select: vi.fn(),
  query: {
    shifts: {
      findMany: vi.fn(),
    },
  },
};

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
  customers: {
    id: "customers.id",
    isActive: "customers.isActive",
  },
  paymentMethods: {
    id: "paymentMethods.id",
  },
  products: {
    id: "products.id",
    name: "products.name",
    baseUomId: "products.baseUomId",
    isActive: "products.isActive",
  },
  productPrices: {
    productId: "productPrices.productId",
    branchId: "productPrices.branchId",
    uomId: "productPrices.uomId",
    tierType: "productPrices.tierType",
    price: "productPrices.price",
  },
  productUomConversions: {
    productId: "productUomConversions.productId",
    uomId: "productUomConversions.uomId",
  },
  shifts: {
    branchId: "shifts.branchId",
    status: "shifts.status",
  },
  interBranchTransfers: {
    id: "interBranchTransfers.id",
    sourceBranchId: "interBranchTransfers.sourceBranchId",
    status: "interBranchTransfers.status",
    convertedTransactionId: "interBranchTransfers.convertedTransactionId",
  },
  eq,
  and,
  inArray: vi.fn((left, values) => ({ type: "inArray", left, values })),
}));

function selectChain(result: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => result),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function mockDbValidation({
  customerRows = [{ id: 11 }],
  paymentMethodRows = [{ id: 1 }],
  productRows = [{ id: 1, name: "Produk A", baseUomId: 1, isActive: true }],
  priceRows = [{ productId: 1, uomId: 1, tierType: "RETAIL", price: 10000 }],
  conversionRows = [],
}: {
  customerRows?: unknown[];
  paymentMethodRows?: unknown[];
  productRows?: unknown[];
  priceRows?: unknown[];
  conversionRows?: unknown[];
} = {}) {
  db.select.mockReset();
  db.select
    .mockReturnValueOnce(selectChain(customerRows))
    .mockReturnValueOnce(selectChain(paymentMethodRows))
    .mockReturnValueOnce(selectChain(productRows))
    .mockReturnValueOnce(selectChain(priceRows))
    .mockReturnValueOnce(selectChain(conversionRows));
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    branchId: 2,
    customerId: 11,
    paymentMethodId: 1,
    amountPaid: 20000,
    items: [
      {
        productId: 1,
        productName: "Produk A",
        uomId: 1,
        uomCode: "PCS",
        qty: 2,
        unitPrice: 10000,
        priceTier: "RETAIL",
        discountAmount: 3000,
        subtotal: 17000,
      },
    ],
    totals: {
      subtotal: 20000,
      discountTotal: 3000,
      grandTotal: 17000,
      itemCount: 2,
    },
    change: 3000,
    ...overrides,
  };
}

function jsonRequest(body: unknown) {
  return new Request("http://test.local/api/bo/bulk-sales", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockImplementation((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  });
  verifyAccessToken.mockResolvedValue({
    userId: 7,
    userName: "Manager",
    branchId: 2,
    branchName: "Pusat",
    role: "MANAGER",
    permissions: [],
  });
  db.query.shifts.findMany.mockResolvedValue([
    { id: 10, branchId: 2, status: "OPEN" },
  ]);
  mockDbValidation();
  createTransaction.mockResolvedValue({ id: 99, trxNumber: "TRX-20260612-0001" });
});

describe("POST /api/bo/bulk-sales", () => {
  it("requires customerId", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({ customerId: null })));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Customer wajib dipilih");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("rejects branch outside non-global JWT branch", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({ branchId: 3 })));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain("cabang");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("rejects payment below grand total", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({ amountPaid: 10000, change: 0 })));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("bayar");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("rejects missing active customer before creating transaction", async () => {
    mockDbValidation({ customerRows: [] });
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload()));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Customer");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("rejects invalid payment method before creating transaction", async () => {
    mockDbValidation({ paymentMethodRows: [] });
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload()));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Metode pembayaran");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("rejects non-global role lowering price below tier", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({
      items: [{ ...validPayload().items[0], unitPrice: 1, subtotal: 2 }],
      totals: { subtotal: 2, discountTotal: 0, grandTotal: 2, itemCount: 2 },
      amountPaid: 2,
      change: 0,
    })));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain("Harga custom");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("allows non-global role to raise price above tier and records override", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({
      items: [{ ...validPayload().items[0], unitPrice: 12000, subtotal: 21000 }],
      totals: { subtotal: 24000, discountTotal: 3000, grandTotal: 21000, itemCount: 2 },
      amountPaid: 21000,
      change: 0,
    })));

    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      priceOverrides: [{ productId: 1, originalPrice: 10000, overriddenPrice: 12000 }],
      overrideById: 7,
    }));
  });

  it("allows global role to set custom price below tier and records override", async () => {
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      userName: "Owner",
      branchId: 2,
      branchName: "Pusat",
      role: "OWNER",
      permissions: [],
    });
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({
      items: [{ ...validPayload().items[0], unitPrice: 8000, subtotal: 13000 }],
      totals: { subtotal: 16000, discountTotal: 3000, grandTotal: 13000, itemCount: 2 },
      amountPaid: 13000,
      change: 0,
    })));

    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      priceOverrides: [{ productId: 1, originalPrice: 10000, overriddenPrice: 8000 }],
    }));
  });

  it("allows non-global role using available non-retail price tier", async () => {
    mockDbValidation({
      priceRows: [
        { productId: 1, uomId: 1, tierType: "RETAIL", price: 10000 },
        { productId: 1, uomId: 1, tierType: "GROSIR", price: 9000 },
      ],
    });
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({
      items: [{ ...validPayload().items[0], priceTier: "GROSIR", unitPrice: 9000, subtotal: 15000 }],
      totals: { subtotal: 18000, discountTotal: 3000, grandTotal: 15000, itemCount: 2 },
      amountPaid: 15000,
      change: 0,
    })));

    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ priceTier: "GROSIR", unitPrice: 9000, subtotal: 15000 })],
    }));
  });

  it("rejects any role using a tier without a price for the branch", async () => {
    mockDbValidation({
      priceRows: [
        { productId: 1, uomId: 1, tierType: "RETAIL", price: 10000 },
      ],
    });
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({
      items: [{ ...validPayload().items[0], priceTier: "GROSIR", unitPrice: 9000, subtotal: 15000 }],
      totals: { subtotal: 18000, discountTotal: 3000, grandTotal: 15000, itemCount: 2 },
      amountPaid: 15000,
      change: 0,
    })));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Harga produk tidak valid");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("allows global role using available non-retail price tier", async () => {
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      userName: "Owner",
      branchId: 1,
      branchName: "Pusat",
      role: "OWNER",
      permissions: [],
    });
    mockDbValidation({
      priceRows: [
        { productId: 1, uomId: 1, tierType: "RETAIL", price: 10000 },
        { productId: 1, uomId: 1, tierType: "GROSIR", price: 9000 },
      ],
    });
    const { POST } = await import("./route");

    const payload = validPayload({
      items: [{ ...validPayload().items[0], priceTier: "GROSIR", unitPrice: 9000, subtotal: 15000 }],
      totals: { subtotal: 18000, discountTotal: 3000, grandTotal: 15000, itemCount: 2 },
      amountPaid: 15000,
      change: 0,
    });
    const res = await POST(jsonRequest(payload));

    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ priceTier: "GROSIR", unitPrice: 9000, subtotal: 15000 })],
      totals: payload.totals,
    }));
  });

  it("rejects invalid product UOM", async () => {
    mockDbValidation({ conversionRows: [] });
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({
      items: [{ ...validPayload().items[0], uomId: 2, uomCode: "BOX" }],
    })));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Satuan");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("rejects branch with no active shift", async () => {
    db.query.shifts.findMany.mockResolvedValue([]);
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload()));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("shift aktif");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("rejects branch with multiple active shifts", async () => {
    db.query.shifts.findMany.mockResolvedValue([
      { id: 10, branchId: 2, status: "OPEN" },
      { id: 11, branchId: 2, status: "OPEN" },
    ]);
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload()));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toContain("lebih dari satu shift aktif");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("creates transaction using JWT cashier and resolved shift", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({ cashierId: 999, shiftId: 999 })));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ id: 99, trxNumber: "TRX-20260612-0001" });
    expect(createTransaction).toHaveBeenCalledWith({
      branchId: 2,
      shiftId: 10,
      cashierId: 7,
      customerId: 11,
      items: [{ ...validPayload().items[0], basePrice: 10000 }],
      payments: [{ paymentMethodId: 1, amount: 20000, referenceNumber: null }],
      totals: validPayload().totals,
      amountPaid: 20000,
      change: 3000,
      dueAt: null,
      priceOverrides: [],
      overrideById: 7,
      saleType: "BULK",
      sourceIbtId: null,
    });
  });

  it("menandai transaksi sebagai BULK dan meneruskan sourceIbtId", async () => {
    db.select.mockReset();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 11 }])) // customer
      .mockReturnValueOnce(selectChain([{ id: 1 }])) // payment method
      .mockReturnValueOnce(selectChain([{ id: 55, sourceBranchId: 2, status: "APPROVED", convertedTransactionId: null }])) // IBT guard
      .mockReturnValueOnce(selectChain([{ id: 1, name: "Produk A", baseUomId: 1, isActive: true }])) // products
      .mockReturnValueOnce(selectChain([{ productId: 1, uomId: 1, tierType: "RETAIL", price: 10000 }])) // prices
      .mockReturnValueOnce(selectChain([])); // conversions

    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({ sourceIbtId: 55 })));

    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      saleType: "BULK",
      sourceIbtId: 55,
    }));
  });

  it("menolak sourceIbt yang sudah terkonversi (409)", async () => {
    db.select.mockReset();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 11 }])) // customer
      .mockReturnValueOnce(selectChain([{ id: 1 }])) // payment method
      .mockReturnValueOnce(selectChain([{ id: 55, sourceBranchId: 2, status: "APPROVED", convertedTransactionId: 900 }])); // IBT sudah terkonversi

    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({ sourceIbtId: 55 })));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toContain("sudah pernah diproses");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("menolak sourceIbt dengan cabang pengirim berbeda dari cabang transaksi", async () => {
    db.select.mockReset();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 11 }])) // customer
      .mockReturnValueOnce(selectChain([{ id: 1 }])) // payment method
      .mockReturnValueOnce(selectChain([{ id: 55, sourceBranchId: 9, status: "APPROVED", convertedTransactionId: null }])); // cabang beda

    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({ sourceIbtId: 55 })));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("cabang pengirim");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("membuat penjualan kredit dengan DP dan baris hutang", async () => {
    db.select.mockReset();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 11 }])) // customer
      .mockReturnValueOnce(selectChain([{ id: 1 }])) // payment method
      .mockReturnValueOnce(selectChain([{ id: 1, name: "Produk A", baseUomId: 1, isActive: true }])) // products
      .mockReturnValueOnce(selectChain([{ productId: 1, uomId: 1, tierType: "RETAIL", price: 10000 }])) // prices
      .mockReturnValueOnce(selectChain([])) // conversions
      .mockReturnValueOnce(selectChain([{ id: 4 }])); // DEBT method lookup

    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({
      isCredit: true,
      amountPaid: 5000,
      change: 0,
      dueAt: "2026-07-01",
    })));

    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      payments: [
        { paymentMethodId: 1, amount: 5000, referenceNumber: null },
        { paymentMethodId: 4, amount: 12000, referenceNumber: null },
      ],
      amountPaid: 17000,
      change: 0,
      dueAt: "2026-07-01",
    }));
  });

  it("menolak penjualan kredit bila DP >= total", async () => {
    db.select.mockReset();
    db.select
      .mockReturnValueOnce(selectChain([{ id: 11 }]))
      .mockReturnValueOnce(selectChain([{ id: 1 }]))
      .mockReturnValueOnce(selectChain([{ id: 1, name: "Produk A", baseUomId: 1, isActive: true }]))
      .mockReturnValueOnce(selectChain([{ productId: 1, uomId: 1, tierType: "RETAIL", price: 10000 }]))
      .mockReturnValueOnce(selectChain([]));

    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({
      isCredit: true,
      amountPaid: 17000,
      change: 0,
    })));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("uang muka");
    expect(createTransaction).not.toHaveBeenCalled();
  });
});
