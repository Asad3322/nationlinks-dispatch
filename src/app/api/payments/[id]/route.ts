import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, reason, amount, paymentDate, notes } = body;

    if (action === 'void') {
      const voided = await dbService.voidPayment(id, reason);
      return NextResponse.json(voided);
    }

    if (action === 'edit') {
      if (amount !== undefined) {
        const parsedAmount = parseFloat(String(amount));
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          return NextResponse.json({ error: 'Amount must be greater than $0.00' }, { status: 400 });
        }
      }
      const updated = await dbService.updatePayment(id, {
        amount: amount !== undefined ? parseFloat(String(amount)) : undefined,
        paymentDate,
        notes,
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Unsupported action. Must be "void" or "edit".' }, { status: 400 });
  } catch (error: any) {
    console.error('API /api/payments/[id] PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update payment' },
      { status: 500 }
    );
  }
}
