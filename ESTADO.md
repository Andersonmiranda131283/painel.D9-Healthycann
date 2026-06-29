# Painel Healthycann — Estado do projeto

Atualizado em 28/06/2026.

## O que é

Painel de **faturamento/operação** da Healthycann, alimentado pela **D9Pro API**
(sistema de pedidos da D9). Recriado a partir do molde do `painel-omie`, mas
reorientado: a D9Pro é um sistema de **pedidos/CRM**, sem contabilidade, então o
painel mostra **faturamento, pedidos, ticket médio, status e produtos** — não
DRE/Balanço.

## O que já está pronto

- Servidor + front-end + build, rodando com **dados de exemplo** (`npm start`).
- **Conector real da D9Pro** (`erp/d9.js`): pedidos → faturamento, com
  agregação por mês/status/grupo. Auth por header `token`.
  - **Verificado** com os exemplos da spec OpenAPI (soma e agregações corretas).
- Endpoints `/api/operacao` e `/api/produtos`; provider mock para demonstração.
- `npm run testar-erp` valida URL base + token (`/user/me.php`).
- Catálogo de endpoints em `docs/d9pro-endpoints.md`.
- Login opcional por senha; `render.yaml` pronto.

## Implementado nesta rodada

- **Recebido × a receber** — KPIs e barras por status coloridas (recebido/–).
  Classificação por heurística do rótulo, ou pela lista `D9_STATUS_RECEBIDOS`.
- **Produtos com preço/custo/margem** — cruza cada produto com
  `/products/getRules.php` (preço "a partir de", menor entre as regras).
- **Aba Comissões** — lê o CSV de `/export/commission.php` (parser próprio,
  detecção heurística das colunas valor/operador), com total, por operador,
  tabela e export.

## O que falta (próximos passos)

1. **Token da D9Pro** — gerar e pôr no `.env` para ligar os dados reais. Sem
   ele, o painel fica nos dados de exemplo.
2. **Verificar contra dados reais** — confirmar os `oSId` de "pago/entregue"
   (setar `D9_STATUS_RECEBIDOS`) e as colunas reais do CSV de comissões.
3. Novas operações/abas que você quiser acrescentar.

## Decisões importantes

- **Foco em faturamento/operação** (decisão do projeto): só dados que a D9Pro
  fornece. Contabilidade (DRE/Balanço) não entra porque a API não tem.
- O painel **nunca fica em branco**: sem token, `/api/operacao` responde 503 e o
  front-end usa os dados de exemplo embutidos.
- Para outra fonte/integração, criar `erp/<nome>.js` com a interface
  `{ nome, configurado, operacao(), produtos() }` e registrar em `erp/index.js`.

## Variáveis de ambiente

`D9_API_URL`, `D9_API_TOKEN`, `ERP_PROVIDER` (mock|d9), `PAINEL_USUARIO`,
`PAINEL_SENHA`, `PORT`. Ver `.env.example`.
