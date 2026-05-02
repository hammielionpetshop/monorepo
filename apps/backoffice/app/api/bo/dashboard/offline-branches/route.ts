import { NextResponse } from 'next/server'
import { getOfflineBranches } from '@/lib/services/dashboard-service'

export const revalidate = 60

export async function GET() {
  try {
    const data = await getOfflineBranches()
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil status cabang' },
      { status: 500 }
    )
  }
}
