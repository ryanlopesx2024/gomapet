Plano de correção

1. Corrigir o filtro de período para usar vendas reais
- Hoje, o filtro global está usando a série do Meta Ads e multiplicadores, por isso “Compras” vem do Meta e aparece errado.
- Vou fazer o filtro “Hoje / 7 dias / 30 dias” chamar `sales-sync` com `since` e `until` corretos e usar Yampi + Payt como fonte principal de compras, faturamento e ticket.
- O KPI “Compras” passará a usar `paidCount` da Yampi + pedidos pagos da Payt, não `summary.conv` do Meta.

2. Corrigir a data da Yampi para bater com o dia do Brasil
- Ajustar o backend para trabalhar com a data da Yampi em `America/Sao_Paulo`, evitando erro por UTC que corta pedidos do começo/fim do dia.
- Também vou ampliar a busca quando o período for “hoje” para não perder pedidos por diferença de timezone e depois filtrar corretamente no backend.

3. Melhorar status pago da Yampi
- Revisar a função que identifica pedidos pagos para aceitar todos os status equivalentes usados pela Yampi.
- Manter pendentes/cancelados fora do total pago.

4. Corrigir cards de Produto Principal / Upsell / OrderBump
- Hoje esses cards usam `summary.byBrand` de 30 dias e ignoram o filtro global.
- Vou recalcular essas métricas a partir dos pedidos filtrados do período atual.
- “Upsell Bafisco”, “OrderBump/Frete Expresso” e ranking de kits passarão a respeitar o filtro de hoje/7/30 dias.

5. Corrigir a aba Yampi
- Ao escolher “Hoje”, a aba Yampi já chama a função com datas, mas está dependendo dos pedidos retornados completos.
- Vou garantir que os KPIs, ranking, gráficos e últimos pedidos usem a mesma base filtrada e deduplicada.
- O chip “Yampi LIVE” mostrará a contagem real de pedidos pagos do período selecionado.

6. Integrar Payt junto nas vendas
- Ajustar o carregamento de vendas para somar Payt corretamente sem duplicar Yampi.
- Se a Payt não estiver configurada, mostrar apenas Yampi sem quebrar os cálculos.

7. Separar WhatsApp / Direto de forma mais confiável
- A classificação atual só procura `whats`, `wpp`, `whatsapp` no nome do item; por isso pode zerar.
- Vou expandir a classificação para considerar campos de oferta, tracking, tags, cupom, utm/source e demais metadados disponíveis no pedido.
- Se a Yampi não trouxer o identificador explícito da oferta, deixo a lógica preparada com uma lista editável de termos de oferta WhatsApp para refinar rápido.

8. Validar com dados reais
- Testar `sales-sync` para hoje e conferir `paidCount`, total e lista de status.
- Conferir no frontend se filtro “Hoje” mostra compras vindas de Yampi/Payt e se Upsell/OrderBump acompanham o filtro.