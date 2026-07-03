import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import {
  and,
  customers,
  db,
  eq,
  inArray,
  paymentMethods,
  productPrices,
  products,
  productUomConversions,
  shifts,
} from "@/lib/db";
import { TransactionService } from "@/lib/services/transaction-service";

const ALLOWED_ROLES = ["OWNER", "GM", "MANAGER"] as const;
const GLOBAL_ROLES = ["OWNER", "GM"] as const;

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

function isAllowedPriceTierForRole(role: string, priceTier: string) {
  if (isGlobalRole(role)) return true;
  return priceTier === "RETAIL";
}

async function buildTrustedItems(branchId: number, role: string, items: BulkSaleItemInput[]) {
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

    if (!isAllowedPriceTierForRole(role, item.priceTier)) throw new Error("INVALID_PRICE_TIER");

    const usesBaseUom = item.uomId === product.baseUomId;
    const hasConversion = validConversions.has(productUomKey(item.productId, item.uomId));
    if (!usesBaseUom && !hasConversion) throw new Error("INVALID_UOM");

    const price = pricesByKey.get(priceKey(item.productId, item.uomId, item.priceTier));
    if (!price) throw new Error("INVALID_PRICE");

    const basePrice = Number(price.price);
    const unitPrice = item.unitPrice;
    // Harga custom: OWNER/GM bebas (> 0, sudah dijamin schema);
    // role lain hanya boleh menaikkan (tidak boleh di bawah harga tier resmi).
    if (unitPrice !== basePrice && !isGlobalRole(role) && unitPrice < basePrice) {
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

function isAllowedRole(role: string) {
  return ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number]);
}

function isGlobalRole(role: string) {
  return GLOBAL_ROLES.includes(role as (typeof GLOBAL_ROLES)[number]);
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

    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    const payload = token ? await verifyAccessToken(token) : null;

    if (!payload) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    if (!isAllowedRole(payload.role)) {
      return NextResponse.json(
        { error: "Role tidak memiliki akses membuat bulk sale" },
        { status: 403 },
      );
    }

    const parsed = payloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 },
      );
    }

    const body = parsed.data;
    if (!isGlobalRole(payload.role) && body.branchId !== payload.branchId) {
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

    let trustedItems: TrustedItem[];
    try {
      trustedItems = await buildTrustedItems(body.branchId, payload.role, body.items);
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
      if (error instanceof Error && error.message === "INVALID_PRICE_TIER") {
        return NextResponse.json({ error: "Tier harga tidak diizinkan untuk role ini" }, { status: 403 });
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

    const activeShifts = await db.query.shifts.findMany({
      where: and(eq(shifts.branchId, body.branchId), eq(shifts.status, "OPEN")),
    });

    if (activeShifts.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada shift aktif untuk cabang transaksi" },
        { status: 400 },
      );
    }

    if (activeShifts.length > 1) {
      return NextResponse.json(
        { error: "Ada lebih dari satu shift aktif, pilih shift di POS terlebih dahulu" },
        { status: 409 },
      );
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
      shiftId: activeShifts[0].id,
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
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error: unknown) {
    console.error("Bulk sale error:", error);
    return NextResponse.json(
      { error: "Gagal membuat transaksi bulk sale" },
      { status: 500 },
    );
  }
}
