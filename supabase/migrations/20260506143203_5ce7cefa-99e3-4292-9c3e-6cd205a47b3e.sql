
CREATE TABLE IF NOT EXISTS public.yampi_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  status TEXT,
  event TEXT,
  total NUMERIC,
  customer JSONB,
  items JSONB,
  raw JSONB,
  ordered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yampi_orders_status ON public.yampi_orders(status);
CREATE INDEX IF NOT EXISTS idx_yampi_orders_ordered_at ON public.yampi_orders(ordered_at DESC);

ALTER TABLE public.yampi_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read yampi orders"
  ON public.yampi_orders FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_yampi_orders_upd ON public.yampi_orders;
CREATE TRIGGER trg_yampi_orders_upd
BEFORE UPDATE ON public.yampi_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
