import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db';
import { DriverQueryOptions } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || undefined;
    const sortBy = (searchParams.get('sortBy') as DriverQueryOptions['sortBy']) || 'driverNumber';
    const sortOrder = (searchParams.get('sortOrder') as DriverQueryOptions['sortOrder']) || 'asc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const status = (searchParams.get('status') as any) || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    const result = await dbService.getDrivers({
      search,
      sortBy,
      sortOrder,
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 10 : limit,
      status,
      fromDate,
      toDate,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/drivers GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch drivers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { driverNumber, driverName, status = 'active' } = body;

    // Validation
    const parsedNumber = parseInt(String(driverNumber).trim(), 10);
    if (isNaN(parsedNumber) || parsedNumber <= 0) {
      return NextResponse.json(
        { error: 'Driver Number must be a valid positive integer.' },
        { status: 400 }
      );
    }

    if (!driverName || typeof driverName !== 'string' || !driverName.trim()) {
      return NextResponse.json(
        { error: 'Driver Name is required.' },
        { status: 400 }
      );
    }

    if (status !== 'active' && status !== 'inactive') {
      return NextResponse.json(
        { error: 'Invalid status. Must be "active" or "inactive".' },
        { status: 400 }
      );
    }

    const created = await dbService.createDriver({
      driverNumber: parsedNumber,
      driverName: driverName.trim(),
      status,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('API /api/drivers POST error:', error);
    const status = error.message?.includes('already exists') ? 409 : 500;
    return NextResponse.json(
      { error: error.message || 'Failed to create driver' },
      { status }
    );
  }
}
