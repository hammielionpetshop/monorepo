import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import {
  and,
  count,
  customerOrders,
  customers,
  db,
  eq,
  inArray,
  interBranchTransfers,
  paymentMethods,
  productPrices,
  products,
  productUomConversions,
  shifts,
  sql,
} from "@/lib/db";
import { TransactionService } from "@/lib/services/transaction-service";

const itemSchema = z.object({
  productId: z.number().int().positive(),
  productName: z.string().min(1),
  uomId: z.number().int().positive(),
  uomCode: z.string().min(1),
  qty: z.number().int().positive(),
  unitPrice: z.number().int().positive(),
  priceTier: z.string().min(1),
  discountAmount: z.number().int().min(0),
  subtotal: z.number().int().min(0),
});

const payloadSchema = z.object({
  branchId: z.number().int().positive(),
  customerId: z.number({ error: "Customer wajib dipilih" }).int().positive({ message: "Customer wajib dipilih" }),
  paymentMethodId: z.number().int().positive(),
  amountPaid: z.number().int().min(0),
  change: z.number().int().min(0).optional(),
  isCredit: z.boolean().optional(),
  sourceIbtId: z.number().int().positive().nullable().optional(),
  sourceOrderId: z.number().int().positive().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1, "Minimal satu produk harus dipilih"),
  totals: z.object({
    subtotal: z.number().int().min(0),
    discountTotal: z.number().int().min(0),
    grandTotal: z.number().int().min(0),
    itemCount: z.number().int().positive(),
  }),
});

type BulkSaleItemInput = z.infer<typeof itemSchema>;
type TrustedItem = BulkSaleItemInput & { basePrice: number };

type ProductRow = {
  id: number;
  name: string;
  baseUomId: number;
  isActive: boolean;
};

type PriceRow = {
  productId: number;
  uomId: number;
  tierType: string;
  price: number;
};

type ConversionRow = {
  productId: number;
  uomId: number;
};

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values));
}

function productUomKey(productId: number, uomId: number) {
  return `${productId}:${uomId}`;
}

function priceKey(productId: number, uomId: number, priceTier: string) {
  return `${productId}:${uomId}:${priceTier}`;
}

async function buildTrustedItems(branchId: number, isGlobal: boolean, items: BulkSaleItemInput[]) {
  const productIds = uniqueNumbers(items.map((item) => item.productId));
  const uomIds = uniqueNumbers(items.map((item) => item.uomId));

  const [productRows, priceRows, conversionRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        baseUomId: products.baseUomId,
        isActive: products.isActive,
      })
      .from(products)
      .where(inArray(products.id, productIds)),
    db
      .select({
        productId: productPrices.productId,
        uomId: productPrices.uomId,
        tierType: productPrices.tierType,
        price: productPrices.price,
      })
      .from(productPrices)
      .where(and(eq(productPrices.branchId, branchId), inArray(productPrices.productId, productIds))),
    db
      .select({
        productId: productUomConversions.productId,
        uomId: productUomConversions.uomId,
      })
      .from(productUomConversions)
      .where(and(inArray(productUomConversions.productId, productIds), inArray(productUomConversions.uomId, uomIds))),
  ]);

  const productsById = new Map<number, ProductRow>();
  for (const product of productRows) productsById.set(product.id, product);

  const validConversions = new Set(conversionRows.map((conversion: ConversionRow) => productUomKey(conversion.productId, conversion.uomId)));
  const pricesByKey = new Map<string, PriceRow>();
  for (const price of priceRows) pricesByKey.set(priceKey(price.productId, price.uomId, price.tierType), price);

  return items.map((item) => {
    const product = productsById.get(item.productId);
    if (!product || !product.isActive) throw new Error("INVALID_PRODUCT");

    const usesBaseUom = item.uomId === product.baseUomId;
    const hasConversion = validConversions.has(productUomKey(item.productId, item.uomId));
    if (!usesBaseUom && !hasConversion) throw new Error("INVALID_UOM");

    // Semua role yang boleh bulk sale bebas memilih tier apa pun (RETAIL/RESELLER/GROSIR/…);
    // tier yang tidak punya harga di cabang ini otomatis ditolak lewat INVALID_PRICE.
    // Guard harga custom (role non-global tak boleh menurunkan di bawah tier) tetap di bawah.
    const price = pricesByKey.get(priceKey(item.productId, item.uomId, item.priceTier));
    if (!price) throw new Error("INVALID_PRICE");

    const basePrice = Number(price.price);
    const unitPrice = item.unitPrice;
    // Harga custom: OWNER/GM bebas (> 0, sudah dijamin schema);
    // role lain hanya boleh menaikkan (tidak boleh di bawah harga tier resmi).
    if (unitPrice !== basePrice && !isGlobal && unitPrice < basePrice) {
      throw new Error("PRICE_BELOW_TIER");
    }

    const gross = item.qty * unitPrice;
    if (item.discountAmount > gross) throw new Error("DISCOUNT_TOO_HIGH");

    return {
      ...item,
      productName: product.name,
      unitPrice,
      basePrice,
      subtotal: gross - item.discountAmount,
    };
  });
}

// Kunci advisory agar dua bulk sale bersamaan di cabang yang sama tidak sama-sama
// membuka shift baru. Angka pertama hanya namespace bebas, yang kedua branchId.
const SHIFT_LOCK_NAMESPACE = 815_001;

async function findOpenShiftId(
  runner: Pick<typeof db, "select">,
  branchId: number,
) {
  const rows = await runner
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(eq(shifts.branchId, branchId), eq(shifts.status, "OPEN")));
  if (rows.length > 1) throw new Error("MULTIPLE_OPEN_SHIFTS");
  return rows[0]?.id ?? null;
}

// Bulk sale wajib menempel ke shift (transactions.shiftId notNull), tetapi cabang pengirim
// Internal PO adalah Gudang yang tidak pernah menjalankan shift kasir. Kalau belum ada shift
// terbuka di cabang transaksi, buka sendiri satu shift bertanda BACKOFFICE — modal awal 0,
// tanpa kasir yang perlu join — supaya penjualan tetap punya wadah kas yang bisa disettle.
async function resolveShiftId(branchId: number, userId: number) {
  const existing = await findOpenShiftId(db, branchId);
  if (existing !== null) return existing;

  return await db.transaction(async (trx) => {
    await trx.execute(
      sql`SELECT pg_advisory_xact_lock(${SHIFT_LOCK_NAMESPACE}, ${branchId})`,
    );

    const afterLock = await findOpenShiftId(trx, branchId);
    if (afterLock !== null) return afterLock;

    const [todayCount] = await trx
      .select({ total: count() })
      .from(shifts)
      .where(
        and(eq(shifts.branchId, branchId), sql`DATE(${shifts.openedAt}) = CURRENT_DATE`),
      );

    const [created] = await trx
      .insert(shifts)
      .values({
        branchId,
        openedById: userId,
        shiftNumber: Number(todayCount?.total ?? 0) + 1,
        assignedCashiers: [userId],
        openingCash: 0,
        status: "OPEN",
        origin: "BACKOFFICE",
      })
      .returning({ id: shifts.id });

    return created.id;
  });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type harus application/json" },
        { status: 415 },
      );
    }

    const gate = await requirePermission("transaction.bulk_sale");
    if (gate instanceof NextResponse) return gate;
    const payload = gate;

    const parsed = payloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 },
      );
    }

    const body = parsed.data;
    if (payload.branchScope !== "ALL" && body.branchId !== payload.branchId) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses ke cabang transaksi ini" },
        { status: 403 },
      );
    }

    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, body.customerId), eq(customers.isActive, true)))
      .limit(1);
    if (!customer) {
      return NextResponse.json(
        { error: "Customer tidak valid atau sudah nonaktif" },
        { status: 400 },
      );
    }

    const [paymentMethod] = await db
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(eq(paymentMethods.id, body.paymentMethodId))
      .limit(1);
    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Metode pembayaran tidak valid" },
        { status: 400 },
      );
    }

    // Bulk sale hasil import Internal PO (IBT) — validasi tautan sumber (G4).
    if (body.sourceIbtId) {
      const [ibt] = await db
        .select({
          id: interBranchTransfers.id,
          sourceBranchId: interBranchTransfers.sourceBranchId,
          status: interBranchTransfers.status,
          convertedTransactionId: interBranchTransfers.convertedTransactionId,
        })
        .from(interBranchTransfers)
        .where(eq(interBranchTransfers.id, body.sourceIbtId))
        .limit(1);
      if (!ibt) {
        return NextResponse.json({ error: "Internal PO sumber tidak ditemukan" }, { status: 400 });
      }
      if (ibt.sourceBranchId !== body.branchId) {
        return NextResponse.json(
          { error: "Cabang transaksi harus sama dengan cabang pengirim Internal PO" },
          { status: 400 },
        );
      }
      if (ibt.status === "CANCELLED") {
        return NextResponse.json(
          { error: "Internal PO sudah dibatalkan, tidak bisa diproses jadi bulk sale" },
          { status: 400 },
        );
      }
      if (ibt.convertedTransactionId) {
        return NextResponse.json(
          { error: "Internal PO ini sudah pernah diproses menjadi bulk sale" },
          { status: 409 },
        );
      }
    }

    // Bulk sale hasil konversi Order Portal (Inisiatif #3 C5) — validasi tautan sumber.
    if (body.sourceOrderId) {
      const [order] = await db
        .select({
          id: customerOrders.id,
          branchId: customerOrders.branchId,
          status: customerOrders.status,
          convertedTransactionId: customerOrders.convertedTransactionId,
        })
        .from(customerOrders)
        .where(eq(customerOrders.id, body.sourceOrderId))
        .limit(1);
      if (!order) {
        return NextResponse.json({ error: "Order portal sumber tidak ditemukan" }, { status: 400 });
      }
      if (order.branchId !== body.branchId) {
        return NextResponse.json(
          { error: "Cabang transaksi harus sama dengan cabang order" },
          { status: 400 },
        );
      }
      if (order.status === "REJECTED" || order.status === "CANCELLED") {
        return NextResponse.json(
          { error: "Order ini sudah ditolak/dibatalkan, tidak bisa diproses jadi bulk sale" },
          { status: 400 },
        );
      }
      if (order.convertedTransactionId) {
        return NextResponse.json(
          { error: "Order ini sudah pernah diproses menjadi bulk sale" },
          { status: 409 },
        );
      }
    }

    let trustedItems: TrustedItem[];
    try {
      trustedItems = await buildTrustedItems(body.branchId, payload.branchScope === "ALL", body.items);
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_PRODUCT") {
        return NextResponse.json({ error: "Produk tidak valid atau sudah nonaktif" }, { status: 400 });
      }
      if (error instanceof Error && error.message === "PRICE_BELOW_TIER") {
        return NextResponse.json({ error: "Harga custom di bawah harga tier tidak diizinkan untuk role ini" }, { status: 403 });
      }
      if (error instanceof Error && error.message === "INVALID_UOM") {
        return NextResponse.json({ error: "Satuan produk tidak valid" }, { status: 400 });
      }
      if (error instanceof Error && error.message === "INVALID_PRICE") {
        return NextResponse.json({ error: "Harga produk tidak valid untuk cabang dan tier ini" }, { status: 400 });
      }
      if (error instanceof Error && error.message === "DISCOUNT_TOO_HIGH") {
        return NextResponse.json({ error: "Diskon item tidak boleh lebih besar dari subtotal bruto" }, { status: 400 });
      }
      throw error;
    }

    const calculatedGross = trustedItems.reduce(
      (total, item) => total + item.qty * item.unitPrice,
      0,
    );
    const calculatedDiscount = trustedItems.reduce(
      (total, item) => total + item.discountAmount,
      0,
    );
    const calculatedGrandTotal = trustedItems.reduce(
      (total, item) => total + item.subtotal,
      0,
    );

    if (
      calculatedGross !== body.totals.subtotal ||
      calculatedDiscount !== body.totals.discountTotal ||
      calculatedGrandTotal !== body.totals.grandTotal
    ) {
      return NextResponse.json(
        { error: "Total transaksi tidak sesuai dengan item" },
        { status: 400 },
      );
    }

    type PaymentInput = { paymentMethodId: number; amount: number; referenceNumber: string | null };
    let payments: PaymentInput[];
    let headerAmountPaid: number;
    let headerChange: number;
    let dueAt: string | null = null;

    if (body.isCredit) {
      if (body.amountPaid >= body.totals.grandTotal) {
        return NextResponse.json(
          { error: "Penjualan kredit: uang muka (DP) harus kurang dari total transaksi" },
          { status: 400 },
        );
      }

      const [debtMethod] = await db
        .select({ id: paymentMethods.id })
        .from(paymentMethods)
        .where(eq(paymentMethods.type, "DEBT"))
        .limit(1);
      if (!debtMethod) {
        return NextResponse.json(
          { error: "Metode pembayaran Hutang belum dikonfigurasi. Hubungi admin." },
          { status: 400 },
        );
      }

      if (body.amountPaid > 0 && body.paymentMethodId === debtMethod.id) {
        return NextResponse.json(
          { error: "Pilih metode pembayaran selain Hutang untuk uang muka (DP)" },
          { status: 400 },
        );
      }

      const debtPortion = body.totals.grandTotal - body.amountPaid;
      payments = [];
      if (body.amountPaid > 0) {
        payments.push({ paymentMethodId: body.paymentMethodId, amount: body.amountPaid, referenceNumber: null });
      }
      payments.push({ paymentMethodId: debtMethod.id, amount: debtPortion, referenceNumber: null });
      headerAmountPaid = body.totals.grandTotal;
      headerChange = 0;
      dueAt = body.dueAt ?? null;
    } else {
      if (body.amountPaid < body.totals.grandTotal) {
        return NextResponse.json(
          { error: "Jumlah bayar kurang dari total transaksi" },
          { status: 400 },
        );
      }
      payments = [{ paymentMethodId: body.paymentMethodId, amount: body.amountPaid, referenceNumber: null }];
      headerAmountPaid = body.amountPaid;
      headerChange = body.amountPaid - body.totals.grandTotal;
    }

    let shiftId: number;
    try {
      shiftId = await resolveShiftId(body.branchId, payload.userId);
    } catch (error) {
      if (error instanceof Error && error.message === "MULTIPLE_OPEN_SHIFTS") {
        return NextResponse.json(
          { error: "Ada lebih dari satu shift aktif, pilih shift di POS terlebih dahulu" },
          { status: 409 },
        );
      }
      throw error;
    }

    const priceOverrides = trustedItems
      .filter((item) => item.unitPrice !== item.basePrice)
      .map((item) => ({
        productId: item.productId,
        originalPrice: item.basePrice,
        overriddenPrice: item.unitPrice,
      }));

    const transaction = await TransactionService.createTransaction({
      branchId: body.branchId,
      shiftId,
      cashierId: payload.userId,
      customerId: body.customerId,
      items: trustedItems,
      payments,
      totals: body.totals,
      amountPaid: headerAmountPaid,
      change: headerChange,
      dueAt,
      priceOverrides,
      overrideById: payload.userId,
      saleType: "BULK",
      sourceIbtId: body.sourceIbtId ?? null,
      sourceOrderId: body.sourceOrderId ?? null,
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error: unknown) {
    // Race konversi-dobel yang lolos pre-check: sumber baru saja dikonversi transaksi lain
    // saat kita di dalam transaksi DB → service melempar & rollback. Balas 409, bukan 500.
    if (error instanceof Error && error.message === "SOURCE_ORDER_ALREADY_CONVERTED") {
      return NextResponse.json(
        { error: "Order ini baru saja diproses menjadi bulk sale oleh transaksi lain" },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === "SOURCE_IBT_ALREADY_CONVERTED") {
      return NextResponse.json(
        { error: "Internal PO ini baru saja diproses menjadi bulk sale oleh transaksi lain" },
        { status: 409 },
      );
    }
    console.error("Bulk sale error:", error);
    return NextResponse.json(
      { error: "Gagal membuat transaksi bulk sale" },
      { status: 500 },
    );
  }
}
