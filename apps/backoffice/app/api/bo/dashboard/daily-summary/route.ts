import { NextResponse } from 'next/server'
import { getDailySummary } from '@/lib/services/dashboard-service'

export const revalidate = 60

export async function GET() {
  try {
    const data = await getDailySummary()
    return NextResponse.json({ data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan sistem'
    console.error('Dashboard daily-summary error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
