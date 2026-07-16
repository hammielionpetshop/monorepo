import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { eq, and } from "@/lib/db";
import { stockOpnames, stockOpnameItems } from "@/lib/db";
import { db } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";
import { computeItemVariance } from "@/lib/services/stock-opname";
import { resolveSnapshotQty } from "@/lib/so-count-snapshot";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });
const addItemsSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        uomId: z.coerce.number().int().positive(),
        physicalQty: z.coerce.number().min(0),
        varianceReason: z.string().max(255).optional(),
        snapshotToken: z.string().min(1, "Snapshot hitungan wajib ada"),
      }),
    )
    .min(1, "Minimal satu item harus ditambahkan"),
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
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const parsedParams = paramsSchema.safeParse({ id });
    if (!parsedParams.success) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    const body = await req.json();
    const parsedBody = addItemsSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 },
      );
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const soId = parsedParams.data.id;
    const { items } = parsedBody.data;

    const result = await db.transaction(async (tx) => {
      const [so] = await tx
        .select()
        .from(stockOpnames)
        .where(eq(stockOpnames.id, soId))
        .for("update")
        .limit(1);

      if (!so) throw new Error("SO_NOT_FOUND");
      if (so.branchId !== branchId) throw new Error("BRANCH_FORBIDDEN");
      // DRAFT = baru dibuat backoffice, PENDING = sudah ada hitungan tapi belum disetujui.
      // Keduanya masih boleh diisi: SO Besar lazim dihitung & disubmit bertahap.
      if (so.status !== "DRAFT" && so.status !== "PENDING") {
        throw new Error("ALREADY_PROCESSED");
      }

      const trustedBranchId = so.branchId;

      const processedItems = [];

      for (const item of items) {
        const systemQtyOverride = await resolveSnapshotQty(item.snapshotToken, {
          branchId: Number(trustedBranchId),
          productId: item.productId,
          uomId: item.uomId,
        });

        if (systemQtyOverride === null) {
          throw new Error("INVALID_SNAPSHOT");
        }

        const { systemQty, physicalQty, varianceQty, varianceCostValue } =
          await computeItemVariance(tx, Number(trustedBranchId), {
            productId: item.productId,
            uomId: item.uomId,
            physicalQty: item.physicalQty,
            systemQtyOverride,
          });

        const existingItems = await tx
          .select()
          .from(stockOpnameItems)
          .where(
            and(
              eq(stockOpnameItems.soId, soId),
              eq(stockOpnameItems.productId, item.productId),
              eq(stockOpnameItems.uomId, item.uomId),
            ),
          )
          .limit(1);

        if (existingItems.length > 0) {
          const [updated] = await tx
            .update(stockOpnameItems)
            .set({
              systemQty,
              physicalQty,
              varianceQty,
              varianceCostValue,
              varianceReason: item.varianceReason ?? existingItems[0].varianceReason,
            })
            .where(eq(stockOpnameItems.id, existingItems[0].id))
            .returning();
          processedItems.push(updated);
        } else {
          const [inserted] = await tx
            .insert(stockOpnameItems)
            .values({
              soId,
              productId: item.productId,
              uomId: item.uomId,
              systemQty,
              physicalQty,
              varianceQty,
              varianceCostValue,
              varianceReason: item.varianceReason ?? null,
            })
            .returning();
          processedItems.push(inserted);
        }
      }

      // Hitungan sudah masuk → siap disetujui
      if (so.status === "DRAFT") {
        await tx
          .update(stockOpnames)
          .set({ status: "PENDING" })
          .where(eq(stockOpnames.id, soId));
      }

      return processedItems;
    });

    return NextResponse.json({
      success: true,
      itemsCount: result.length,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === "SO_NOT_FOUND") {
        return NextResponse.json(
          { error: "Stock opname tidak ditemukan" },
          { status: 404 },
        );
      }
      if (error.message === "BRANCH_FORBIDDEN") {
        return NextResponse.json(
          { error: "Stock opname bukan milik cabang ini" },
          { status: 403 },
        );
      }
      if (error.message === "ALREADY_PROCESSED") {
        return NextResponse.json(
          { error: "Stock opname sudah diproses" },
          { status: 409 },
        );
      }
      if (error.message === "INVALID_SNAPSHOT") {
        return NextResponse.json(
          { error: "Snapshot hitungan tidak valid atau kedaluwarsa, silakan hitung ulang produk tersebut" },
          { status: 400 },
        );
      }
    }

    console.error("Add Items to SO API error:", error);
    return NextResponse.json(
      { error: "Gagal menambahkan item stock opname" },
      { status: 500 },
    );
  }
}
