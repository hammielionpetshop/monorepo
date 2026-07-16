import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";
import { readSystemQty } from "@/lib/services/stock-opname";
import { signCountSnapshot } from "@/lib/so-count-snapshot";

export const dynamic = "force-dynamic";

const snapshotSchema = z.object({
  productId: z.coerce.number().int().positive(),
  uomId: z.coerce.number().int().positive(),
});

/**
 * Bekukan systemQty pada saat kasir menghitung produk ini. Dipanggil POS tepat setelah
 * jumlah fisik diisi, sehingga selisih dihitung terhadap stok saat MENGHITUNG — bukan
 * stok saat submit, yang bisa berjam-jam kemudian setelah ada penjualan.
 */
export async function POST(req: NextRequest) {
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

    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type harus application/json" },
        { status: 415 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Format request tidak valid" }, { status: 400 });
    }

    const parsed = snapshotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 },
      );
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const { productId, uomId } = parsed.data;

    const { systemQty } = await readSystemQty(db, branchId, productId, uomId);
    const countedAt = new Date().toISOString();

    const snapshotToken = await signCountSnapshot({
      branchId: Number(branchId),
      productId,
      uomId,
      systemQty,
      countedAt,
    });

    return NextResponse.json({ productId, uomId, systemQty, countedAt, snapshotToken });
  } catch (error) {
    console.error("POS stock opname count-snapshot error:", error);
    return NextResponse.json(
      { error: "Gagal membekukan stok saat penghitungan" },
      { status: 500 },
    );
  }
}
