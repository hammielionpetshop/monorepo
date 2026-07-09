import { NextRequest, NextResponse } from "next/server";
import { alias } from "drizzle-orm/pg-core";
import { requirePermission } from "@/lib/authz";
import {
  and,
  count,
  db,
  eq,
  ilike,
  inArray,
  or,
  productPrices,
  productStocks,
  products,
  productUomConversions,
  productUomCosts,
  sql,
  unitsOfMeasure,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parsePositiveInteger(value: string | null) {
  if (!value) return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(req: NextRequest) {
  const gate = await requirePermission("transaction.bulk_sale");
  if (gate instanceof NextResponse) return gate;
  const payload = gate;

  const { searchParams } = req.nextUrl;
  const branchId = parsePositiveInteger(searchParams.get("branchId"));
  if (!branchId) {
    return NextResponse.json(
      { error: "branchId wajib diisi dengan angka positif" },
      { status: 400 },
    );
  }

  if (payload.branchScope !== "ALL" && branchId !== payload.branchId) {
    return NextResponse.json(
      { error: "Anda tidak memiliki akses ke cabang produk ini" },
      { status: 403 },
    );
  }

  const search = searchParams.get("search")?.trim() ?? "";
  const barcode = searchParams.get("barcode")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT))),
  );
  const baseUom = alias(unitsOfMeasure, "base_uom");

  // Mode fetch-by-ids (prefill bulk sale dari Internal PO / G4): kembalikan produk spesifik.
  const idsParam = searchParams.get("ids")?.trim() ?? "";
  const productIdFilter = idsParam
    ? idsParam
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
    : null;

  const searchWhere = productIdFilter
    ? productIdFilter.length > 0
      ? inArray(products.id, productIdFilter)
      : sql`false`
    : barcode
      ? or(eq(products.barcode, barcode), eq(products.sku, barcode))
      : search
        ? or(
            ilike(products.name, `%${search}%`),
            ilike(products.sku, `%${search}%`),
            ilike(products.barcode, `%${search}%`),
          )
        : undefined;

  const whereCondition = and(eq(products.isActive, true), searchWhere);

  const [countResult, productList] = await Promise.all([
    db.select({ total: count() }).from(products).where(whereCondition),
    db
      .select({
        id: products.id,
        sku: products.sku,
        code: sql<string>`COALESCE(${products.sku}, ${products.barcode}, '')`,
        barcode: products.barcode,
        name: products.name,
        categoryId: products.categoryId,
        brandId: products.brandId,
        baseUomId: products.baseUomId,
        baseUomCode: baseUom.code,
        weightGram: products.weightGram,
        stock: sql<string>`COALESCE(${productStocks.qty}, '0')`,
      })
      .from(products)
      .leftJoin(baseUom, eq(products.baseUomId, baseUom.id))
      .leftJoin(
        productStocks,
        and(
          eq(products.id, productStocks.productId),
          eq(productStocks.branchId, branchId),
          eq(productStocks.uomId, products.baseUomId),
        ),
      )
      .where(whereCondition)
      .orderBy(products.name)
      .limit(productIdFilter ? Math.max(productIdFilter.length, 1) : limit)
      .offset(productIdFilter ? 0 : (page - 1) * limit),
  ]);

  const total = countResult[0]?.total ?? 0;

  if (!productList.length) {
    return NextResponse.json({ products: [], total: 0, page, totalPages: 0 });
  }

  const productIds = productList.map((product) => product.id);

  const [priceList, conversionList, costList] = await Promise.all([
    db
      .select()
      .from(productPrices)
      .where(and(eq(productPrices.branchId, branchId), inArray(productPrices.productId, productIds))),
    db
      .select({
        id: productUomConversions.id,
        productId: productUomConversions.productId,
        uomId: productUomConversions.uomId,
        ratio: productUomConversions.ratio,
        weightGram: productUomConversions.weightGram,
        uomCode: unitsOfMeasure.code,
      })
      .from(productUomConversions)
      .leftJoin(unitsOfMeasure, eq(productUomConversions.uomId, unitsOfMeasure.id))
      .where(inArray(productUomConversions.productId, productIds)),
    db
      .select({
        id: productUomCosts.id,
        productId: productUomCosts.productId,
        branchId: productUomCosts.branchId,
        uomId: productUomCosts.uomId,
        costPrice: productUomCosts.costPrice,
      })
      .from(productUomCosts)
      .where(and(eq(productUomCosts.branchId, branchId), inArray(productUomCosts.productId, productIds))),
  ]);

  const pricesByProduct = new Map<number, typeof priceList>();
  for (const price of priceList) {
    const prices = pricesByProduct.get(price.productId) ?? [];
    prices.push(price);
    pricesByProduct.set(price.productId, prices);
  }

  const conversionsByProduct = new Map<number, typeof conversionList>();
  for (const conversion of conversionList) {
    const conversions = conversionsByProduct.get(conversion.productId) ?? [];
    conversions.push(conversion);
    conversionsByProduct.set(conversion.productId, conversions);
  }

  const costsByProduct = new Map<number, typeof costList>();
  for (const cost of costList) {
    const costs = costsByProduct.get(cost.productId) ?? [];
    costs.push(cost);
    costsByProduct.set(cost.productId, costs);
  }

  const result = productList.map((product) => {
    const conversions = conversionsByProduct.get(product.id) ?? [];
    const baseUomCode = product.baseUomCode ?? "";

    return {
      ...product,
      baseUomCode,
      weightGram: product.weightGram != null ? String(product.weightGram) : null,
      stock: toNumber(product.stock),
      prices: (pricesByProduct.get(product.id) ?? []).map((price) => ({
        ...price,
        priceTier: price.tierType,
        price: toNumber(price.price),
      })),
      conversions: conversions.map((conversion) => ({
        ...conversion,
        ratio: conversion.ratio != null ? String(conversion.ratio) : null,
        weightGram: conversion.weightGram != null ? String(conversion.weightGram) : null,
      })),
      availableUoms: [
        { uomId: product.baseUomId, uomCode: baseUomCode, conversionRate: 1 },
        ...conversions.map((conversion) => ({
          uomId: conversion.uomId,
          uomCode: conversion.uomCode ?? "",
          conversionRate: Number(conversion.ratio),
        })),
      ],
      productUomCosts: costsByProduct.get(product.id) ?? [],
    };
  });

  return NextResponse.json({
    products: result,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
