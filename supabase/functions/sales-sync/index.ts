// Yampi + Payt sales aggregator
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YAMPI_ALIAS = Deno.env.get("YAMPI_ALIAS") ?? "";
const YAMPI_TOKEN = Deno.env.get("YAMPI_USER_TOKEN") ?? "";
const YAMPI_SECRET = Deno.env.get("YAMPI_SECRET_KEY") ?? "";
const PAYT_KEY = Deno.env.get("PAYT_API_KEY") ?? "";

function orderDate(value: unknown): string {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "date" in value) {
    return String((value as { date?: unknown }).date ?? "").slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function isPaidStatus(status: unknown): boolean {
  const s = String(status ?? "").toLowerCase().trim();
  if (/not[_\s-]?paid|unpaid|waiting|pending|aguard|cancel|refund|refus|estorn|chargeback/.test(s)) return false;
  return /(^|[_\s-])(paid|approved|aprovad[oa]?|pago)($|[_\s-])/.test(s);
}

async function fetchYampi(since: string, until: string) {
  if (!YAMPI_ALIAS || !YAMPI_TOKEN || !YAMPI_SECRET) {
    return { ok: false, configured: false, orders: [], total: 0, count: 0 };
  }
  const headers = {
    "User-Token": YAMPI_TOKEN,
    "User-Secret-Key": YAMPI_SECRET,
    "Content-Type": "application/json",
  };
  const all: any[] = [];
  let page = 1;
  const limit = 50; // Yampi maxes at 50 per page
  const maxPages = 80; // até 4000 pedidos por chamada
  while (page <= maxPages) {
    const url = `https://api.dooki.com.br/v2/${YAMPI_ALIAS}/orders?include=items&date_min=${since}&date_max=${until}&limit=${limit}&page=${page}`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`Yampi ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const data = j.data || [];
    all.push(...data);
    // Continue while page is full; stop when last page returns fewer than `limit`
    if (data.length < limit) break;
    page++;
  }
  const orders = all.map((o: any) => ({
    id: o.id,
    total: parseFloat(o.value_total || 0),
    status: o.status?.data?.alias || o.status_alias || "",
    created: o.created_at,
    items: (o.items?.data || []).map((it: any) => ({
      name: it.item_title || it.sku_title || it.title || it.name || `SKU ${it.sku_id || ""}`,
      qty: it.quantity ?? it.qty ?? 1,
      price: parseFloat(it.price || it.unit_price || 0),
    })),
  })).filter((o: any) => {
    const dt = orderDate(o.created);
    return !dt || (dt >= since && dt <= until);
  });
  const total = orders.filter((o: any) => isPaidStatus(o.status)).reduce((a: number, o: any) => a + o.total, 0);
  return { ok: true, configured: true, orders, total, count: orders.length };
}

async function fetchPayt(since: string, until: string) {
  if (!PAYT_KEY) {
    return { ok: false, configured: false, orders: [], total: 0, count: 0 };
  }
  // Endpoint placeholder — ajustar conforme docs Payt assim que credencial chegar
  const url = `https://api.payt.com.br/v1/orders?from=${since}&to=${until}&limit=200`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${PAYT_KEY}`, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`Payt ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const orders = (j.data || j.orders || []).map((o: any) => ({
    id: o.id,
    total: parseFloat(o.amount || o.total || 0),
    status: o.status,
    created: o.created_at || o.date,
  }));
  const total = orders.reduce((a: number, o: any) => a + o.total, 0);
  return { ok: true, configured: true, orders, total, count: orders.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: any, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const url = new URL(req.url);
    const today = new Date().toISOString().slice(0, 10);
    const d30 = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const since = url.searchParams.get("since") || d30;
    const until = url.searchParams.get("until") || today;
    const src = url.searchParams.get("source"); // yampi | payt | (all)

    const out: any = { ok: true, since, until };
    if (!src || src === "yampi") out.yampi = await fetchYampi(since, until).catch(e => ({ ok: false, error: String(e) }));
    if (!src || src === "payt") out.payt = await fetchPayt(since, until).catch(e => ({ ok: false, error: String(e) }));
    out.combined = {
      total: (out.yampi?.total || 0) + (out.payt?.total || 0),
      count: (out.yampi?.count || 0) + (out.payt?.count || 0),
    };
    return json(out);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
