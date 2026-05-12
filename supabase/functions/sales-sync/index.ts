// Yampi + Payt sales aggregator
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YAMPI_ALIAS = Deno.env.get("YAMPI_ALIAS") ?? "";
const YAMPI_TOKEN = Deno.env.get("YAMPI_USER_TOKEN") ?? "";
const YAMPI_SECRET = Deno.env.get("YAMPI_SECRET_KEY") ?? "";
const PAYT_KEY = Deno.env.get("PAYT_API_KEY") ?? "";
const YAMPI_CACHE = new Map<string, { expires: number; data: any }>();
const YAMPI_INFLIGHT = new Map<string, Promise<any>>();

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

function classifyBrand(name: string): "gomapet" | "bafisco" | "outro" {
  const n = (name || "").toLowerCase();
  if (/bafisco/.test(n)) return "bafisco";
  if (/gomapet|goma\s*pet|escova/.test(n)) return "gomapet";
  return "outro";
}

function classifyChannel(name: string): "whatsapp" | "direto" {
  const n = (name || "").toLowerCase();
  if (/whats|wpp|whatsapp/.test(n)) return "whatsapp";
  return "direto";
}

function isOrderBump(name: string): boolean {
  const n = (name || "").toLowerCase();
  return /frete\s*expresso|order\s*bump|orderbump|bump/.test(n);
}

async function fetchYampi(since: string, until: string, summaryOnly = false) {
  if (!YAMPI_ALIAS || !YAMPI_TOKEN || !YAMPI_SECRET) {
    return { ok: false, configured: false, orders: [], total: 0, count: 0 };
  }
  const cacheKey = `yampi:${since}:${until}:${summaryOnly ? "summary" : "full"}`;
  const cached = YAMPI_CACHE.get(cacheKey);
  if (cached && cached.expires > Date.now()) return { ...cached.data, cached: true };
  const inflight = YAMPI_INFLIGHT.get(cacheKey);
  if (inflight) return await inflight;

  const request = (async () => {
  const headers = {
    "User-Token": YAMPI_TOKEN,
    "User-Secret-Key": YAMPI_SECRET,
    "Content-Type": "application/json",
  };
  const all: any[] = [];
  const limit = 100;
  const maxPages = 40;
  const concurrency = 6;
  const fetchPage = async (page: number) => {
    const params = new URLSearchParams({
      include: "items.sku.product,status",
      date: `created_at:${since}|${until}`,
      limit: String(limit),
      page: String(page),
    });
    const url = `https://api.dooki.com.br/v2/${YAMPI_ALIAS}/orders?${params.toString()}`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`Yampi ${r.status}: ${await r.text()}`);
    const j = await r.json();
    return j.data || [];
  };

  let page = 1;
  while (page <= maxPages) {
    const pages = Array.from({ length: Math.min(concurrency, maxPages - page + 1) }, (_, i) => page + i);
    const batch = await Promise.all(pages.map(fetchPage));
    let stop = false;
    for (const data of batch) {
      all.push(...data);
      if (data.length < limit) stop = true;
    }
    if (stop) break;
    page += pages.length;
  }
  const orders = all.map((o: any) => {
    const items = (o.items?.data || []).map((it: any) => {
      const prodName = it.sku?.data?.product?.data?.name || it.sku?.data?.title;
      const name = prodName || it.item_title || it.sku_title || it.title || it.name || `SKU ${it.sku_id || ""}`;
      return {
        name,
        qty: it.quantity ?? it.qty ?? 1,
        price: parseFloat(it.price || it.unit_price || 0),
        brand: classifyBrand(name),
        channel: classifyChannel(name),
        bump: isOrderBump(name),
      };
    });
    // canal do pedido = qualquer item whatsapp → whatsapp; senão direto
    const channel = items.some((it: any) => it.channel === "whatsapp") ? "whatsapp" : "direto";
    return {
      id: o.id,
      total: parseFloat(o.value_total || 0),
      status: o.status?.data?.alias || o.status_alias || "",
      created: o.created_at,
      channel,
      items,
    };
  }).filter((o: any) => {
    const dt = orderDate(o.created);
    return !dt || (dt >= since && dt <= until);
  });
  const paidOrders = orders.filter((o: any) => isPaidStatus(o.status));
  const total = paidOrders.reduce((a: number, o: any) => a + o.total, 0);

  const byName: Record<string, { n: string; conv: number; rev: number; brand: string; channel: string }> = {};
  const byBrand: Record<string, { rev: number; conv: number }> = { gomapet: { rev: 0, conv: 0 }, bafisco: { rev: 0, conv: 0 }, outro: { rev: 0, conv: 0 } };
  const byChannel: Record<string, { rev: number; conv: number; orders: number }> = { whatsapp: { rev: 0, conv: 0, orders: 0 }, direto: { rev: 0, conv: 0, orders: 0 } };
  const orderBump = { rev: 0, conv: 0 };

  paidOrders.forEach((o: any) => {
    byChannel[o.channel].orders += 1;
    byChannel[o.channel].rev += o.total;
    (o.items || []).forEach((it: any) => {
      const n = String(it.name || "Sem nome").trim();
      const lineRev = (it.price || 0) * (it.qty || 1);
      const qty = it.qty || 1;
      if (!byName[n]) byName[n] = { n, conv: 0, rev: 0, brand: it.brand, channel: it.channel };
      byName[n].conv += qty;
      byName[n].rev += lineRev;
      if (it.bump) {
        orderBump.rev += lineRev;
        orderBump.conv += qty;
      } else {
        byBrand[it.brand].rev += lineRev;
        byBrand[it.brand].conv += qty;
      }
      byChannel[it.channel].conv += qty;
    });
  });

  const data = {
    ok: true,
    configured: true,
    orders: summaryOnly ? [] : orders,
    total,
    count: orders.length,
    paidCount: paidOrders.length,
    summary: {
      byName: Object.values(byName).sort((a, b) => b.conv - a.conv),
      byBrand,
      byChannel,
      orderBump,
    },
    cached: false,
  };
  YAMPI_CACHE.set(cacheKey, { expires: Date.now() + 55_000, data });
  return data;
  })();
  YAMPI_INFLIGHT.set(cacheKey, request);
  try {
    return await request;
  } finally {
    YAMPI_INFLIGHT.delete(cacheKey);
  }
}

async function fetchPayt(since: string, until: string) {
  if (!PAYT_KEY) {
    return { ok: false, configured: false, orders: [], total: 0, count: 0 };
  }
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
    const src = url.searchParams.get("source");
    const summaryOnly = url.searchParams.get("summary") === "1";

    const out: any = { ok: true, since, until };
    if (!src || src === "yampi") out.yampi = await fetchYampi(since, until, summaryOnly).catch(e => ({ ok: false, error: String(e) }));
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
