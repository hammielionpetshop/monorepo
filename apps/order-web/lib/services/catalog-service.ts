import { alias } from 'drizzle-orm/pg-core';
import {
  db,
  eq,
  and,
  or,
  ilike,
  count,
  sql,
  products,
  productPrices,
  productStocks,
  productUomConversions,
  categories,
  brands,
  unitsOfMeasure,
} from '@/lib/db';

// Ambang "Menipis" — default sederhana dalam satuan dasar (keputusan C-UX §12, bisa dikonfigurasi nanti)
const LOW_STOCK_THRESHOLD = 10;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 40;

export type StockStatus = 'TERSEDIA' | 'MENIPIS' | 'KOSONG';

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function stockStatus(qty: number): StockStatus {
  if (qty <= 0) return 'KOSONG';
  if (qty < LOW_STOCK_THRESHOLD) return 'MENIPIS';
  return 'TERSEDIA';
}

export function orderBranchId(): number {
  const id = Number(process.env.ORDER_BRANCH_ID);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('ORDER_BRANCH_ID belum dikonfigurasi dengan benar');
  }
  return id;
}

export interface CatalogListParams {
  tierType: string;
  search?: string;
  categoryId?: number;
  brandId?: number;
  page?: number;
  limit?: number;
}

export interface CatalogProductSummary {
  id: number;
  name: string;
  imageUrl: string | null;
  categoryId: number | null;
  brandId: number | null;
  baseUomId: number;
  baseUomCode: string;
  basePrice: number;
  stockQty: number;
  stockStatus: StockStatus;
}

export async function getCatalogFilters() {
  const [categoryRows, brandRows] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .innerJoin(products, eq(products.categoryId, categories.id))
      .where(eq(products.isActive, true))
      .groupBy(categories.id, categories.name)
      .orderBy(categories.name),
    db
      .select({ id: brands.id, name: brands.name })
      .from(brands)
      .innerJoin(products, eq(products.brandId, brands.id))
      .where(eq(products.isActive, true))
      .groupBy(brands.id, brands.name)
      .orderBy(brands.name),
  ]);

  return { categories: categoryRows, brands: brandRows };
}

export async function getCatalogList(params: CatalogListParams) {
  const branchId = orderBranchId();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
  const baseUom = alias(unitsOfMeasure, 'base_uom');

  const search = params.search?.trim() ?? '';
  const searchWhere = search
    ? or(ilike(products.name, `%${search}%`), ilike(products.sku, `%${search}%`))
    : undefined;

  const whereCondition = and(
    eq(products.isActive, true),
    eq(productPrices.branchId, branchId),
    eq(productPrices.tierType, params.tierType),
    eq(productPrices.uomId, products.baseUomId),
    params.categoryId ? eq(products.categoryId, params.categoryId) : undefined,
    params.brandId ? eq(products.brandId, params.brandId) : undefined,
    searchWhere,
  );

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(products)
      .innerJoin(productPrices, eq(productPrices.productId, products.id))
      .where(whereCondition),
    db
      .select({
        id: products.id,
        name: products.name,
        imageUrl: products.imageUrl,
        categoryId: products.categoryId,
        brandId: products.brandId,
        baseUomId: products.baseUomId,
        baseUomCode: baseUom.code,
        basePrice: productPrices.price,
        stockQty: sql<string>`COALESCE(${productStocks.qty}, '0')`,
      })
      .from(products)
      .innerJoin(productPrices, eq(productPrices.productId, products.id))
      .leftJoin(baseUom, eq(products.baseUomId, baseUom.id))
      .leftJoin(
        productStocks,
        and(eq(productStocks.productId, products.id), eq(productStocks.branchId, branchId)),
      )
      .where(whereCondition)
      .orderBy(products.name)
      .limit(limit)
      .offset((page - 1) * limit),
  ]);

  const total = countResult[0]?.total ?? 0;

  const result: CatalogProductSummary[] = rows.map((row) => {
    const stockQty = toNumber(row.stockQty);
    return {
      id: row.id,
      name: row.name,
      imageUrl: row.imageUrl,
      categoryId: row.categoryId,
      brandId: row.brandId,
      baseUomId: row.baseUomId,
      baseUomCode: row.baseUomCode ?? '',
      basePrice: row.basePrice,
      stockQty,
      stockStatus: stockStatus(stockQty),
    };
  });

  return { products: result, total, page, totalPages: Math.ceil(total / limit) };
}

export interface CatalogProductDetail {
  id: number;
  name: string;
  imageUrl: string | null;
  categoryId: number | null;
  brandId: number | null;
  baseUomId: number;
  stockQty: number;
  stockStatus: StockStatus;
  uoms: { uomId: number; uomCode: string; price: number }[];
}

export async function getCatalogDetail(
  productId: number,
  tierType: string,
): Promise<CatalogProductDetail | null> {
  const branchId = orderBranchId();
  const baseUom = alias(unitsOfMeasure, 'base_uom');

  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      imageUrl: products.imageUrl,
      categoryId: products.categoryId,
      brandId: products.brandId,
      baseUomId: products.baseUomId,
      baseUomCode: baseUom.code,
      isActive: products.isActive,
    })
    .from(products)
    .leftJoin(baseUom, eq(products.baseUomId, baseUom.id))
    .where(eq(products.id, productId))
    .limit(1);

  if (!product || !product.isActive) return null;

  const [priceRows, conversionRows, stockRows] = await Promise.all([
    db
      .select({ uomId: productPrices.uomId, price: productPrices.price })
      .from(productPrices)
      .where(
        and(
          eq(productPrices.productId, productId),
          eq(productPrices.branchId, branchId),
          eq(productPrices.tierType, tierType),
        ),
      ),
    db
      .select({ uomId: productUomConversions.uomId, uomCode: unitsOfMeasure.code })
      .from(productUomConversions)
      .leftJoin(unitsOfMeasure, eq(productUomConversions.uomId, unitsOfMeasure.id))
      .where(eq(productUomConversions.productId, productId)),
    db
      .select({ qty: productStocks.qty })
      .from(productStocks)
      .where(and(eq(productStocks.productId, productId), eq(productStocks.branchId, branchId)))
      .limit(1),
  ]);

  const priceByUom = new Map(priceRows.map((p) => [p.uomId, p.price]));
  const basePrice = priceByUom.get(product.baseUomId);
  if (basePrice == null) return null; // tak ada harga tier ini di cabang tetap -> tak bisa dijual ke customer ini

  const stockQty = stockRows[0]?.qty ?? 0;

  const uoms = [
    { uomId: product.baseUomId, uomCode: product.baseUomCode ?? '', price: basePrice },
    ...conversionRows
      .filter((c) => priceByUom.has(c.uomId))
      .map((c) => ({ uomId: c.uomId, uomCode: c.uomCode ?? '', price: priceByUom.get(c.uomId)! })),
  ];

  return {
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    categoryId: product.categoryId,
    brandId: product.brandId,
    baseUomId: product.baseUomId,
    stockQty,
    stockStatus: stockStatus(stockQty),
    uoms,
  };
}
