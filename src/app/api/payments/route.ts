import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId') || undefined;
    const driverNumberStr = searchParams.get('driverNumber');
    const driverNumber = driverNumberStr ? parseInt(driverNumberStr, 10) : undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;
    const status = (searchParams.get('status') as any) || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await dbService.getPayments({
      driverId,
      driverNumber,
      fromDate,
      toDate,
      status,
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 50 : limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/payments GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { driverNumber, amount, paymentDate, notes } = body;

    if (driverNumber === undefined || driverNumber === null) {
      return NextResponse.json({ error: 'Driver Number is required' }, { status: 400 });
    }

    const parsedNumber = parseInt(String(driverNumber).trim(), 10);
    if (isNaN(parsedNumber) || parsedNumber <= 0) {
      return NextResponse.json({ error: 'Driver Number must be a valid positive integer' }, { status: 400 });
    }

    const parsedAmount = parseFloat(String(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than $0.00' }, { status: 400 });
    }

    const payment = await dbService.createPayment({
      driverNumber: parsedNumber,
      amount: parsedAmount,
      paymentDate,
      notes,
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    console.error('API /api/payments POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 400 }
    );
  }
}
