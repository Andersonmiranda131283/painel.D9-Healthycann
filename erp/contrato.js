/**
 * CONTRATO DE DADOS DO PAINEL DE FATURAMENTO/OPERAÇÃO (Healthycann)
 * ----------------------------------------------------------------------------
 * Formato que o painel (painel-faturamento.jsx → GET /api/operacao) espera.
 * Qualquer provider (mock, d9) deve devolver este formato. A fonte é a D9Pro,
 * que é um sistema de PEDIDOS (não de contabilidade) — por isso o painel é de
 * faturamento/operação, e não de DRE/Balanço.
 *
 *   {
 *     nome: "Healthycann",
 *     periodo: "01/01/2026 a 31/12/2026 — D9Pro",
 *     resumo: { faturamento, qtdPedidos, ticketMedio, frete },
 *     porMes:    [{ chave:"2026-04", mes:"Abr/26", valor, qtd }],
 *     porStatus: [{ oSId, label, qtd, valor }],
 *     porGrupo:  [{ grupo, qtd, valor }],
 *     pedidos:   [{ orderId, data, cliente, cidade, uf, status, grupo, total, rastreio }],
 *     totalPedidos, pedidosTruncados,
 *   }
 *
 * Produtos vêm de um endpoint separado (GET /api/produtos):
 *   { itens: [{ pId, nome, imagem, preco, custo, margem }] }
 */

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

/** Rótulo "Abr/26" a partir de uma chave "2026-04". */
export function rotuloMes(chave) {
  const [ano, mes] = String(chave).split("-");
  const i = Number(mes) - 1;
  return `${MESES[i] || mes}/${String(ano).slice(2)}`;
}

/** Esqueleto vazio do contrato — base segura para um provider preencher. */
export function contratoVazio(nome = "Healthycann") {
  return {
    nome,
    periodo: "",
    resumo: { faturamento: 0, qtdPedidos: 0, ticketMedio: 0, frete: 0 },
    porMes: [],
    porStatus: [],
    porGrupo: [],
    pedidos: [],
    totalPedidos: 0,
    pedidosTruncados: false,
  };
}

/**
 * Agrega uma lista de pedidos (já normalizados) no contrato de operação.
 * Cada pedido: { orderId, data:Date, dataBR, cliente, cidade, uf, oSId,
 *                status, grupo, total:Number, frete:Number, rastreio }.
 * `statusLabels` = mapa oSId -> label (de /orders/status.php).
 */
export function agregarPedidos(pedidos, statusLabels = {}, limite = 800) {
  const faturamento = pedidos.reduce((s, p) => s + (p.total || 0), 0);
  const frete = pedidos.reduce((s, p) => s + (p.frete || 0), 0);
  const qtdPedidos = pedidos.length;

  const mapMes = new Map();
  const mapStatus = new Map();
  const mapGrupo = new Map();
  for (const p of pedidos) {
    acumular(mapMes, p.chaveMes, p.total);
    acumular(mapStatus, p.oSId, p.total);
    acumular(mapGrupo, p.grupo || "—", p.total);
  }

  const porMes = [...mapMes.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([chave, v]) => ({ chave, mes: rotuloMes(chave), valor: v.valor, qtd: v.qtd }));

  const porStatus = [...mapStatus.entries()]
    .map(([oSId, v]) => ({ oSId, label: statusLabels[oSId] || `Status ${oSId}`, qtd: v.qtd, valor: v.valor }))
    .sort((a, b) => b.valor - a.valor);

  const porGrupo = [...mapGrupo.entries()]
    .map(([grupo, v]) => ({ grupo, qtd: v.qtd, valor: v.valor }))
    .sort((a, b) => b.valor - a.valor);

  const ordenados = [...pedidos].sort((a, b) => (b.chaveOrd || "").localeCompare(a.chaveOrd || ""));
  const lista = ordenados.slice(0, limite).map((p) => ({
    orderId: p.orderId, data: p.dataBR, cliente: p.cliente, cidade: p.cidade,
    uf: p.uf, status: statusLabels[p.oSId] || p.status || `Status ${p.oSId}`,
    grupo: p.grupo, total: p.total, rastreio: p.rastreio,
  }));

  return {
    resumo: {
      faturamento,
      qtdPedidos,
      ticketMedio: qtdPedidos ? faturamento / qtdPedidos : 0,
      frete,
    },
    porMes, porStatus, porGrupo,
    pedidos: lista,
    totalPedidos: qtdPedidos,
    pedidosTruncados: qtdPedidos > limite,
  };
}

function acumular(mapa, chave, valor) {
  const atual = mapa.get(chave) || { valor: 0, qtd: 0 };
  atual.valor += valor || 0;
  atual.qtd += 1;
  mapa.set(chave, atual);
}
