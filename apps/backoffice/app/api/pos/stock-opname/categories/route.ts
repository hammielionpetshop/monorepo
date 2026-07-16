import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { db, sql, eq, and, asc, categories, products } from "@/lib/db";

export const dynamic = "force-dynamic";

// Daftar kategori yang punya produk aktif — untuk metode hitung SO "Per Kategori"
export async function GET() {
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

    const rows = await db
      .select({
        id: categories.id,
        name: categories.name,
        productCount: sql<number>`count(${products.id})::int`,
      })
      .from(categories)
      .innerJoin(
        products,
        and(eq(products.categoryId, categories.id), eq(products.isActive, true)),
      )
      .groupBy(categories.id, categories.name)
      .orderBy(asc(categories.name));

    return NextResponse.json(rows);
  } catch (error) {
    console.error("POS stock opname categories error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil daftar kategori" },
      { status: 500 },
    );
  }
}
