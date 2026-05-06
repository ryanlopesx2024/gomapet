// Yampi webhook receiver — public endpoint
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-yampi-hmac-sha256",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: any, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    // Yampi payload: { event, resource: { id, status, value_total, customer, items, created_at, ... } }
    const event = body?.event || body?.type || "unknown";
    const r = body?.resource || body?.data || body;
    const orderId = String(r?.id ?? r?.order_id ?? r?.number ?? "");
    if (!orderId) return json({ ok: false, error: "missing order id", received: event }, 400);

    const status = r?.status?.alias || r?.status?.data?.alias || r?.status_alias || r?.status || null;
    const total = parseFloat(r?.value_total ?? r?.total ?? r?.amount ?? 0) || 0;
    const customer = r?.customer?.data || r?.customer || null;
    const items = r?.items?.data || r?.items || null;
    const orderedAt = r?.created_at || r?.date || null;

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error } = await sb
      .from("yampi_orders")
      .upsert(
        {
          order_id: orderId,
          status,
          event,
          total,
          customer,
          items,
          raw: body,
          ordered_at: orderedAt ? new Date(typeof orderedAt === "string" ? orderedAt.replace(" ", "T") : orderedAt).toISOString() : null,
        },
        { onConflict: "order_id" }
      );
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, order_id: orderId, event });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
