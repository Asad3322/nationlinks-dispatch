import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    const stats = await dbService.getDashboardStats(fromDate, toDate);
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('API /api/dashboard/stats GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
