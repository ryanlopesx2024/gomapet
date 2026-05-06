// GomaPet Meta Ads proxy — port of server.py
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOKEN = Deno.env.get("META_TOKEN") ?? "";
const DEFAULT_ACCOUNT = "act_577944235396417";
const API_VER = "v19.0";
const BASE = `https://graph.facebook.com/${API_VER}`;
const CACHE = new Map<string, { t: number; data: any }>();
const TTL = 60 * 1000;

const PURCHASE_TYPES = new Set([
  "purchase","omni_purchase","offsite_conversion.fb_pixel_purchase",
  "web_in_store_purchase","onsite_web_purchase",
]);

async function metaGet(path: string, params: Record<string,string|number> = {}) {
  const p = new URLSearchParams({ access_token: TOKEN, ...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)])) });
  const url = `${BASE}/${path}?${p}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Meta API ${r.status}: ${await r.text()}`);
  return await r.json();
}

function cleanName(name: string) {
  let n = name;
  n = n.replace(/\[\d{2}\/\d{2}\/\d{4}\]\s*/g, "");
  n = n.replace(/\s*-\s*\d{2}\/\d{2}\/\d{2,4}/g, "");
  n = n.replace(/\s*[-—–]\s*Athenis.*/g, "");
  n = n.replace(/Avant\s*-\s*\[CAMPANHA\s*\d+\]/g, "Avant");
  n = n.replace(/\[CTV[\w\s,]+\]/g, "");
  n = n.replace(/\[CHIP\s+(\d+)\]/g, "#$1");
  n = n.replace(/\[(\d+)\]/g, "#$1");
  n = n.replace(/\[([A-Z][A-Z0-9\s]+)\]/g, "$1");
  n = n.replace(/\s+/g, " ").trim();
  return n.length > 30 ? n.slice(0, 30) : n;
}

function findAction(arr: any[], types: Set<string>) {
  for (const it of arr || []) if (types.has(it.action_type)) return parseFloat(it.value || 0);
  return 0;
}

function segmentCamp(name: string) {
  const nl = (name||"").toLowerCase();
  if (["avant","bafisco","upsell","cross","kit","premium"].some(k=>nl.includes(k))) return "upsell";
  if (["semelhante","lookalike","lal","similar"].some(k=>nl.includes(k))) return "lookalike";
  if (["retarget","remarket","recompra","fideliz","cliente"].some(k=>nl.includes(k))) return "retargeting";
  return "prospecting";
}

function segAgg(list: any[]) {
  const spend = list.reduce((a,c)=>a+parseFloat(c.spend||0),0);
  const rev = list.reduce((a,c)=>a+findAction(c.action_values, new Set(["omni_purchase","onsite_web_app_purchase","purchase"])),0);
  const conv = list.reduce((a,c)=>a+findAction(c.actions, PURCHASE_TYPES),0);
  const msgs = list.reduce((a,c)=>a+findAction(c.actions, new Set(["onsite_conversion.total_messaging_connection"])),0);
  return {
    spend: +spend.toFixed(2), rev: +rev.toFixed(2),
    conv: Math.floor(conv), msgs: Math.floor(msgs),
    roas: spend ? +(rev/spend).toFixed(2) : 0,
    cpa: conv ? +(spend/conv).toFixed(2) : 0,
    ticket: conv ? +(rev/conv).toFixed(2) : 0,
    count: list.length,
  };
}

async function buildPayload(accountId: string) {
  const act = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const _today = new Date();
  const _since30 = new Date(_today.getTime() - 29*86400000);
  const _fmt = (d: Date) => d.toISOString().slice(0,10);
  const TIME_RANGE = JSON.stringify({ since: _fmt(_since30), until: _fmt(_today) });
  const acct = await metaGet(act, { fields: "id,name,currency,timezone_name" });
  const acctIns = (await metaGet(`${act}/insights`, {
    time_range: TIME_RANGE, level: "account",
    fields: "spend,impressions,clicks,ctr,cpc,actions,action_values,purchase_roas",
  })).data[0];

  const av = (k: string) => findAction(acctIns.actions, new Set([k]));
  const totalSpend = parseFloat(acctIns.spend);
  const totalImpressions = parseInt(acctIns.impressions);
  const totalClicks = parseInt(acctIns.clicks);
  const totalCtr = parseFloat(acctIns.ctr);
  const totalPurchases = av("purchase");
  const totalRev = findAction(acctIns.action_values, new Set(["omni_purchase","onsite_web_app_purchase","onsite_web_purchase"]));

  const linkClicks = av("link_click");
  const msgConn = av("onsite_conversion.total_messaging_connection");
  const msgStarted = av("onsite_conversion.messaging_conversation_started_7d");
  const firstReply = av("onsite_conversion.messaging_first_reply");
  const d2 = av("onsite_conversion.messaging_user_depth_2_message_send");
  const d3 = av("onsite_conversion.messaging_user_depth_3_message_send");
  const initCheckout = av("initiate_checkout") || av("omni_initiated_checkout");
  const addPay = av("add_payment_info");

  const whatsapp_funnel = [
    { l: "Clique no anúncio (Link Click)", n: Math.floor(linkClicks) },
    { l: "Iniciou conversa no WhatsApp", n: Math.floor(msgConn) },
    { l: "Conversa iniciada (7d)", n: Math.floor(msgStarted) },
    { l: "Lead respondeu (1ª resposta)", n: Math.floor(firstReply) },
    { l: "Engajamento médio (2+ msgs)", n: Math.floor(d2) },
    { l: "Engajamento alto (3+ msgs)", n: Math.floor(d3) },
    { l: "Iniciou checkout", n: Math.floor(initCheckout) },
    { l: "Adicionou pagamento", n: Math.floor(addPay) },
    { l: "Compra finalizada", n: Math.floor(totalPurchases) },
  ];

  const campsRaw = (await metaGet(`${act}/insights`, {
    time_range: TIME_RANGE, level: "campaign",
    fields: "campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,actions,action_values,purchase_roas",
    limit: 30,
  })).data;

  const campaigns = campsRaw.map((c: any) => {
    const spend = parseFloat(c.spend||0);
    const conv = findAction(c.actions, PURCHASE_TYPES);
    const rev = findAction(c.action_values, new Set(["omni_purchase","onsite_web_app_purchase","purchase"]));
    const roasArr = c.purchase_roas || [];
    const roas = roasArr.length ? parseFloat(roasArr[0].value) : (spend ? rev/spend : 0);
    const ctr = parseFloat(c.ctr||0);
    const msgs = findAction(c.actions, new Set(["onsite_conversion.total_messaging_connection"]));
    return {
      id: c.campaign_id,
      n: cleanName(c.campaign_name||"Campanha"),
      inv: +spend.toFixed(2), rev: +rev.toFixed(2),
      roas: +roas.toFixed(2), cpa: conv ? +(spend/conv).toFixed(2) : 0,
      ctr: +ctr.toFixed(2), conv: Math.floor(conv), msgs: Math.floor(msgs),
    };
  }).sort((a:any,b:any)=>b.rev-a.rev);

  const segBuckets: Record<string, any[]> = { upsell:[], lookalike:[], retargeting:[], prospecting:[] };
  for (const c of campsRaw) segBuckets[segmentCamp(c.campaign_name||"")].push(c);
  const segments = Object.fromEntries(Object.entries(segBuckets).map(([k,v])=>[k,segAgg(v)]));

  for (const camp of campaigns) {
    const raw = campsRaw.find((c:any)=>c.campaign_id===camp.id) || {};
    (camp as any).seg = segmentCamp(raw.campaign_name||"");
  }

  const dailyRaw = (await metaGet(`${act}/insights`, {
    time_range: TIME_RANGE,
    level: "account", time_increment: 1,
    fields: "date_start,spend,actions,action_values", limit: 31,
  })).data;

  const daily = dailyRaw.sort((a:any,b:any)=>(a.date_start||"").localeCompare(b.date_start||""))
    .map((d:any)=>({
      date: d.date_start.slice(5),
      spend: +parseFloat(d.spend||0).toFixed(2),
      rev: +findAction(d.action_values, new Set(["omni_purchase","onsite_web_app_purchase","onsite_web_purchase"])).toFixed(2),
      pur: Math.floor(findAction(d.actions, PURCHASE_TYPES)),
      msgs: Math.floor(findAction(d.actions, new Set(["onsite_conversion.total_messaging_connection"]))),
    }));

  const roasOverall = totalSpend ? +(totalRev/totalSpend).toFixed(2) : 0;
  const cpaOverall = totalPurchases ? +(totalSpend/totalPurchases).toFixed(2) : 0;
  const avgCtr = campaigns.length ? +(campaigns.reduce((a:number,c:any)=>a+c.ctr,0)/campaigns.length).toFixed(2) : 0;
  const avgTicket = totalPurchases ? +(totalRev/totalPurchases).toFixed(2) : 0;
  const cpl = msgConn ? +(totalSpend/msgConn).toFixed(2) : 0;
  const leadConvRate = msgConn ? +(totalPurchases/msgConn*100).toFixed(2) : 0;
  const recontactPool = Math.floor(msgConn) - Math.floor(totalPurchases);
  const purDays = daily.map((d:any)=>d.pur);
  const avgPurDay = purDays.length ? +(purDays.reduce((a:number,b:number)=>a+b,0)/purDays.length).toFixed(1) : 0;

  return {
    ok: true,
    account: { id: acct.id, name: acct.name, currency: acct.currency, bm: "Gomapet Bm Americana" },
    summary: {
      spend: +totalSpend.toFixed(2), rev: +totalRev.toFixed(2),
      conv: Math.floor(totalPurchases), roas: roasOverall, cpa: cpaOverall,
      ctr: +totalCtr.toFixed(2), impressions: totalImpressions, clicks: totalClicks,
      avg_ctr: avgCtr, avg_ticket: avgTicket, cpl, lead_conv_rate: leadConvRate,
      recontact_pool: recontactPool, total_msgs: Math.floor(msgConn), avg_pur_day: avgPurDay,
    },
    campaigns: campaigns.slice(0,10),
    segments, daily, whatsapp_funnel,
    fetched_at: Math.floor(Date.now()/1000),
  };
}

function normalizeAccountId(raw: string): string | null {
  const s = (raw||"").trim();
  if (!s) return null;
  const withPrefix = s.startsWith("act_") ? s : `act_${s.replace(/\D/g,"")}`;
  return /^act_\d{6,}$/.test(withPrefix) ? withPrefix : null;
}

const REQUIRED_SCOPES = ["ads_read","read_insights"];

async function validateAccount(accountId: string): Promise<{ok:true;account:any;permissions:string[];missing:string[]}|{ok:false;error:string;status:number;permissions?:string[];missing?:string[]}> {
  let permissions: string[] = [];
  let missing: string[] = [];
  try {
    const perms = await metaGet("me/permissions", {});
    permissions = (perms.data||[]).filter((p:any)=>p.status==="granted").map((p:any)=>p.permission);
    missing = REQUIRED_SCOPES.filter(s=>!permissions.includes(s));
    if (missing.length) {
      return { ok:false, status:403, permissions, missing,
        error:`Token sem escopos necessários: ${missing.join(", ")}. Conceda em developers.facebook.com → Graph API Explorer.` };
    }
  } catch (e) {
    return { ok:false, status:401, error:`Token inválido ou expirado: ${e instanceof Error ? e.message : String(e)}` };
  }
  try {
    const acct = await metaGet(accountId, { fields: "id,name,currency,timezone_name,account_status,business" });
    if (!acct?.id) return { ok:false, error:"Conta não encontrada", status:404, permissions, missing };
    if (acct.account_status && acct.account_status !== 1) {
      return { ok:false, status:403, permissions, missing,
        error:`Conta inativa (status ${acct.account_status})` };
    }
    return { ok:true, account: acct, permissions, missing };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("400") || msg.includes("404")) return { ok:false, status:400, permissions, missing, error:`Ad Account ID inválido ou sem acesso do token: ${accountId}` };
    if (msg.includes("403") || msg.includes("(#200)") || msg.includes("(#10)")) return { ok:false, status:403, permissions, missing, error:`Token não tem acesso à conta ${accountId}. Verifique se o usuário do token foi adicionado à BM com permissão de leitura.` };
    return { ok:false, status:502, permissions, missing, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body:any, status=200) => new Response(JSON.stringify(body), { status, headers:{...corsHeaders,"Content-Type":"application/json"} });
  if (!TOKEN) return json({ ok:false, error:"META_TOKEN not configured" }, 500);
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action"); // "validate" | null
    const rawId = url.searchParams.get("account_id") || DEFAULT_ACCOUNT;
    const accountId = normalizeAccountId(rawId);
    if (!accountId) return json({ ok:false, error:`Formato inválido. Use act_XXXXXXXXXX (recebido: "${rawId}")` }, 400);

    if (action === "validate") {
      const v = await validateAccount(accountId);
      if (!v.ok) return json({ ok:false, error:v.error, account_id:accountId, permissions:v.permissions, missing:v.missing }, v.status);
      return json({ ok:true, account_id:accountId, account:v.account, permissions:v.permissions });
    }

    const force = url.searchParams.has("force");
    const key = `meta_${accountId}`;
    if (force) CACHE.delete(key);
    const cached = CACHE.get(key);
    if (cached && Date.now()-cached.t < TTL) return json(cached.data);

    // valida antes de montar payload completo
    const v = await validateAccount(accountId);
    if (!v.ok) return json({ ok:false, error:v.error, account_id:accountId }, v.status);

    const data = await buildPayload(accountId);
    CACHE.set(key, { t: Date.now(), data });
    return json(data);
  } catch (e) {
    return json({ ok:false, error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
