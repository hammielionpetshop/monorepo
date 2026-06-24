import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";
import { computeVariance } from "@/lib/services/stock-opname";

export const dynamic = "force-dynamic";

const previewSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        uomId: z.coerce.number().int().positive(),
        physicalQty: z.coerce.number().min(0),
      }),
    )
    .min(1, "Minimal satu item harus dihitung"),
});

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

    const body = await req.json();
    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 },
      );
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const results = await computeVariance(db, branchId, parsed.data.items);

    return NextResponse.json({ items: results });
  } catch (error) {
    console.error("POS stock opname preview error:", error);
    return NextResponse.json(
      { error: "Gagal menghitung selisih stock opname" },
      { status: 500 },
    );
  }
}
