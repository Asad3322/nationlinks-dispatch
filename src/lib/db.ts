import { PrismaClient, Prisma } from '@prisma/client';
import { Driver, Payment, DashboardStats, DriverQueryOptions, PaymentQueryOptions, PaginatedResult } from './types';
import { toCents, centsToDollars } from './currency';
import { parseStartDate, parseEndDate } from './dates';

/**
 * Supabase PostgreSQL is the ONLY data source for this application.
 * There is no seed data, no local file store and no fallback backend: if the
 * database is unconfigured or unreachable, every read and write fails loudly
 * so the UI can never display numbers that did not come from the database.
 */
function assertDatabaseConfigured(): void {
  const url = process.env.DATABASE_URL;
  if (!url || !url.trim()) {
    throw new Error(
      'Database Configuration Error: DATABASE_URL is not set. Add your Supabase connection string to .env.local.'
    );
  }
  // Any unreplaced [TOKEN] from the env template counts as an unconfigured value,
  // so a missing DB password surfaces as a config error rather than a driver error.
  if (url.includes('placeholder') || /\[[A-Z_]+\]/.test(url)) {
    throw new Error(
      'Database Configuration Error: DATABASE_URL still contains an unreplaced placeholder. ' +
        'Fill in your Supabase database password and region in .env.local.'
    );
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Returns the shared Prisma client, creating it on first use.
 * Instantiation is lazy so that a missing DATABASE_URL produces the explicit
 * configuration error above instead of an opaque client construction failure.
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    assertDatabaseConfigured();
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  return globalForPrisma.prisma;
}

/**
 * Unified Database Service — backed exclusively by Supabase PostgreSQL.
 */
export const dbService = {
  // -------------------------------------------------------------
  // DRIVER OPERATIONS
  // -------------------------------------------------------------

  async getDrivers(options: DriverQueryOptions = {}): Promise<PaginatedResult<Driver>> {
    const {
      search = '',
      sortBy = 'driverNumber',
      sortOrder = 'asc',
      page = 1,
      limit = 10,
      status,
      fromDate,
      toDate,
    } = options;

    const startDate = parseStartDate(fromDate) ?? null;
    const endDate = parseEndDate(toDate) ?? null;
    const prisma = getPrisma();

    // Driver-level filters (status / search).
    const conditions: Prisma.Sql[] = [];
    if (status) conditions.push(Prisma.sql`d.status = ${status}`);
    if (search.trim()) {
      const term = search.trim();
      const num = parseInt(term, 10);
      const like = `%${term}%`;
      conditions.push(
        isNaN(num)
          ? Prisma.sql`d.driver_name ILIKE ${like}`
          : Prisma.sql`(d.driver_number = ${num} OR d.driver_name ILIKE ${like})`
      );
    }
    const whereSql = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    // Totals count only active payments, and honour the date range when given.
    const inPeriod = Prisma.sql`
      p.status = 'active'
      AND (${startDate}::timestamptz IS NULL OR p.payment_date >= ${startDate}::timestamptz)
      AND (${endDate}::timestamptz IS NULL OR p.payment_date <= ${endDate}::timestamptz)`;

    // sortBy/sortOrder come from a closed union, so this interpolation is a
    // whitelist lookup rather than user-controlled SQL.
    const sortColumn = {
      driverNumber: 'd.driver_number',
      driverName: 'd.driver_name',
      totalPaid: 'total_paid',
      lastPaymentDate: 'last_payment_date',
    }[sortBy] ?? 'd.driver_number';
    const direction = sortOrder === 'desc' ? 'DESC' : 'ASC';
    // Drivers with no payments sorted as 0 / epoch previously, so keep nulls at
    // the bottom of a descending sort and the top of an ascending one.
    const nulls = direction === 'DESC' ? 'NULLS LAST' : 'NULLS FIRST';
    const orderSql = Prisma.raw(`${sortColumn} ${direction} ${nulls}, d.driver_number ASC`);

    const offset = (page - 1) * limit;

    // One round trip: filter, aggregate, sort, paginate and count in a single
    // query. COUNT(*) OVER () runs after GROUP BY, so it counts matching drivers.
    const rows = await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        d.id,
        d.driver_number,
        d.driver_name,
        d.status,
        d.created_at,
        d.updated_at,
        COALESCE(SUM(p.amount) FILTER (WHERE ${inPeriod}), 0) AS total_paid,
        MAX(p.payment_date) FILTER (WHERE ${inPeriod}) AS last_payment_date,
        COUNT(p.id) AS payment_count,
        COUNT(*) OVER () AS total_count
      FROM drivers d
      LEFT JOIN payments p ON p.driver_id = d.id
      ${whereSql}
      GROUP BY d.id
      ORDER BY ${orderSql}
      LIMIT ${limit} OFFSET ${offset}
    `);

    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

    const data: Driver[] = rows.map((r) => ({
      id: r.id,
      driverNumber: r.driver_number,
      driverName: r.driver_name,
      status: r.status as any,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      totalPaid: centsToDollars(toCents(Number(r.total_paid))),
      lastPaymentDate: r.last_payment_date ? new Date(r.last_payment_date).toISOString() : null,
      paymentCount: Number(r.payment_count),
    }));

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async getDriverById(id: string): Promise<Driver | null> {
    const prisma = getPrisma();
    const d = await prisma.driver.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });
    if (!d) return null;

    const allPayments = d.payments || [];
    const activePayments = allPayments.filter((p: any) => p.status === 'active');
    const totalCents = activePayments.reduce((sum: number, p: any) => sum + toCents(Number(p.amount)), 0);
    return {
      id: d.id,
      driverNumber: d.driverNumber,
      driverName: d.driverName,
      status: d.status as any,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      totalPaid: centsToDollars(totalCents),
      lastPaymentDate: activePayments[0]?.paymentDate?.toISOString() || null,
      paymentCount: allPayments.length,
    };
  },

  async getDriverByNumber(driverNumber: number): Promise<Driver | null> {
    const prisma = getPrisma();
    const d = await prisma.driver.findUnique({
      where: { driverNumber },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });
    if (!d) return null;

    const allPayments = d.payments || [];
    const activePayments = allPayments.filter((p: any) => p.status === 'active');
    const totalCents = activePayments.reduce((sum: number, p: any) => sum + toCents(Number(p.amount)), 0);
    return {
      id: d.id,
      driverNumber: d.driverNumber,
      driverName: d.driverName,
      status: d.status as any,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      totalPaid: centsToDollars(totalCents),
      lastPaymentDate: activePayments[0]?.paymentDate?.toISOString() || null,
      paymentCount: allPayments.length,
    };
  },

  async createDriver(data: { driverNumber: number; driverName?: string; status?: 'active' | 'inactive' }): Promise<Driver> {
    const { driverNumber, status = 'active' } = data;
    // Drivers are identified by number; the name is an optional label.
    const driverName = data.driverName?.trim() || `Driver #${driverNumber}`;
    const prisma = getPrisma();

    const existing = await this.getDriverByNumber(driverNumber);
    if (existing) {
      throw new Error(`Driver Number #${driverNumber} already exists in the system.`);
    }

    try {
      const created = await prisma.driver.create({
        data: {
          driverNumber,
          driverName,
          status,
        },
      });
      return {
        id: created.id,
        driverNumber: created.driverNumber,
        driverName: created.driverName,
        status: created.status as any,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        totalPaid: 0,
        lastPaymentDate: null,
        paymentCount: 0,
      };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new Error(`Driver Number #${driverNumber} already exists.`);
      }
      throw err;
    }
  },

  async updateDriver(
    id: string,
    data: { driverName?: string; status?: 'active' | 'inactive'; driverNumber?: number }
  ): Promise<Driver> {
    const prisma = getPrisma();

    if (data.driverNumber !== undefined) {
      const existing = await this.getDriverByNumber(data.driverNumber);
      if (existing && existing.id !== id) {
        throw new Error(`Driver Number #${data.driverNumber} is already taken.`);
      }
    }

    const updateData: any = {};
    if (data.driverName !== undefined) updateData.driverName = data.driverName.trim();
    if (data.status !== undefined) updateData.status = data.status;
    if (data.driverNumber !== undefined) updateData.driverNumber = data.driverNumber;

    const updated = await prisma.driver.update({
      where: { id },
      data: updateData,
    });

    const res = await this.getDriverById(updated.id);
    if (!res) throw new Error(`Failed to load updated driver #${updated.driverNumber}`);
    return res;
  },

  async deleteDriver(
    id: string,
    options: { force?: boolean } = {}
  ): Promise<{ success: boolean; mode: 'deleted' | 'deactivated'; message: string; driver: Driver }> {
    const prisma = getPrisma();

    const driver = await this.getDriverById(id);
    if (!driver) {
      throw new Error(`Driver with ID ${id} not found.`);
    }

    const paymentCount = await prisma.payment.count({
      where: { driverId: id },
    });

    // Force delete removes the driver together with their payment history.
    // Both statements run in one transaction so a driver can never be left
    // behind with its payments already gone, or vice versa.
    if (options.force) {
      await prisma.$transaction([
        prisma.payment.deleteMany({ where: { driverId: id } }),
        prisma.driver.delete({ where: { id } }),
      ]);
      return {
        success: true,
        mode: 'deleted',
        message:
          paymentCount > 0
            ? `Driver #${driver.driverNumber} and ${paymentCount} payment record(s) have been permanently deleted.`
            : `Driver #${driver.driverNumber} has been permanently deleted.`,
        driver,
      };
    }

    if (paymentCount > 0) {
      const deactivated = await this.updateDriver(id, { status: 'inactive' });
      return {
        success: true,
        mode: 'deactivated',
        message: `Driver #${driver.driverNumber} has ${paymentCount} financial transaction record(s) and was deactivated to preserve audit history.`,
        driver: deactivated,
      };
    }

    await prisma.driver.delete({
      where: { id },
    });

    return {
      success: true,
      mode: 'deleted',
      message: `Driver #${driver.driverNumber} has been permanently deleted.`,
      driver,
    };
  },

  // -------------------------------------------------------------
  // PAYMENT OPERATIONS
  // -------------------------------------------------------------

  async getPayments(options: PaymentQueryOptions = {}): Promise<PaginatedResult<Payment>> {
    const { driverId, driverNumber, fromDate, toDate, status, page = 1, limit = 50 } = options;

    const startDate = parseStartDate(fromDate) ?? null;
    const endDate = parseEndDate(toDate) ?? null;
    const prisma = getPrisma();

    const conditions: Prisma.Sql[] = [];
    if (status) conditions.push(Prisma.sql`p.status = ${status}`);
    if (driverId) conditions.push(Prisma.sql`p.driver_id = ${driverId}::uuid`);
    if (driverNumber) conditions.push(Prisma.sql`d.driver_number = ${driverNumber}`);
    conditions.push(Prisma.sql`(${startDate}::timestamptz IS NULL OR p.payment_date >= ${startDate}::timestamptz)`);
    conditions.push(Prisma.sql`(${endDate}::timestamptz IS NULL OR p.payment_date <= ${endDate}::timestamptz)`);

    // limit <= 0 means "every matching row" — used by the Excel exports so they
    // are never silently truncated by an arbitrary cap.
    const unlimited = limit <= 0;
    const offset = unlimited ? 0 : (page - 1) * limit;
    const pageSql = unlimited ? Prisma.empty : Prisma.sql`LIMIT ${limit} OFFSET ${offset}`;

    // Rows and the total count come back together, so the ledger is one round trip.
    const rows = await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        p.id, p.driver_id, p.amount, p.payment_date, p.status, p.notes,
        p.created_at, p.updated_at,
        d.driver_number, d.driver_name,
        COUNT(*) OVER () AS total_count
      FROM payments p
      JOIN drivers d ON d.id = p.driver_id
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY p.payment_date DESC
      ${pageSql}
    `);

    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

    const data: Payment[] = rows.map((r) => ({
      id: r.id,
      driverId: r.driver_id,
      driverNumber: r.driver_number,
      driverName: r.driver_name,
      amount: Number(r.amount),
      paymentDate: new Date(r.payment_date).toISOString(),
      status: r.status as any,
      notes: r.notes,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));

    return {
      data,
      pagination: {
        total,
        page: unlimited ? 1 : page,
        limit: unlimited ? total : limit,
        totalPages: unlimited ? 1 : Math.ceil(total / limit) || 1,
      },
    };
  },

  async createPayment(data: {
    driverNumber: number;
    amount: number;
    paymentDate?: string;
    notes?: string;
  }): Promise<Payment> {
    const { driverNumber, amount, paymentDate, notes } = data;
    const prisma = getPrisma();

    if (!Number.isInteger(driverNumber) || driverNumber <= 0) {
      throw new Error('Driver Number must be a valid positive number.');
    }

    // Validate the amount BEFORE touching the drivers table, so a rejected
    // submission can never register a driver as a side effect.
    const cents = toCents(amount);
    if (cents <= 0) {
      throw new Error('Payment amount must be greater than $0.00.');
    }
    const cleanAmount = centsToDollars(cents);

    const existing = await prisma.driver.findUnique({ where: { driverNumber } });
    if (existing && existing.status === 'inactive') {
      throw new Error(`Driver #${driverNumber} is currently inactive.`);
    }

    // The quick-payment form collects only a driver number and an amount, so an
    // unrecognised number registers the driver rather than rejecting the payment.
    // upsert rather than create keeps this correct if two payments for the same
    // new driver number arrive concurrently.
    const driver =
      existing ??
      (await prisma.driver.upsert({
        where: { driverNumber },
        update: {},
        create: {
          driverNumber,
          driverName: `Driver #${driverNumber}`,
          status: 'active',
        },
      }));

    const recordDate = paymentDate ? new Date(paymentDate) : new Date();

    const created = await prisma.payment.create({
      data: {
        driverId: driver.id,
        amount: cleanAmount,
        paymentDate: recordDate,
        status: 'active',
        notes: notes || null,
      },
      include: { driver: true },
    });

    return {
      id: created.id,
      driverId: created.driverId,
      driverNumber: created.driver.driverNumber,
      driverName: created.driver.driverName,
      amount: Number(created.amount),
      paymentDate: created.paymentDate.toISOString(),
      status: created.status as any,
      notes: created.notes,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      driverCreated: !existing,
    };
  },

  async updatePayment(
    id: string,
    data: { amount?: number; paymentDate?: string; notes?: string }
  ): Promise<Payment> {
    const prisma = getPrisma();

    if (data.amount !== undefined) {
      const cents = toCents(data.amount);
      if (cents <= 0) {
        throw new Error('Payment amount must be greater than $0.00.');
      }
    }

    const existing = await prisma.payment.findUnique({ where: { id }, include: { driver: true } });
    if (!existing) throw new Error(`Payment ${id} not found.`);

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.amount !== undefined) {
      const cleanAmount = centsToDollars(toCents(data.amount));
      updateData.amount = cleanAmount;
      const auditNote = `[Amount updated from $${Number(existing.amount).toFixed(2)} to $${cleanAmount.toFixed(2)} on ${new Date().toISOString()}]`;
      updateData.notes = data.notes !== undefined
        ? `${data.notes} ${auditNote}`
        : existing.notes ? `${existing.notes} ${auditNote}` : auditNote;
    } else if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    if (data.paymentDate) {
      updateData.paymentDate = new Date(data.paymentDate);
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: updateData,
      include: { driver: true },
    });

    return {
      id: updated.id,
      driverId: updated.driverId,
      driverNumber: updated.driver.driverNumber,
      driverName: updated.driver.driverName,
      amount: Number(updated.amount),
      paymentDate: updated.paymentDate.toISOString(),
      status: updated.status as any,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  },

  async voidPayment(id: string, reason?: string): Promise<Payment> {
    const prisma = getPrisma();

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status: 'voided',
        notes: reason ? `VOIDED: ${reason}` : undefined,
      },
      include: { driver: true },
    });

    return {
      id: updated.id,
      driverId: updated.driverId,
      driverNumber: updated.driver.driverNumber,
      driverName: updated.driver.driverName,
      amount: Number(updated.amount),
      paymentDate: updated.paymentDate.toISOString(),
      status: 'voided',
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  },

  // -------------------------------------------------------------
  // DASHBOARD CALCULATIONS
  // -------------------------------------------------------------

  async getDashboardStats(fromDate?: string, toDate?: string): Promise<DashboardStats> {
    const startDate = parseStartDate(fromDate) ?? null;
    const endDate = parseEndDate(toDate) ?? null;
    const prisma = getPrisma();

    // "Today" is resolved here rather than in SQL so it stays the server's local
    // day, matching isToday(), instead of the database's UTC day.
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const inPeriod = Prisma.sql`
      (${startDate}::timestamptz IS NULL OR payment_date >= ${startDate}::timestamptz)
      AND (${endDate}::timestamptz IS NULL OR payment_date <= ${endDate}::timestamptz)`;
    const isToday_ = Prisma.sql`payment_date >= ${todayStart}::timestamptz AND payment_date <= ${todayEnd}::timestamptz`;

    // Every figure on the dashboard in a single round trip.
    const [row] = await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM drivers) AS total_drivers,
        (SELECT COUNT(*) FROM drivers WHERE status = 'active') AS active_drivers,
        COUNT(*) FILTER (WHERE ${isToday_}) AS payments_today_count,
        COALESCE(SUM(amount) FILTER (WHERE ${isToday_}), 0) AS payments_today_amount,
        COALESCE(SUM(amount), 0) AS total_paid_amount,
        COALESCE(SUM(amount) FILTER (WHERE ${inPeriod}), 0) AS period_paid_amount,
        COUNT(*) FILTER (WHERE ${inPeriod}) AS period_payments_count,
        COUNT(DISTINCT driver_id) FILTER (WHERE ${inPeriod}) AS period_paid_drivers_count
      FROM payments
      WHERE status = 'active'
    `);

    const money = (v: any) => centsToDollars(toCents(Number(v ?? 0)));

    return {
      totalDrivers: Number(row.total_drivers),
      activeDrivers: Number(row.active_drivers),
      paymentsTodayCount: Number(row.payments_today_count),
      paymentsTodayAmount: money(row.payments_today_amount),
      totalPaidAmount: money(row.total_paid_amount),
      periodPaidAmount: money(row.period_paid_amount),
      periodPaymentsCount: Number(row.period_payments_count),
      periodPaidDriversCount: Number(row.period_paid_drivers_count),
    };
  },
};
