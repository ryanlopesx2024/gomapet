
-- Sales team members
CREATE TABLE public.sales_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  sales INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#29B347',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock items
CREATE TABLE public.stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 0,
  days_left INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

-- Open access (single-user dashboard, no auth)
CREATE POLICY "public read sales_team" ON public.sales_team FOR SELECT USING (true);
CREATE POLICY "public write sales_team" ON public.sales_team FOR INSERT WITH CHECK (true);
CREATE POLICY "public update sales_team" ON public.sales_team FOR UPDATE USING (true);
CREATE POLICY "public delete sales_team" ON public.sales_team FOR DELETE USING (true);

CREATE POLICY "public read stock_items" ON public.stock_items FOR SELECT USING (true);
CREATE POLICY "public write stock_items" ON public.stock_items FOR INSERT WITH CHECK (true);
CREATE POLICY "public update stock_items" ON public.stock_items FOR UPDATE USING (true);
CREATE POLICY "public delete stock_items" ON public.stock_items FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_team;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_items;
