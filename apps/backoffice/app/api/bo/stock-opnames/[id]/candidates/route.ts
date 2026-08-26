import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  and,
  db,
  eq,
  gte,
  inArray,
  lt,
  products,
  productStocks,
  productUomConversions,
  stockOpnameItems,
  stockOpnames,
  transactionItems,
  transactions,
  unitsOfMeasure,
} from "@/lib/db";
import { requirePermission } from "@/lib/authz";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID tidak valid"),
});

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cakupan produk untuk input SO Besar langsung dari backoffice: produk dengan
 * histori penjualan 30 hari sebelum SO dibuat, ATAU stok sistem cabang ≠ 0
 * (plus/minus) — supaya katalog yang benar-benar mati (stok nol, tak pernah
 * laku) tidak ikut membanjiri daftar yang harus dihitung manual. Produk yang
 * sudah punya baris di stock_opname_items (mis. sudah dihitung dari POS)
 * selalu ikut tampil, walau sudah tidak masuk kriteria itu lagi.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requirePermission("stock_opname.read");
    if (gate instanceof NextResponse) return gate;
    const payload = gate;

    const { id } = await params;
    const parsed = paramsSchema.safeParse({ id });
    if (!parsed.success) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }
    const soId = Number(parsed.data.id);

    const [header] = await db
      .select({
        id: stockOpnames.id,
        branchId: stockOpnames.branchId,
        type: stockOpnames.type,
        categoryScope: stockOpnames.categoryScope,
        createdAt: stockOpnames.createdAt,
      })
      .from(stockOpnames)
      .where(eq(stockOpnames.id, soId))
      .limit(1);

    if (!header) {
      return NextResponse.json(
        { error: "Stock opname tidak ditemukan" },
        { status: 404 },
      );
    }

    if (header.type !== "FULL") {
      return NextResponse.json(
        { error: "Daftar kandidat produk hanya berlaku untuk SO Besar" },
        { status: 400 },
      );
    }

    if (payload.branchScope !== "ALL" && payload.branchId !== header.branchId) {
      return NextResponse.json(
        { error: "Akses ditolak. Anda hanya dapat melihat stock opname cabang Anda sendiri." },
        { status: 403 },
      );
    }

    const branchId = header.branchId;
    const createdAt = new Date(header.createdAt);
    const since = new Date(createdAt.getTime() - THIRTY_DAYS_MS);

    const existingItems = await db
      .select({
        id: stockOpnameItems.id,
        productId: stockOpnameItems.productId,
        uomId: stockOpnameItems.uomId,
        systemQty: stockOpnameItems.systemQty,
        physicalQty: stockOpnameItems.physicalQty,
        varianceQty: stockOpnameItems.varianceQty,
        varianceCostValue: stockOpnameItems.varianceCostValue,
        varianceReason: stockOpnameItems.varianceReason,
        itemStatus: stockOpnameItems.itemStatus,
        isRecounted: stockOpnameItems.isRecounted,
        recountPhysicalQty: stockOpnameItems.recountPhysicalQty,
        recountVarianceQty: stockOpnameItems.recountVarianceQty,
        decisionNote: stockOpnameItems.decisionNote,
      })
      .from(stockOpnameItems)
      .where(eq(stockOpnameItems.soId, soId));

    const existingByProductId = new Map(existingItems.map((item) => [item.productId, item]));

    const saleRows = await db
      .selectDistinct({ productId: transactionItems.productId })
      .from(transactionItems)
      .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
      .where(
        and(
          eq(transactions.branchId, branchId),
          eq(transactions.status, "COMPLETED"),
          gte(transactions.createdAt, since),
          lt(transactions.createdAt, createdAt),
        ),
      );
    const saleProductIds = new Set(
      saleRows.map((row) => row.productId).filter((id): id is number => id !== null),
    );

    const stockRows = await db
      .select({
        productId: productStocks.productId,
        qty: productStocks.qty,
        ratio: productUomConversions.ratio,
      })
      .from(productStocks)
      .leftJoin(
        productUomConversions,
        and(
          eq(productUomConversions.productId, productStocks.productId),
          eq(productUomConversions.uomId, productStocks.uomId),
        ),
      )
      .where(eq(productStocks.branchId, branchId));

    const baseQtyByProduct = new Map<number, number>();
    for (const row of stockRows) {
      const add = Number(row.qty) * (row.ratio ?? 1);
      baseQtyByProduct.set(row.productId, (baseQtyByProduct.get(row.productId) ?? 0) + add);
    }
    const stockProductIds = new Set(
      [...baseQtyByProduct.entries()].filter(([, qty]) => qty !== 0).map(([productId]) => productId),
    );

    let eligibleIds = new Set<number>([...saleProductIds, ...stockProductIds]);

    const categoryScope = Array.isArray(header.categoryScope)
      ? (header.categoryScope as number[])
      : null;
    if (categoryScope && categoryScope.length > 0) {
      const categoryProductRows = await db
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.categoryId, categoryScope));
      const inCategory = new Set(categoryProductRows.map((row) => row.id));
      eligibleIds = new Set([...eligibleIds].filter((productId) => inCategory.has(productId)));
    }

    for (const productId of existingByProductId.keys()) {
      eligibleIds.add(productId);
    }

    if (eligibleIds.size === 0) {
      return NextResponse.json({ items: [] });
    }

    const productIds = [...eligibleIds];

    const productRows = await db
      .select({ id: products.id, name: products.name, sku: products.sku, baseUomId: products.baseUomId })
      .from(products)
      .where(inArray(products.id, productIds));

    const uomIdsNeeded = new Set<number>();
    for (const product of productRows) {
      const existing = existingByProductId.get(product.id);
      uomIdsNeeded.add(existing ? existing.uomId : product.baseUomId);
    }

    const uomRows = uomIdsNeeded.size
      ? await db
          .select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code })
          .from(unitsOfMeasure)
          .where(inArray(unitsOfMeasure.id, [...uomIdsNeeded]))
      : [];
    const uomCodeById = new Map(uomRows.map((row) => [row.id, row.code]));

    const conversionRows = await db
      .select({
        productId: productUomConversions.productId,
        uomId: productUomConversions.uomId,
        ratio: productUomConversions.ratio,
      })
      .from(productUomConversions)
      .where(inArray(productUomConversions.productId, productIds));
    const ratioByKey = new Map(conversionRows.map((row) => [`${row.productId}:${row.uomId}`, row.ratio]));

    const items = productRows.map((product) => {
      const existing = existingByProductId.get(product.id);
      const uomId = existing ? existing.uomId : product.baseUomId;
      const ratio = ratioByKey.get(`${product.id}:${uomId}`) ?? 1;
      const liveSystemQty = Math.floor((baseQtyByProduct.get(product.id) ?? 0) / ratio);

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        uomId,
        uomCode: uomCodeById.get(uomId) ?? "-",
        systemQty: existing ? existing.systemQty : liveSystemQty,
        liveSystemQty,
        soItemId: existing?.id ?? null,
        physicalQty: existing?.physicalQty ?? null,
        varianceQty: existing?.varianceQty ?? null,
        varianceCostValue: existing?.varianceCostValue ?? null,
        varianceReason: existing?.varianceReason ?? null,
        itemStatus: existing?.itemStatus ?? null,
        isRecounted: existing?.isRecounted ?? false,
        recountPhysicalQty: existing?.recountPhysicalQty ?? null,
        recountVarianceQty: existing?.recountVarianceQty ?? null,
        decisionNote: existing?.decisionNote ?? null,
      };
    });

    items.sort((a, b) => a.productName.localeCompare(b.productName, "id"));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/bo/stock-opnames/[id]/candidates error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil daftar kandidat produk" },
      { status: 500 },
    );
  }
}
