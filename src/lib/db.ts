import fs from 'fs';
import path from 'path';
import { Driver, Payment, DashboardStats, DriverQueryOptions, PaymentQueryOptions, PaginatedResult } from './types';
import { toCents, centsToDollars } from './currency';
import { parseStartDate, parseEndDate, isToday } from './dates';

// Prisma client dynamic instantiation for Supabase PostgreSQL
let prismaClientInstance: any = null;
try {
  // Use dynamic require so bundler does not choke when Prisma client is generating
  const req = typeof window === 'undefined' ? eval('require') : null;
  if (req) {
    const { PrismaClient } = req('@prisma/client');
    const globalForPrisma = globalThis as unknown as { prisma: any };
    prismaClientInstance =
      globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      });
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaClientInstance;
  }
} catch {
  // Client will be initialized once @prisma/client is installed and generated
}

export const prisma = prismaClientInstance;

export type DataBackendMode = 'postgres' | 'json';

/**
 * Resolves the active data backend mode.
 * - Explicit DATA_BACKEND=postgres requires Supabase PostgreSQL.
 * - Explicit DATA_BACKEND=json enables offline local file development.
 * - Production ALWAYS defaults to postgres; never silently falls back to JSON.
 */
export function getDataBackendMode(): DataBackendMode {
  const backend = (process.env.DATA_BACKEND || '').trim().toLowerCase();
  if (backend === 'postgres') return 'postgres';
  if (backend === 'json') return 'json';

  if (process.env.NODE_ENV === 'production') {
    return 'postgres';
  }
  return 'json';
}

/**
 * Asserts that Supabase PostgreSQL is configured with real non-placeholder credentials.
 * Throws explicit error if credentials are missing or placeholders.
 * Strictly prevents silent fallback to JSON.
 */
export function assertPostgresConfigured(): void {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes('placeholder') || url.includes('[PROJECT_REF]')) {
    throw new Error(
      'Database Configuration Error: Supabase credentials are required in .env.local. Silent fallback to JSON is strictly disabled.'
    );
  }
  if (!prisma) {
    throw new Error(
      'Database Initialization Error: Prisma Client is not initialized. Please ensure DATABASE_URL is valid in .env.local and Prisma Client has been generated.'
    );
  }
}

// Fallback file persistence path for reliable local development
const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'nationlinks_data.json');

// Reference drivers from specification/screenshot with NO fake payments (Rule #3)
const INITIAL_DRIVERS: Omit<Driver, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { driverNumber: 1, driverName: 'John Smith', status: 'active' },
  { driverNumber: 3, driverName: 'Michael Doe', status: 'active' },
  { driverNumber: 4, driverName: 'David Smith', status: 'active' },
  { driverNumber: 5, driverName: 'Robert Johnson', status: 'active' },
  { driverNumber: 8, driverName: 'James Wilson', status: 'active' },
  { driverNumber: 9, driverName: 'William Brown', status: 'active' },
  { driverNumber: 32, driverName: 'Richard Davis', status: 'active' },
  { driverNumber: 45, driverName: 'Thomas Miller', status: 'active' },
  { driverNumber: 54, driverName: 'Charles Anderson', status: 'active' },
  { driverNumber: 60, driverName: 'Joseph Taylor', status: 'active' },
  { driverNumber: 79, driverName: 'Daniel Thomas', status: 'active' },
  { driverNumber: 85, driverName: 'Matthew White', status: 'active' },
  { driverNumber: 86, driverName: 'Anthony Harris', status: 'active' },
];

interface LocalDataStore {
  drivers: Driver[];
  payments: Payment[];
}

function loadLocalStore(): LocalDataStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading local data file, re-initializing:', err);
  }

  // Seed default drivers (without fake payments per spec Rule #3)
  const now = new Date().toISOString();
  const seededDrivers: Driver[] = INITIAL_DRIVERS.map((d, index) => ({
    id: `drv-${d.driverNumber}-${index}`,
    driverNumber: d.driverNumber,
    driverName: d.driverName,
    status: d.status,
    createdAt: now,
    updatedAt: now,
  }));

  const initialStore: LocalDataStore = {
    drivers: seededDrivers,
    payments: [],
  };

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing initial store:', err);
  }

  return initialStore;
}

function saveLocalStore(store: LocalDataStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

/**
 * Unified Database Service
 * Connects to Supabase PostgreSQL when DATA_BACKEND=postgres,
 * and provides file persistence ONLY when explicitly configured with DATA_BACKEND=json.
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

    const startDate = parseStartDate(fromDate);
    const endDate = parseEndDate(toDate);

    if (getDataBackendMode() === 'postgres') {
      assertPostgresConfigured();

      const where: any = {};
      if (status) where.status = status;
      if (search.trim()) {
        const num = parseInt(search.trim(), 10);
        if (!isNaN(num)) {
          where.OR = [
            { driverNumber: num },
            { driverName: { contains: search.trim(), mode: 'insensitive' } },
          ];
        } else {
          where.driverName = { contains: search.trim(), mode: 'insensitive' };
        }
      }

      const total = await prisma.driver.count({ where });

      const rawDrivers = await prisma.driver.findMany({
        where,
        include: {
          payments: {
            orderBy: { paymentDate: 'desc' },
          },
        },
      });

      // Compute aggregations using cent-safe arithmetic
      const enriched: Driver[] = rawDrivers.map((d: any) => {
        const allPayments = d.payments || [];
        let activePayments = allPayments.filter((p: any) => p.status === 'active');

        // Apply date filter to active payments for period totals if specified
        if (startDate) {
          activePayments = activePayments.filter((p: any) => new Date(p.paymentDate).getTime() >= startDate.getTime());
        }
        if (endDate) {
          activePayments = activePayments.filter((p: any) => new Date(p.paymentDate).getTime() <= endDate.getTime());
        }

        const totalCents = activePayments.reduce((sum: number, p: any) => sum + toCents(Number(p.amount)), 0);
        const lastPayment = activePayments[0]?.paymentDate?.toISOString() || null;
        return {
          id: d.id,
          driverNumber: d.driverNumber,
          driverName: d.driverName,
          status: d.status as any,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
          totalPaid: centsToDollars(totalCents),
          lastPaymentDate: lastPayment,
          paymentCount: allPayments.length,
        };
      });

      // Default & manual sorting: Numeric Ascending by default (1, 3, 4, 5... 86)
      enriched.sort((a: Driver, b: Driver) => {
        if (sortBy === 'driverNumber') {
          return sortOrder === 'asc' ? a.driverNumber - b.driverNumber : b.driverNumber - a.driverNumber;
        }
        if (sortBy === 'driverName') {
          const cmp = a.driverName.localeCompare(b.driverName, undefined, { sensitivity: 'base' });
          return sortOrder === 'asc' ? cmp : -cmp;
        }
        if (sortBy === 'totalPaid') {
          const diff = toCents(a.totalPaid || 0) - toCents(b.totalPaid || 0);
          return sortOrder === 'asc' ? diff : -diff;
        }
        if (sortBy === 'lastPaymentDate') {
          const timeA = a.lastPaymentDate ? new Date(a.lastPaymentDate).getTime() : 0;
          const timeB = b.lastPaymentDate ? new Date(b.lastPaymentDate).getTime() : 0;
          return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }
        return a.driverNumber - b.driverNumber;
      });

      const start = (page - 1) * limit;
      const pagedData = enriched.slice(start, start + limit);

      return {
        data: pagedData,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }

    // Explicit Local file-backed driver repository (DATA_BACKEND=json)
    const store = loadLocalStore();
    let drivers = [...store.drivers];

    // Status filter
    if (status) {
      drivers = drivers.filter((d) => d.status === status);
    }

    // Search filter (number or case-insensitive name)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const numQuery = parseInt(search.trim(), 10);
      drivers = drivers.filter((d) => {
        const matchesName = d.driverName.toLowerCase().includes(q);
        const matchesNum = !isNaN(numQuery) && d.driverNumber === numQuery;
        return matchesName || matchesNum;
      });
    }

    // Compute totals per driver using safe cents
    const enrichedDrivers: Driver[] = drivers.map((d: Driver) => {
      const allPayments = store.payments.filter((p: Payment) => p.driverId === d.id);
      let activePayments = allPayments.filter((p: Payment) => p.status === 'active');

      if (startDate) {
        activePayments = activePayments.filter((p: Payment) => new Date(p.paymentDate).getTime() >= startDate.getTime());
      }
      if (endDate) {
        activePayments = activePayments.filter((p: Payment) => new Date(p.paymentDate).getTime() <= endDate.getTime());
      }

      activePayments.sort((a: Payment, b: Payment) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

      const totalCents = activePayments.reduce((sum: number, p: Payment) => sum + toCents(p.amount), 0);
      return {
        ...d,
        totalPaid: centsToDollars(totalCents),
        lastPaymentDate: activePayments[0]?.paymentDate || null,
        paymentCount: allPayments.length,
      };
    });

    // Default & manual sorting: Numeric Ascending by default!
    enrichedDrivers.sort((a: Driver, b: Driver) => {
      if (sortBy === 'driverNumber') {
        return sortOrder === 'asc' ? a.driverNumber - b.driverNumber : b.driverNumber - a.driverNumber;
      }
      if (sortBy === 'driverName') {
        const cmp = a.driverName.localeCompare(b.driverName, undefined, { sensitivity: 'base' });
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      if (sortBy === 'totalPaid') {
        const diff = toCents(a.totalPaid || 0) - toCents(b.totalPaid || 0);
        return sortOrder === 'asc' ? diff : -diff;
      }
      if (sortBy === 'lastPaymentDate') {
        const timeA = a.lastPaymentDate ? new Date(a.lastPaymentDate).getTime() : 0;
        const timeB = b.lastPaymentDate ? new Date(b.lastPaymentDate).getTime() : 0;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return a.driverNumber - b.driverNumber;
    });

    const total = enrichedDrivers.length;
    const start = (page - 1) * limit;
    const pagedData = enrichedDrivers.slice(start, start + limit);

    return {
      data: pagedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async getDriverById(id: string): Promise<Driver | null> {
    if (getDataBackendMode() === 'postgres') {
      assertPostgresConfigured();
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
    }

    const store = loadLocalStore();
    const driver = store.drivers.find((d) => d.id === id);
    if (!driver) return null;

    const allPayments = store.payments.filter((p) => p.driverId === id);
    const activePayments = allPayments
      .filter((p) => p.status === 'active')
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

    const totalCents = activePayments.reduce((sum: number, p: Payment) => sum + toCents(p.amount), 0);

    return {
      ...driver,
      totalPaid: centsToDollars(totalCents),
      lastPaymentDate: activePayments[0]?.paymentDate || null,
      paymentCount: allPayments.length,
    };
  },

  async getDriverByNumber(driverNumber: number): Promise<Driver | null> {
    if (getDataBackendMode() === 'postgres') {
      assertPostgresConfigured();
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
    }

    const store = loadLocalStore();
    const driver = store.drivers.find((d) => d.driverNumber === driverNumber);
    if (!driver) return null;

    const allPayments = store.payments.filter((p) => p.driverId === driver.id);
    const activePayments = allPayments
      .filter((p) => p.status === 'active')
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

    const totalCents = activePayments.reduce((sum: number, p: Payment) => sum + toCents(p.amount), 0);

    return {
      ...driver,
      totalPaid: centsToDollars(totalCents),
      lastPaymentDate: activePayments[0]?.paymentDate || null,
      paymentCount: allPayments.length,
    };
  },

  async createDriver(data: { driverNumber: number; driverName: string; status?: 'active' | 'inactive' }): Promise<Driver> {
    const { driverNumber, driverName, status = 'active' } = data;

    const existing = await this.getDriverByNumber(driverNumber);
    if (existing) {
      throw new Error(`Driver Number #${driverNumber} already exists in the system.`);
    }

    if (getDataBackendMode() === 'postgres') {
      assertPostgresConfigured();
      try {
        const created = await prisma.driver.create({
          data: {
            driverNumber,
            driverName: driverName.trim(),
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
    }

    const store = loadLocalStore();
    const now = new Date().toISOString();
    const newDriver: Driver = {
      id: `drv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      driverNumber,
      driverName: driverName.trim(),
      status,
      createdAt: now,
      updatedAt: now,
      totalPaid: 0,
      lastPaymentDate: null,
      paymentCount: 0,
    };

    store.drivers.push(newDriver);
    saveLocalStore(store);
    return newDriver;
  },

  async updateDriver(
    id: string,
    data: { driverName?: string; status?: 'active' | 'inactive'; driverNumber?: number }
  ): Promise<Driver> {
    if (data.driverNumber !== undefined) {
      const existing = await this.getDriverByNumber(data.driverNumber);
      if (existing && existing.id !== id) {
        throw new Error(`Driver Number #${data.driverNumber} is already taken.`);
      }
    }

    if (getDataBackendMode() === 'postgres') {
      assertPostgresConfigured();
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
    }

    const store = loadLocalStore();
    const idx = store.drivers.findIndex((d) => d.id === id);
    if (idx === -1) {
      throw new Error(`Driver with ID ${id} not found.`);
    }

    const d = store.drivers[idx];
    const updated: Driver = {
      ...d,
      driverName: data.driverName !== undefined ? data.driverName.trim() : d.driverName,
      status: data.status !== undefined ? data.status : d.status,
      driverNumber: data.driverNumber !== undefined ? data.driverNumber : d.driverNumber,
      updatedAt: new Date().toISOString(),
    };

    store.drivers[idx] = updated;
    saveLocalStore(store);

    return this.getDriverById(id) as Promise<Driver>;
  },

  async deleteDriver(id: string): Promise<{ success: boolean; mode: 'deleted' | 'deactivated'; message: string; driver: Driver }> {
    const driver = await this.getDriverById(id);
    if (!driver) {
      throw new Error(`Driver with ID ${id} not found.`);
    }

    if (getDataBackendMode() === 'postgres') {
      assertPostgresConfigured();
      const paymentCount = await prisma.payment.count({
        where: { driverId: id },
      });

      if (paymentCount > 0) {
        const deactivated = await this.updateDriver(id, { status: 'inactive' });
        return {
          success: true,
          mode: 'deactivated',
          message: `Driver #${driver.driverNumber} (${driver.driverName}) has ${paymentCount} financial transaction record(s) and was deactivated to preserve audit history.`,
          driver: deactivated,
        };
      }

      await prisma.driver.delete({
        where: { id },
      });

      return {
        success: true,
        mode: 'deleted',
        message: `Driver #${driver.driverNumber} (${driver.driverName}) has been permanently deleted.`,
        driver,
      };
    }

    const store = loadLocalStore();
    const paymentCount = store.payments.filter((p) => p.driverId === id).length;

    if (paymentCount > 0) {
      const deactivated = await this.updateDriver(id, { status: 'inactive' });
      return {
        success: true,
        mode: 'deactivated',
        message: `Driver #${driver.driverNumber} (${driver.driverName}) has ${paymentCount} financial transaction record(s) and was deactivated to preserve audit history.`,
        driver: deactivated,
      };
    }

    const idx = store.drivers.findIndex((d) => d.id === id);
    if (idx !== -1) {
      store.drivers.splice(idx, 1);
      saveLocalStore(store);
    }

    return {
      success: true,
      mode: 'deleted',
      message: `Driver #${driver.driverNumber} (${driver.driverName}) has been permanently deleted.`,
      driver,
    };
  },

  // -------------------------------------------------------------
  // PAYMENT OPERATIONS
  // -------------------------------------------------------------

  async getPayments(options: PaymentQueryOptions = {}): Promise<PaginatedResult<Payment>> {
    const { driverId, driverNumber, fromDate, toDate, status, page = 1, limit = 50 } = options;

    const startDate = parseStartDate(fromDate);
    const endDate = parseEndDate(toDate);

    if (getDataBackendMode() === 'postgres') {
      assertPostgresConfigured();

      const where: any = {};
      if (status) where.status = status;
      if (driverId) where.driverId = driverId;

      if (driverNumber) {
        where.driver = { driverNumber };
      }

      if (startDate || endDate) {
        where.paymentDate = {};
        if (startDate) where.paymentDate.gte = startDate;
        if (endDate) where.paymentDate.lte = endDate;
      }

      const total = await prisma.payment.count({ where });
      const list = await prisma.payment.findMany({
        where,
        include: { driver: true },
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });

      const mapped: Payment[] = list.map((p: any) => ({
        id: p.id,
        driverId: p.driverId,
        driverNumber: p.driver.driverNumber,
        driverName: p.driver.driverName,
        amount: Number(p.amount),
        paymentDate: p.paymentDate.toISOString(),
        status: p.status as any,
        notes: p.notes,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));

      return {
        data: mapped,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }

    const store = loadLocalStore();
    let payments = [...store.payments];

    if (status) {
      payments = payments.filter((p) => p.status === status);
    }
    if (driverId) {
      payments = payments.filter((p) => p.driverId === driverId);
    }
    if (driverNumber) {
      const driver = store.drivers.find((d) => d.driverNumber === driverNumber);
      payments = payments.filter((p) => p.driverId === driver?.id);
    }

    if (startDate) {
      payments = payments.filter((p) => new Date(p.paymentDate).getTime() >= startDate.getTime());
    }
    if (endDate) {
      payments = payments.filter((p) => new Date(p.paymentDate).getTime() <= endDate.getTime());
    }

    payments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

    const enriched = payments.map((p) => {
      const driver = store.drivers.find((d) => d.id === p.driverId);
      return {
        ...p,
        driverNumber: driver?.driverNumber,
        driverName: driver?.driverName,
      };
    });

    const total = enriched.length;
    const start = (page - 1) * limit;
    const paged = enriched.slice(start, start + limit);

    return {
      data: paged,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
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

    const driver = await this.getDriverByNumber(driverNumber);
    if (!driver) {
      throw new Error(`Driver #${driverNumber} does not exist in the system.`);
    }
    if (driver.status === 'inactive') {
      throw new Error(`Driver #${driverNumber} (${driver.driverName}) is currently inactive.`);
    }

    const cents = toCents(amount);
    if (cents <= 0) {
      throw new Error('Payment amount must be greater than $0.00.');
    }
    const cleanAmount = centsToDollars(cents);

    const recordDate = paymentDate ? new Date(paymentDate) : new Date();

    if (getDataBackendMode() === 'postgres') {
      assertPostgresConfigured();

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
      };
    }

    const store = loadLocalStore();
    const now = new Date().toISOString();
    const newPayment: Payment = {
      id: `pmt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      driverId: driver.id,
      driverNumber: driver.driverNumber,
      driverName: driver.driverName,
      amount: cleanAmount,
      paymentDate: recordDate.toISOString(),
      status: 'active',
      notes: notes || null,
      createdAt: now,
      updatedAt: now,
    };

    store.payments.push(newPayment);
    saveLocalStore(store);

    return newPayment;
  },

  async updatePayment(
    id: string,
    data: { amount?: number; paymentDate?: string; notes?: string }
  ): Promise<Payment> {
    if (data.amount !== undefined) {
      const cents = toCents(data.amount);
      if (cents <= 0) {
        throw new Error('Payment amount must be greater than $0.00.');
      }
    }

    if (getDataBackendMode() === 'postgres') {
      assertPostgresConfigured();

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
    }

    const store = loadLocalStore();
    const idx = store.payments.findIndex((p) => p.id === id);
    if (idx === -1) {
      throw new Error(`Payment ${id} not found.`);
    }

    const existing = store.payments[idx];
    const driver = store.drivers.find((d) => d.id === existing.driverId);
    const now = new Date().toISOString();

    let updatedAmount = existing.amount;
    let updatedNotes = existing.notes;

    if (data.amount !== undefined) {
      const cleanAmount = centsToDollars(toCents(data.amount));
      const auditNote = `[Amount updated from $${Number(existing.amount).toFixed(2)} to $${cleanAmount.toFixed(2)} on ${now}]`;
      updatedAmount = cleanAmount;
      updatedNotes = data.notes !== undefined
        ? `${data.notes} ${auditNote}`
        : existing.notes ? `${existing.notes} ${auditNote}` : auditNote;
    } else if (data.notes !== undefined) {
      updatedNotes = data.notes;
    }

    const updatedPayment: Payment = {
      ...existing,
      amount: updatedAmount,
      paymentDate: data.paymentDate ? new Date(data.paymentDate).toISOString() : existing.paymentDate,
      notes: updatedNotes,
      updatedAt: now,
      driverNumber: driver?.driverNumber,
      driverName: driver?.driverName,
    };

    store.payments[idx] = updatedPayment;
    saveLocalStore(store);

    return updatedPayment;
  },

  async voidPayment(id: string, reason?: string): Promise<Payment> {
    if (getDataBackendMode() === 'postgres') {
      assertPostgresConfigured();

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
    }

    const store = loadLocalStore();
    const idx = store.payments.findIndex((p) => p.id === id);
    if (idx === -1) {
      throw new Error(`Payment ${id} not found.`);
    }

    const existing = store.payments[idx];
    const driver = store.drivers.find((d) => d.id === existing.driverId);

    const voidedPayment: Payment = {
      ...existing,
      status: 'voided',
      notes: reason ? `VOIDED: ${reason}` : existing.notes,
      updatedAt: new Date().toISOString(),
      driverNumber: driver?.driverNumber,
      driverName: driver?.driverName,
    };

    store.payments[idx] = voidedPayment;
    saveLocalStore(store);

    return voidedPayment;
  },

  // -------------------------------------------------------------
  // DASHBOARD CALCULATIONS
  // -------------------------------------------------------------

  async getDashboardStats(fromDate?: string, toDate?: string): Promise<DashboardStats> {
    const startDate = parseStartDate(fromDate);
    const endDate = parseEndDate(toDate);

    if (getDataBackendMode() === 'postgres') {
      assertPostgresConfigured();

      const totalDrivers = await prisma.driver.count();
      const activeDrivers = await prisma.driver.count({ where: { status: 'active' } });

      const allActivePayments = await prisma.payment.findMany({
        where: { status: 'active' },
        select: { id: true, driverId: true, amount: true, paymentDate: true },
      });

      const todayPayments = allActivePayments.filter((p: any) => isToday(p.paymentDate.toISOString()));
      const paymentsTodayCount = todayPayments.length;
      const paymentsTodayCents = todayPayments.reduce((sum: number, p: any) => sum + toCents(Number(p.amount)), 0);

      const totalPaidCents = allActivePayments.reduce((sum: number, p: any) => sum + toCents(Number(p.amount)), 0);

      let periodPayments = allActivePayments;
      if (startDate) {
        periodPayments = periodPayments.filter((p: any) => new Date(p.paymentDate).getTime() >= startDate.getTime());
      }
      if (endDate) {
        periodPayments = periodPayments.filter((p: any) => new Date(p.paymentDate).getTime() <= endDate.getTime());
      }

      const periodPaidCents = periodPayments.reduce((sum: number, p: any) => sum + toCents(Number(p.amount)), 0);
      const uniqueDriversInPeriod = new Set(periodPayments.map((p: any) => p.driverId)).size;

      return {
        totalDrivers,
        activeDrivers,
        paymentsTodayCount,
        paymentsTodayAmount: centsToDollars(paymentsTodayCents),
        totalPaidAmount: centsToDollars(totalPaidCents),
        periodPaidAmount: centsToDollars(periodPaidCents),
        periodPaymentsCount: periodPayments.length,
        periodPaidDriversCount: uniqueDriversInPeriod,
      };
    }

    const store = loadLocalStore();
    const drivers = store.drivers;
    const activePayments = store.payments.filter((p: Payment) => p.status === 'active');

    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter((d: Driver) => d.status === 'active').length;

    const todayPayments = activePayments.filter((p: Payment) => isToday(p.paymentDate));
    const paymentsTodayCount = todayPayments.length;
    const paymentsTodayCents = todayPayments.reduce((sum: number, p: Payment) => sum + toCents(p.amount), 0);

    const totalPaidCents = activePayments.reduce((sum: number, p: Payment) => sum + toCents(p.amount), 0);

    let periodPayments = activePayments;
    if (startDate) {
      periodPayments = periodPayments.filter((p: Payment) => new Date(p.paymentDate).getTime() >= startDate.getTime());
    }
    if (endDate) {
      periodPayments = periodPayments.filter((p: Payment) => new Date(p.paymentDate).getTime() <= endDate.getTime());
    }

    const periodPaidCents = periodPayments.reduce((sum: number, p: Payment) => sum + toCents(p.amount), 0);
    const uniqueDriversInPeriod = new Set(periodPayments.map((p: Payment) => p.driverId)).size;

    return {
      totalDrivers,
      activeDrivers,
      paymentsTodayCount,
      paymentsTodayAmount: centsToDollars(paymentsTodayCents),
      totalPaidAmount: centsToDollars(totalPaidCents),
      periodPaidAmount: centsToDollars(periodPaidCents),
      periodPaymentsCount: periodPayments.length,
      periodPaidDriversCount: uniqueDriversInPeriod,
    };
  },
};
