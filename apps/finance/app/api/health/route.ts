import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await getSql()`select 1`;
    return NextResponse.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', database: 'disconnected', error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
