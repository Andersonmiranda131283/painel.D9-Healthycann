# Painel Financeiro — Healthycann

Painel financeiro da **Healthycann**: um único servidor Node.js que **serve o
painel** e a **API de dados** no mesmo lugar. Você roda um comando, abre o
navegador e vê o painel funcionando — com dados de exemplo até conectar o ERP,
e com dados reais depois disso.

Estrutura herdada do painel da Health Importer (`painel-omie`), porém **sem
SCP** (a Healthycann não trabalha com Sociedades em Conta de Participação) e com
a fonte de dados trocada da Omie por um **conector de ERP plugável** (a ligar no
ERP da D9).

## Pré-requisitos

- Node.js **20.12 ou superior** (usa `fetch` nativo e a flag `--env-file-if-exists`)

## Como rodar

```bash
# 1. instale as dependências
npm install

# 2. suba o app (faz o build do painel e inicia o servidor)
npm start
```

Abra **http://localhost:3001**. O painel já aparece com **dados de exemplo**,
sem precisar de configuração nenhuma.

### Ver o painel "ao vivo" com dados de exemplo (mock)

Para exercitar o caminho de dados ao vivo sem o ERP real:

```bash
ERP_PROVIDER=mock npm start
```

### Conectar o ERP real da D9

1. Copie o `.env.example` para `.env` e preencha:
   ```
   D9_API_URL=...      # base da API do ERP D9
   D9_API_TOKEN=...    # token/credencial de acesso
   ```
2. Implemente as chamadas reais em **`erp/d9.js`** (hoje é um esqueleto):
   buscar balanço, títulos a pagar/receber, categorias e notas, e mapear para o
   **contrato** descrito em `erp/contrato.js`.
3. `npm start` — com as credenciais válidas, o painel passa a mostrar os dados
   reais.

## Arquitetura

| Arquivo | Papel |
| --- | --- |
| `d9-conector.js` | Servidor Express: serve o painel e a API (`/api/financeiro`, `/api/vendas`). Login opcional por senha. |
| `painel-financeiro.jsx` | Painel React (empacotado por esbuild → `public/app.js`). |
| `build.js` | Build do front-end (esbuild). |
| `erp/contrato.js` | Formato dos dados que o painel espera + helpers (`montarDRE`, `resumirLista`). |
| `erp/mock.js` | Provider de exemplo (dados fictícios da Healthycann). |
| `erp/d9.js` | Provider do ERP real da D9 — **a implementar**. |
| `erp/index.js` | Escolhe o provider (via `ERP_PROVIDER` ou detecção automática). |

### Como os dados chegam ao painel

```
painel-financeiro.jsx  →  GET /api/financeiro  →  d9-conector.js  →  provider (mock | d9)
```

O painel sempre tem um **fallback**: se a API responder erro/503, ele mostra os
dados de exemplo embutidos, então a tela nunca fica em branco.

## Abas do painel

Visão geral · Apresentação · Contas · Categorias · Vendas · DRE · Orçamento ·
Conciliação · Indicadores · Fluxo de caixa · Valuation.

*(A aba “SCPs” do painel da Health Importer foi removida — a Healthycann não usa SCP.)*

## Variáveis de ambiente

Veja `.env.example`. Resumo:

- `ERP_PROVIDER` — `mock` (exemplo) ou `d9` (ERP real). Em branco: D9 se configurado, senão exemplo.
- `D9_API_URL`, `D9_API_TOKEN` — credenciais do ERP D9.
- `PAINEL_USUARIO`, `PAINEL_SENHA` — protegem o painel com login (defina os dois).
- `PORT` — porta do servidor (padrão 3001).

## Deploy

`render.yaml` está pronto para deploy no [Render](https://render.com) como Web
Service (build `npm install && npm run build`, start `node d9-conector.js`).
