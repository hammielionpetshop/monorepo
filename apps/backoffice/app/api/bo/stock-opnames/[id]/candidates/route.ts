import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { getSOFullCandidates } from "@/lib/services/stock-opname-candidates";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID tidak valid"),
});

/**
 * Cakupan produk untuk input SO Besar langsung dari backoffice. Logika daftar ada
 * di `getSOFullCandidates` (dipakai bersama ekspor CSV).
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

    const result = await getSOFullCandidates(soId);

    if (!result) {
      return NextResponse.json(
        { error: "Stock opname tidak ditemukan" },
        { status: 404 },
      );
    }

    if (result.type !== "FULL") {
      return NextResponse.json(
        { error: "Daftar kandidat produk hanya berlaku untuk SO Besar" },
        { status: 400 },
      );
    }

    if (payload.branchScope !== "ALL" && payload.branchId !== result.branchId) {
      return NextResponse.json(
        { error: "Akses ditolak. Anda hanya dapat melihat stock opname cabang Anda sendiri." },
        { status: 403 },
      );
    }

    return NextResponse.json({ items: result.items });
  } catch (error) {
    console.error("GET /api/bo/stock-opnames/[id]/candidates error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil daftar kandidat produk" },
      { status: 500 },
    );
  }
}
