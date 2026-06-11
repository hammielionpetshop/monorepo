import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { verifyAccessToken } from "@/lib/auth";
import { and, db, eq, or, roles, users } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const requestedBranchId = searchParams.get("branchId")
      ? Number(searchParams.get("branchId"))
      : null;
    const branchId = getPosBranchId(payload, cookieStore);

    if (requestedBranchId !== null && requestedBranchId !== branchId) {
      return NextResponse.json(
        { error: "Cabang POS tidak sesuai dengan sesi" },
        { status: 403 },
      );
    }

    // Kasir dan Manager difilter per cabang (branchId di record mereka).
    // Owner tidak terikat cabang — ditampilkan untuk semua cabang.
    const result = await db
      .select({
        id: users.id,
        name: users.name,
        role: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          eq(users.isActive, true),
          or(
            and(
              eq(users.branchId, branchId),
              or(
                eq(roles.name, 'KASIR'),
                eq(roles.name, 'MANAGER')
              )
            ),
            eq(roles.name, 'OWNER')
          )
        )
      );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Users list API error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil daftar user POS" },
      { status: 500 },
    );
  }
}
