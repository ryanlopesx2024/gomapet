# Plano de implementação (itens 6 a 12)

## 6. Yampi separando Gomapet vs Bafisco
- No backend (`sales-sync`), classificar cada item de pedido em `brand` (`gomapet` | `bafisco` | `outro`) usando regex no nome do produto.
- Retornar `summary.byBrand` com totais (rev, conv, ticket) por marca + manter `byName`.
- No frontend, adicionar filtro de marca (chips: Todos / Gomapet / Bafisco) acima do KPI de Yampi e nas listagens; recalcular KPIs conforme filtro.

## 7. Investimento em tráfego com conversão BRL
- Buscar cotação USD→BRL 1× por carregamento via `https://economia.awesomeapi.com.br/json/last/USD-BRL` (sem chave).
- Logo abaixo do valor de "Investimento" exibir linha pequena: `≈ R$ X,XX (USD 1 = R$ Y,YY)`.
- A conversão só aparece se a moeda da conta for USD; se já for BRL, mostrar apenas a cotação do dia como referência.

## 10. Yampi: separar oferta WhatsApp vs Direto
- Heurística por nome do item / tag do pedido: ofertas com `whats`, `wpp`, `whatsapp` no título → canal `whatsapp`; demais → `direto`.
- Adicionar abas "Direto" e "WhatsApp" nos cards de Yampi; KPIs e ranking calculados por canal escolhido.

## 9. Faturamento do orderbump (frete expresso)
- No `sales-sync`, identificar items cujo nome contém `frete expresso` / `order ?bump` e somá-los em `summary.orderBump = { rev, conv }`.
- Subtrair esses itens dos totais de produto principal/upsell para não duplicar.
- No frontend (aba Vendas), novo card "Faturamento OrderBump (Frete Expresso)" abaixo de upsell.

## 8. Alerta de campanha com CPA alto
- Em `meta-ads`, calcular `cpaMedio = totalSpend / totalPurchases`.
- Marcar campanhas com `cpa > 1.8 × cpaMedio` (e `spend ≥ R$30`) com flag `alert: true`.
- No frontend, badge vermelho "⚠ CPA alto" no card da campanha + linha de aviso no topo da seção tráfego listando até 3 piores.

## 11. Tráfego por criativo (ad)
- Em `meta-ads`, novo fetch `${act}/insights?level=ad` com fields `ad_id, ad_name, spend, actions, action_values, ctr`.
- Para cada ad, buscar `permalink_url` via `${ad_id}?fields=preview_shareable_link,creative{thumbnail_url,object_story_spec}` (best-effort, fallback null).
- Retornar `ads: [{id, name, inv, rev, conv, roas, ctr, link}]` (top 15 por receita).
- Na UI tráfego, nova lista "Criativos" com mesmas colunas das campanhas + botão "Abrir" no link.

## 12. Remoções na UI de tráfego
- Excluir os blocos: "Investimento vs Receita", "Radar de Performance" e "CTR x CPA" da seção tráfego (canvas + cards e código de inicialização dos charts `ctrCpa`, `radar`, `invReceita`).

## Detalhes técnicos
- Arquivos: `index.html`, `supabase/functions/sales-sync/index.ts`, `supabase/functions/meta-ads/index.ts`.
- Sem migrations / sem novos secrets.
- Mantém auto-refresh de 60s, cache de 55s do Yampi e cache de 60s do Meta.
- Validação: deploy das edge functions + curl rápido para conferir novos campos antes de fechar.
