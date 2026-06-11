import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { verifyAccessToken } from "@/lib/auth";
import {
  and,
  categories,
  customers,
  db,
  eq,
  expenseCategories,
  paymentMethods,
  productPrices,
  productUomCosts,
  products,
  productStocks,
  productUomConversions,
  sql,
  suppliers,
  unitsOfMeasure,
} from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    const payload = token ? await verifyAccessToken(token) : null;

    if (!payload) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedBranchId = searchParams.get("branchId")
      ? Number(searchParams.get("branchId"))
      : null;
    const branchId = getPosBranchId(payload, cookieStore);

    if (requestedBranchId !== null && requestedBranchId !== branchId) {
      return NextResponse.json(
        { error: "Cabang POS tidak sesuai dengan sesi" },
        { status: 403 },
      );
    }

    const allProducts = await db
      .select({
        id: products.id,
        sku: products.sku,
        barcode: products.barcode,
        name: products.name,
        categoryId: products.categoryId,
        brandId: products.brandId,
        baseUomId: products.baseUomId,
        weightGram: products.weightGram,
        stock: sql<string>`COALESCE(${productStocks.qty}, '0')`,
      })
      .from(products)
      .leftJoin(
        productStocks,
        and(
          eq(products.id, productStocks.productId),
          eq(productStocks.branchId, branchId),
          eq(productStocks.uomId, products.baseUomId),
        ),
      )
      .where(eq(products.isActive, true));

    const conversions = await db
      .select({
        id: productUomConversions.id,
        productId: productUomConversions.productId,
        uomId: productUomConversions.uomId,
        ratio: productUomConversions.ratio,
        weightGram: productUomConversions.weightGram,
        uomCode: unitsOfMeasure.code,
      })
      .from(productUomConversions)
      .leftJoin(
        unitsOfMeasure,
        eq(productUomConversions.uomId, unitsOfMeasure.id),
      );

    const prices = await db
      .select()
      .from(productPrices)
      .where(eq(productPrices.branchId, branchId));

    const costs = await db
      .select({
        id: productUomCosts.id,
        productId: productUomCosts.productId,
        branchId: productUomCosts.branchId,
        uomId: productUomCosts.uomId,
        costPrice: productUomCosts.costPrice,
      })
      .from(productUomCosts)
      .where(eq(productUomCosts.branchId, branchId));

    const allCustomers = await db
      .select()
      .from(customers)
      .where(eq(customers.isActive, true));

    const uoms = await db.select().from(unitsOfMeasure);
    const payments = await db.select().from(paymentMethods);
    const allCategories = await db.select().from(categories);
    const expenseCats = await db.select().from(expenseCategories);
    const allSuppliers = await db.select().from(suppliers);

    return NextResponse.json({
      products: allProducts,
      conversions,
      prices,
      productUomCosts: costs,
      customers: allCustomers,
      categories: allCategories,
      expenseCategories: expenseCats,
      uoms,
      paymentMethods: payments,
      suppliers: allSuppliers,
      priceTiers: [
        "RETAIL",
        "GROSIR",
        "MEMBER",
        "DISTRIBUTOR",
        "RESELLER",
        "PROMO",
      ],
    });
  } catch (error) {
    console.error("Bootstrap API error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data awal POS" },
      { status: 500 },
    );
  }
}
