# Painel Healthycann — Estado do projeto

Resumo do que está pronto e do que ficou pendente. Atualizado em 28/06/2026.

## O que é

App web (um servidor Node.js) que mostra um **painel financeiro da Healthycann**.
Recriado a partir do molde do `painel-omie` (painel da Health Importer), com duas
diferenças de fundo:

- **Sem SCP** — a Healthycann não usa Sociedades em Conta de Participação. A aba
  "SCPs" foi removida e o seletor de SCP no topo some quando não há SCPs.
- **Fonte de dados trocada** — em vez da API da Omie, os dados vêm de um
  **conector de ERP plugável** (`erp/`), preparado para o ERP da D9.

## O que já está pronto

- Estrutura do projeto (servidor + front-end + build) clonada e adaptada.
- Painel React funcionando com **dados de exemplo** (`npm start` já abre a tela).
- Caminho "ao vivo" com provider **mock** (`ERP_PROVIDER=mock`).
- Camada de ERP plugável com **contrato de dados documentado** (`erp/contrato.js`).
- Servidor com **login opcional** por senha (Basic) e endpoints `/api/financeiro`
  e `/api/vendas`.
- `render.yaml` pronto para deploy.

## O que falta (próximos passos)

1. **Implementar o conector do ERP D9** (`erp/d9.js`):
   - Definir `D9_API_URL` / `D9_API_TOKEN` (e ajustar a autenticação real).
   - Mapear a resposta do ERP para o contrato (balanço, DRE, série mensal,
     contas a pagar/receber, categorias, vendas).
2. **Acrescentar as novas operações/abas** que a Healthycann precisa (ponto que
   você quer evoluir além do molde).
3. Revisar abas herdadas que eram específicas da Omie/Health Importer
   (ex.: **Conciliação** assume importação OFX cruzada com o ERP; **Vendas**
   assume nota fiscal/SKU) e adaptar à realidade do ERP D9.

## Decisões importantes

- O painel **nunca fica em branco**: sem ERP configurado, `/api/financeiro`
  responde 503 e o front-end usa os dados de exemplo embutidos.
- Para acrescentar outra fonte (planilha, outro ERP), basta criar
  `erp/<nome>.js` com a interface `{ nome, configurado, financeiro(), vendas() }`
  e registrá-la em `erp/index.js`.

## Variáveis de ambiente

`ERP_PROVIDER` (mock | d9), `D9_API_URL`, `D9_API_TOKEN`, `PAINEL_USUARIO`,
`PAINEL_SENHA`, `PORT`. Ver `.env.example`.
