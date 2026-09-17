-- NationLinks Dispatch - Driver Payment Management System
-- Supabase PostgreSQL Schema Definition

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. DRIVERS TABLE
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_number INTEGER NOT NULL UNIQUE,
    driver_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drivers_driver_number ON public.drivers(driver_number ASC);
CREATE INDEX IF NOT EXISTS idx_drivers_name ON public.drivers(driver_name);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(status);

-- 2. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_driver_id ON public.payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_drivers_updated_at ON public.drivers;
CREATE TRIGGER trigger_drivers_updated_at
    BEFORE UPDATE ON public.drivers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_payments_updated_at ON public.payments;
CREATE TRIGGER trigger_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Comment annotations
COMMENT ON TABLE public.drivers IS 'NationLinks Dispatch registered drivers';
COMMENT ON TABLE public.payments IS 'NationLinks Dispatch financial transactions with void support';
