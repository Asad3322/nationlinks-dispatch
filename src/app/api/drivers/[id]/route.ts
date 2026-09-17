import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const driver = await dbService.getDriverById(id);

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    return NextResponse.json(driver);
  } catch (error: any) {
    console.error('API /api/drivers/[id] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch driver' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { driverName, status, driverNumber } = body;

    const updatePayload: any = {};
    if (driverName !== undefined) {
      if (!driverName.trim()) {
        return NextResponse.json({ error: 'Driver name cannot be empty' }, { status: 400 });
      }
      updatePayload.driverName = driverName.trim();
    }

    if (status !== undefined) {
      if (status !== 'active' && status !== 'inactive') {
        return NextResponse.json({ error: 'Status must be active or inactive' }, { status: 400 });
      }
      updatePayload.status = status;
    }

    if (driverNumber !== undefined) {
      const num = parseInt(String(driverNumber), 10);
      if (isNaN(num) || num <= 0) {
        return NextResponse.json({ error: 'Driver number must be a positive integer' }, { status: 400 });
      }
      updatePayload.driverNumber = num;
    }

    const updated = await dbService.updateDriver(id, updatePayload);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('API /api/drivers/[id] PATCH error:', error);
    const status = error.message?.includes('already taken') ? 409 : 500;
    return NextResponse.json(
      { error: error.message || 'Failed to update driver' },
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await dbService.deleteDriver(id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/drivers/[id] DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete/deactivate driver' },
      { status: 500 }
    );
  }
}
