import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import {
  db,
  sql,
  eq,
  and,
  or,
  ilike,
  asc,
  desc,
  inArray,
  products,
  unitsOfMeasure,
  productUomConversions,
  transactions,
  transactionItems,
} from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";
import { findProductByBarcode } from "@/lib/services/barcode";

export const dynamic = "force-dynamic";

interface UomOption {
  id: number;
  code: string;
  isBase: boolean;
}

interface Candidate {
  productId: number;
  productName: string;
  sku: string | null;
  baseUomId: number;
  baseUomCode: string | null;
  uoms: UomOption[];
}

const querySchema = z.object({
  method: z
    .enum(["BEST_SELLER", "SOLD_TODAY", "BY_CATEGORY", "MANUAL"])
    .default("MANUAL"),
  q: z.string().trim().max(100).optional(),
  barcode: z.string().trim().max(50).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
});

/** Bangun daftar opsi UOM (dasar + konversi) untuk sekumpulan produk. */
async function buildUomMap(
  productIds: number[],
): Promise<Map<number, UomOption[]>> {
  const map = new Map<number, UomOption[]>();
  if (productIds.length === 0) return map;

  const conversions = await db
    .select({
      productId: productUomConversions.productId,
      uomId: productUomConversions.uomId,
      code: unitsOfMeasure.code,
    })
    .from(productUomConversions)
    .innerJoin(
      unitsOfMeasure,
      eq(productUomConversions.uomId, unitsOfMeasure.id),
    )
    .where(inArray(productUomConversions.productId, productIds));

  for (const c of conversions) {
    const list = map.get(c.productId) ?? [];
    list.push({ id: c.uomId, code: c.code, isBase: false });
    map.set(c.productId, list);
  }
  return map;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    const payload = token ? await verifyAccessToken(token) : null;

    if (!payload) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const parsed = querySchema.safeParse({
      method: searchParams.get("method") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      barcode: searchParams.get("barcode") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Parameter tidak valid" },
        { status: 400 },
      );
    }

    const { method, barcode, categoryId } = parsed.data;
    const q = parsed.data.q ?? "";

    // Mode scan: resolusi barcode tunggal (stok tidak disertakan — blind count)
    if (barcode) {
      const found = await findProductByBarcode(barcode, branchId);
      if (!found) {
        return NextResponse.json(
          { error: "Produk dengan barcode ini tidak ditemukan" },
          { status: 404 },
        );
      }
      const uomMap = await buildUomMap([found.id]);
      const candidate: Candidate = {
        productId: found.id,
        productName: found.name,
        sku: found.sku,
        baseUomId: found.baseUomId,
        baseUomCode: found.baseUomCode,
        uoms: [
          { id: found.baseUomId, code: found.baseUomCode ?? "-", isBase: true },
          ...(uomMap.get(found.id) ?? []),
        ],
      };
      return NextResponse.json([candidate]);
    }

    // Mode browse: produk laris / terjual hari ini / pencarian manual — blind (tanpa stok)
    let rows: {
      productId: number;
      productName: string;
      sku: string | null;
      baseUomId: number;
      baseUomCode: string | null;
    }[];

    if (method === "BEST_SELLER" || method === "SOLD_TODAY") {
      const query = db
        .select({
          productId: products.id,
          productName: products.name,
          sku: products.sku,
          baseUomId: products.baseUomId,
          baseUomCode: unitsOfMeasure.code,
        })
        .from(transactionItems)
        .innerJoin(
          transactions,
          eq(transactionItems.transactionId, transactions.id),
        )
        .innerJoin(products, eq(transactionItems.productId, products.id))
        .innerJoin(
          unitsOfMeasure,
          eq(products.baseUomId, unitsOfMeasure.id),
        )
        .where(
          and(
            eq(transactions.branchId, branchId),
            sql`DATE(${transactions.createdAt}) = CURRENT_DATE`,
          ),
        )
        .groupBy(
          products.id,
          products.name,
          products.sku,
          products.baseUomId,
          unitsOfMeasure.code,
        )
        .orderBy(desc(sql`SUM(${transactionItems.qty})`));

      if (method === "BEST_SELLER") {
        query.limit(30);
      }
      rows = await query;
    } else if (method === "BY_CATEGORY") {
      if (!categoryId) {
        return NextResponse.json(
          { error: "Kategori wajib dipilih" },
          { status: 400 },
        );
      }
      rows = await db
        .select({
          productId: products.id,
          productName: products.name,
          sku: products.sku,
          baseUomId: products.baseUomId,
          baseUomCode: unitsOfMeasure.code,
        })
        .from(products)
        .innerJoin(
          unitsOfMeasure,
          eq(products.baseUomId, unitsOfMeasure.id),
        )
        .where(
          and(
            eq(products.isActive, true),
            eq(products.categoryId, categoryId),
          ),
        )
        .orderBy(asc(products.name));
    } else {
      rows = await db
        .select({
          productId: products.id,
          productName: products.name,
          sku: products.sku,
          baseUomId: products.baseUomId,
          baseUomCode: unitsOfMeasure.code,
        })
        .from(products)
        .innerJoin(
          unitsOfMeasure,
          eq(products.baseUomId, unitsOfMeasure.id),
        )
        .where(
          and(
            eq(products.isActive, true),
            q
              ? or(
                  ilike(products.name, `%${q}%`),
                  ilike(products.sku, `%${q}%`),
                  ilike(products.barcode, `%${q}%`),
                )
              : undefined,
          ),
        )
        .limit(50);
    }

    const uomMap = await buildUomMap(rows.map((r) => r.productId));
    const candidates: Candidate[] = rows.map((r) => ({
      ...r,
      uoms: [
        { id: r.baseUomId, code: r.baseUomCode ?? "-", isBase: true },
        ...(uomMap.get(r.productId) ?? []),
      ],
    }));

    return NextResponse.json(candidates);
  } catch (error) {
    console.error("POS stock opname count-candidates error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil daftar produk" },
      { status: 500 },
    );
  }
}
