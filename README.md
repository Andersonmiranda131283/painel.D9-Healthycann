# Painel de Faturamento — Healthycann

Painel de **faturamento e operação** da **Healthycann**: um único servidor
Node.js que **serve o painel** e a **API de dados** no mesmo lugar, alimentado
pela **D9Pro API** (sistema de pedidos da D9). Você roda um comando, abre o
navegador e vê o painel — com dados de exemplo até configurar o token, e com
dados reais depois disso.

> A D9Pro é um sistema de **pedidos / operação** (não de contabilidade). Por
> isso o painel é de **faturamento** (receita, pedidos, ticket, status,
> produtos), e não de DRE/Balanço. Ver `docs/d9pro-endpoints.md`.

## Pré-requisitos

- Node.js **20.12 ou superior**

## Como rodar

```bash
npm install
npm start          # faz o build do painel e inicia o servidor
```

Abra **http://localhost:3001**. O painel já aparece com **dados de exemplo**.

### Ver "ao vivo" com dados de exemplo (mock)

```bash
ERP_PROVIDER=mock npm start
```

### Conectar a D9Pro real

1. Copie `.env.example` para `.env` e preencha:
   ```
   D9_API_URL=https://healthycann.d9pro.com/api
   D9_API_TOKEN=<seu token da D9Pro>
   ```
2. Valide o acesso: `npm run testar-erp` (bate em `/user/me.php`).
3. `npm start` — com o token válido, o painel mostra os dados reais.

## Abas do painel

- **Visão geral** — faturamento, **recebido × a receber**, nº de pedidos,
  ticket médio; faturamento por mês (gráfico); por status (recebido/a receber)
  e por grupo.
- **Pedidos** — tabela de pedidos do período, filtro por status e export CSV.
- **Produtos** — catálogo com **preço/custo/margem** (regras de preço da D9Pro).
- **Comissões** — total e por operador, a partir do CSV `/export/commission.php`.

## Arquitetura

| Arquivo | Papel |
| --- | --- |
| `d9-conector.js` | Servidor Express: serve o painel e a API (`/api/operacao`, `/api/produtos`). Login opcional. |
| `painel-faturamento.jsx` | Painel React (empacotado por esbuild → `public/app.js`). |
| `build.js` | Build do front-end (esbuild). |
| `erp/contrato.js` | Formato dos dados + agregação de pedidos (`agregarPedidos`). |
| `erp/d9.js` | Conector da D9Pro (pedidos → faturamento). |
| `erp/mock.js` | Provider de exemplo. |
| `erp/index.js` | Escolhe o provider (`ERP_PROVIDER` ou detecção automática). |
| `docs/d9pro-endpoints.md` | Catálogo dos endpoints da D9Pro API. |

### Fluxo dos dados

```
painel-faturamento.jsx  →  GET /api/operacao  →  d9-conector.js  →  provider (mock | d9)
                                                                       └─ d9: /orders/list.php + /orders/status.php
```

Sem token configurado, `/api/operacao` responde 503 e o painel usa os dados de
exemplo embutidos — a tela nunca fica em branco.

## Variáveis de ambiente

Ver `.env.example`:

- `D9_API_URL`, `D9_API_TOKEN` — credenciais da D9Pro (auth via header `token`).
- `ERP_PROVIDER` — `mock` (exemplo) ou `d9` (real). Em branco: D9 se configurado.
- `PAINEL_USUARIO`, `PAINEL_SENHA` — protegem o painel com login (defina os dois).
- `PORT` — porta (padrão 3001).

## Deploy

`render.yaml` pronto para o [Render](https://render.com) (build
`npm install && npm run build`, start `node d9-conector.js`).
