import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { getPosBranchId } from "@/lib/pos-branch";
import { db, stockOpnames, eq } from "@/lib/db";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive("ID tidak valid"),
});

const rejectSchema = z.object({
  reason: z.string().trim().min(3, "Alasan penolakan minimal 3 karakter").max(500),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    const payload = token ? await verifyAccessToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: "Sesi tidak valid, silakan login kembali" }, { status: 401 });
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const actorId = Number(payload.userId);
    if (!Number.isInteger(actorId) || actorId <= 0) {
      return NextResponse.json({ error: "Sesi tidak valid, silakan login kembali" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json({ error: "Content-Type harus application/json" }, { status: 415 });
    }

    const paramParsed = paramsSchema.safeParse(await params);
    if (!paramParsed.success) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Format request tidak valid" }, { status: 400 });
    }

    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" }, { status: 400 });
    }

    const updatedSo = await db.transaction(async (tx) => {
      const soRows = await tx
        .select()
        .from(stockOpnames)
        .where(eq(stockOpnames.id, paramParsed.data.id))
        .for("update")
        .limit(1);

      const so = soRows[0];
      if (!so) throw new Error("SO_NOT_FOUND");
      if (so.branchId !== branchId) throw new Error("BRANCH_FORBIDDEN");
      if (so.status !== "PENDING") throw new Error("ALREADY_PROCESSED");

      const [updated] = await tx
        .update(stockOpnames)
        .set({
          status: "REJECTED",
          rejectedById: actorId,
          rejectedAt: new Date(),
          rejectionNote: parsed.data.reason,
          completedAt: new Date(),
        })
        .where(eq(stockOpnames.id, paramParsed.data.id))
        .returning();

      return updated;
    });

    return NextResponse.json({ success: true, so: updatedSo });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === "SO_NOT_FOUND") {
        return NextResponse.json({ error: "Stock opname tidak ditemukan" }, { status: 404 });
      }
      if (error.message === "BRANCH_FORBIDDEN") {
        return NextResponse.json({ error: "Stock opname bukan milik cabang ini" }, { status: 403 });
      }
      if (error.message === "ALREADY_PROCESSED") {
        return NextResponse.json({ error: "Stock opname sudah diproses" }, { status: 409 });
      }
    }

    console.error("PATCH /api/pos/stock-opnames/[id]/reject error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan saat menolak stock opname" }, { status: 500 });
  }
}
