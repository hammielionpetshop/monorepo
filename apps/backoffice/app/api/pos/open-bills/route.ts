import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyAccessToken } from "@/lib/auth";
import { and, db, desc, eq, inArray, openBills, products } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";

export const dynamic = "force-dynamic";
// Ikut terpanggil saat POS dibuka, jadi ikut kena antrean pool yang sama.
// Lihat alasan lengkapnya di `app/pos/(authenticated)/page.tsx`.
export const maxDuration = 20;

const openBillSchema = z.object({
  branchId: z.number().int().positive("Cabang tidak valid"),
  shiftId: z.number().int().positive("Shift tidak valid"),
  billName: z.string().trim().max(100).optional().nullable(),
  holdName: z.string().trim().max(100).optional().nullable(),
  items: z.array(z.unknown()).min(1, "Item tidak boleh kosong"),
  customerId: z.number().int().positive().nullable().optional(),
  // Snapshot nama & tier pelanggan saat ditahan — dibutuhkan supaya pelanggan (dan
  // tier harganya) ikut pulih saat daftar tunggu dibuka kembali. `customerId` saja
  // tidak cukup karena memulihkannya lewat setSelectedCustomer akan menghitung ulang
  // harga (repriceItems), menimpa harga yang sudah diedit kasir sebelum ditahan.
  customerName: z.string().trim().max(200).nullable().optional(),
  customerTierType: z.string().trim().max(50).nullable().optional(),
  totalAmount: z.coerce.number().int().nonnegative("Total tidak valid"),
});

// Nota berisi jasa grooming tidak bisa ditahan: kucingnya sudah diterima dan karcisnya baru
// tercetak sesudah nota tersimpan, jadi notanya harus diselesaikan saat itu juga. Yang ditolak:
// baris yang membawa data kucing / pengantaran dari tab Grooming, dan produk berjenis jasa
// grooming. Ongkir biasa (antar barang) tetap boleh ditahan.
const HOLD_SERVICE_MESSAGE =
  "Nota berisi grooming tidak bisa ditahan. Selesaikan pembayarannya, atau lepas grooming dari keranjang dulu.";

async function containsGroomingService(items: unknown[]): Promise<boolean> {
  const productIds = new Set<number>();
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const line = item as { grooming?: unknown; delivery?: unknown; productId?: unknown };
    if (line.grooming != null || line.delivery != null) return true;
    const productId = Number(line.productId);
    if (Number.isInteger(productId) && productId > 0) productIds.add(productId);
  }
  if (productIds.size === 0) return false;
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(inArray(products.id, [...productIds]), eq(products.productKind, "JASA_GROOMING")))
    .limit(1);
  return rows.length > 0;
}

async function requirePosSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  const payload = token ? await verifyAccessToken(token) : null;

  if (!payload) return null;

  return { payload, branchId: getPosBranchId(payload, cookieStore) };
}

function rejectBranchMismatch(
  requestedBranchId: number | null,
  branchId: number,
) {
  if (requestedBranchId !== null && requestedBranchId !== branchId) {
    return NextResponse.json(
      { error: "Cabang POS tidak sesuai dengan sesi" },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requirePosSession();
    if (!session) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedBranchId = searchParams.get("branchId")
      ? Number(searchParams.get("branchId"))
      : null;
    const branchError = rejectBranchMismatch(
      requestedBranchId,
      session.branchId,
    );
    if (branchError) return branchError;

    const result = await db
      .select()
      .from(openBills)
      .where(eq(openBills.branchId, session.branchId))
      .orderBy(desc(openBills.createdAt));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[OpenBills] GET error:", err);
    return NextResponse.json(
      { error: "Gagal mengambil open bill" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePosSession();
    if (!session) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    if (!req.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type harus application/json" },
        { status: 415 },
      );
    }

    const body = await req.json();
    const parsed = openBillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 },
      );
    }

    const branchError = rejectBranchMismatch(
      parsed.data.branchId,
      session.branchId,
    );
    if (branchError) return branchError;

    if (await containsGroomingService(parsed.data.items)) {
      return NextResponse.json({ error: HOLD_SERVICE_MESSAGE }, { status: 400 });
    }

    const customerSnapshot =
      parsed.data.customerId != null && parsed.data.customerName
        ? {
            id: parsed.data.customerId,
            name: parsed.data.customerName,
            tierType: parsed.data.customerTierType || 'RETAIL',
          }
        : null;

    const [newBill] = await db
      .insert(openBills)
      .values({
        branchId: session.branchId,
        shiftId: parsed.data.shiftId,
        billName:
          parsed.data.billName ||
          parsed.data.holdName ||
          `Bill ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}`,
        // Item disimpan APA ADANYA (termasuk harga/tier hasil edit kasir) bersama
        // snapshot pelanggan, supaya keduanya bisa dipulihkan utuh tanpa dihitung ulang.
        items: JSON.stringify({ cartItems: parsed.data.items, customer: customerSnapshot }),
        customerId: parsed.data.customerId ?? null,
        totalAmount: parsed.data.totalAmount,
      })
      .returning();

    return NextResponse.json(newBill);
  } catch (err) {
    console.error("[OpenBills] POST error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan open bill" },
      { status: 500 },
    );
  }
}
