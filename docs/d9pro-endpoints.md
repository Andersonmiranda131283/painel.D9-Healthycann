# D9Pro API — catálogo de endpoints (instância Healthycann)

Resumo da spec OpenAPI 3.0 (`https://healthycann.d9pro.com/api/api.yaml`,
versão 26.05.190). Base: `https://healthycann.d9pro.com/api`.
Autenticação: header `token: <seu_token>`.

Todas as respostas seguem o envelope `{ t: <epoch>, success: bool, data: ... }`.

## user
- `GET /user/me.php` — usuário atual (userId, userRealName, userCompany, companyImage…).

## config
- `GET /config/perms.php` — permissões do usuário (lista de flags `*_read`/`*_write`).
- `GET /config/company.php` — dados da empresa (companyName, companyImage).
- `GET /config/logistic.php` — caixas (dimensões) e métodos de frete.

## orders (pedidos) — **núcleo financeiro disponível**
- `GET /orders/list.php?oSId=&date=&filters=` — lista de pedidos.
  Campos: `orderId, oSId (status), orderTotal, orderGroup, trackingCode,
  addressPersonName/Phone/Cep/State/City, updateTime, createTime, frete`.
  `date` = `"dd/MM/yyyy HH:mm - dd/MM/yyyy HH:mm"`.
- `GET /orders/get.php?orderId=` — detalhe do pedido (inclui `payTime`,
  `payLink`, `orderStatus`, `hasCommission`, prescritor, endereço completo).
- `GET /orders/status.php` — lista de status (oSId → label, ordem).
- `POST /orders/new.php` — cria pedido.
- `POST /orders/changeStatus.php` — muda status.
- `POST /orders/genPay.php` — gera link de pagamento.

## products (produtos)
- `GET /products/list.php` — catálogo (pId, pName, pImage).
- `GET /products/getChars.php?pId=` — características (ex.: "Frasco 30 mL").
- `GET /products/getRules.php?pId=` — regras de preço (`price`, `cost`, opções).

## export (CSV) — relatórios completos
- `GET /export/orders.php` — **pedidos** (provável fonte mais rica p/ faturamento).
- `GET /export/commission.php` — **comissões**.
- `GET /export/associates.php`, `/export/patients.php`,
  `/export/patientsWithClient.php`, `/export/prescribers.php`,
  `/export/operators.php`, `/export/visitas.php`, `/export/orcamentos.php`,
  `/export/logs.php`, `/export/d9chats.php`, `/export/d9chatmsgs.php`.

## whatsapp
- `POST /whatsapp/chats.php`, `GET /whatsapp/chatTags.php`,
  `GET /whatsapp/messages.php`, `POST /whatsapp/newMessage.php`.

## tarefa (tarefas / pipeline)
- `GET /whatsapp/tarefa/pipeList.php`, `GET /whatsapp/tarefa/statusList.php?wCId=`,
  `POST /whatsapp/tarefa/list.php`, `GET /whatsapp/tarefa/get.php?chatId=`.

---

## Observação importante (escopo financeiro)

A D9Pro API é um sistema de **pedidos / CRM / operação** (pedidos, produtos,
pacientes, prescritores, associados, anuidade, comissões, WhatsApp). **Não há**
endpoints de **contabilidade**: sem balanço patrimonial, sem DRE, sem contas a
pagar, sem plano de contas, sem conciliação bancária.

O que dá para extrair de financeiro a partir desta API:
- **Faturamento / receita** = soma de `orderTotal` dos pedidos (por período,
  status, grupo e mês) — via `/orders/list.php` ou `/export/orders.php`.
- **Recebível vs recebido** = pedidos com `payTime` (pago) vs com `payLink`
  pendente.
- **Pedidos por status** (funil) = `/orders/status.php` + agregação por `oSId`.
- **Ticket médio**, nº de pedidos, frete.
- **Comissões** = `/export/commission.php`.
- **Produtos / preço / custo** = `/products/*` (margem por produto).

O que **não** sai da D9Pro (precisa de outra fonte — contador/planilha — ou
lançamento manual): despesas operacionais, CMV efetivo, impostos, balanço,
depreciação, empréstimos, e portanto DRE e valuation completos.
