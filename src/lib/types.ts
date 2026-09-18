export type DriverStatus = 'active' | 'inactive';
export type PaymentStatus = 'active' | 'voided';

export interface Driver {
  id: string;
  driverNumber: number;
  driverName: string;
  status: DriverStatus;
  createdAt: string;
  updatedAt: string;
  // Computed aggregations
  totalPaid?: number;
  lastPaymentDate?: string | null;
  paymentCount?: number;
}

export interface Payment {
  id: string;
  driverId: string;
  driverNumber?: number;
  driverName?: string;
  amount: number;
  paymentDate: string;
  status: PaymentStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  // True when this payment registered a previously unknown driver number.
  driverCreated?: boolean;
}

export interface DashboardStats {
  totalDrivers: number;
  activeDrivers: number;
  paymentsTodayCount: number;
  paymentsTodayAmount: number;
  totalPaidAmount: number;
  periodPaidAmount: number;
  periodPaymentsCount: number;
  periodPaidDriversCount: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DriverQueryOptions {
  search?: string;
  sortBy?: 'driverNumber' | 'driverName' | 'totalPaid' | 'lastPaymentDate';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  status?: DriverStatus;
  fromDate?: string;
  toDate?: string;
}

export interface PaymentQueryOptions {
  driverId?: string;
  driverNumber?: number;
  fromDate?: string;
  toDate?: string;
  status?: PaymentStatus;
  page?: number;
  limit?: number;
}
