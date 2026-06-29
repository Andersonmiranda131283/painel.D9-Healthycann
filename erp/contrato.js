/**
 * CONTRATO DE DADOS DO PAINEL DE FATURAMENTO/OPERAÇÃO (Healthycann)
 * ----------------------------------------------------------------------------
 * Formato que o painel (painel-faturamento.jsx → GET /api/operacao) espera.
 * Fonte: D9Pro (sistema de PEDIDOS). Por isso o painel é de faturamento, não de
 * DRE/Balanço.
 *
 *   {
 *     nome: "Healthycann",
 *     periodo: "01/01/2026 a 31/12/2026 — D9Pro",
 *     resumo: { faturamento, qtdPedidos, ticketMedio, frete, recebido, aReceber },
 *     porMes:    [{ chave:"2026-04", mes:"Abr/26", valor, qtd }],
 *     porStatus: [{ oSId, label, qtd, valor, recebido }],
 *     porGrupo:  [{ grupo, qtd, valor }],
 *     pedidos:   [{ orderId, data, cliente, cidade, uf, status, grupo, total, rastreio, recebido }],
 *     totalPedidos, pedidosTruncados,
 *   }
 *
 * Produtos (GET /api/produtos): { itens: [{ pId, nome, imagem, preco, custo, margem, regras }] }
 * Comissões (GET /api/comissoes): ver erp/csv.js + provider.comissoes().
 */

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

/** Rótulo "Abr/26" a partir de uma chave "2026-04". */
export function rotuloMes(chave) {
  const [ano, mes] = String(chave).split("-");
  const i = Number(mes) - 1;
  return `${MESES[i] || mes}/${String(ano).slice(2)}`;
}

/**
 * Um status conta como "recebido" (pago/entregue) se estiver na lista de IDs
 * configurada (D9_STATUS_RECEBIDOS); sem lista, usa heurística pelo rótulo.
 */
export function ehRecebido(oSId, label, recebidosIds) {
  if (recebidosIds && recebidosIds.size) return recebidosIds.has(String(oSId));
  const n = String(label || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /(pago|entregue|conclu|finaliz|recebid|despach|enviad)/.test(n);
}

/** Esqueleto vazio do contrato — base segura para um provider preencher. */
export function contratoVazio(nome = "Healthycann") {
  return {
    nome,
    periodo: "",
    resumo: { faturamento: 0, qtdPedidos: 0, ticketMedio: 0, frete: 0, recebido: 0, aReceber: 0 },
    porMes: [],
    porStatus: [],
    porGrupo: [],
    pedidos: [],
    totalPedidos: 0,
    pedidosTruncados: false,
  };
}

/**
 * Agrega uma lista de pedidos normalizados no contrato de operação.
 * opts: { limite=800, recebidosIds:Set<string> }.
 */
export function agregarPedidos(pedidos, statusLabels = {}, opts = {}) {
  const { limite = 800, recebidosIds } = opts;
  const recebidoDe = (oSId) => ehRecebido(oSId, statusLabels[oSId], recebidosIds);

  const faturamento = pedidos.reduce((s, p) => s + (p.total || 0), 0);
  const frete = pedidos.reduce((s, p) => s + (p.frete || 0), 0);
  const qtdPedidos = pedidos.length;

  const mapMes = new Map();
  const mapStatus = new Map();
  const mapGrupo = new Map();
  let recebido = 0;
  for (const p of pedidos) {
    acumular(mapMes, p.chaveMes, p.total);
    acumular(mapStatus, p.oSId, p.total);
    acumular(mapGrupo, p.grupo || "—", p.total);
    if (recebidoDe(p.oSId)) recebido += p.total || 0;
  }

  const porMes = [...mapMes.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([chave, v]) => ({ chave, mes: rotuloMes(chave), valor: v.valor, qtd: v.qtd }));

  const porStatus = [...mapStatus.entries()]
    .map(([oSId, v]) => ({ oSId, label: statusLabels[oSId] || `Status ${oSId}`, qtd: v.qtd, valor: v.valor, recebido: recebidoDe(oSId) }))
    .sort((a, b) => b.valor - a.valor);

  const porGrupo = [...mapGrupo.entries()]
    .map(([grupo, v]) => ({ grupo, qtd: v.qtd, valor: v.valor }))
    .sort((a, b) => b.valor - a.valor);

  const ordenados = [...pedidos].sort((a, b) => (b.chaveOrd || "").localeCompare(a.chaveOrd || ""));
  const lista = ordenados.slice(0, limite).map((p) => ({
    orderId: p.orderId, data: p.dataBR, cliente: p.cliente, cidade: p.cidade,
    uf: p.uf, status: statusLabels[p.oSId] || p.status || `Status ${p.oSId}`,
    grupo: p.grupo, total: p.total, rastreio: p.rastreio, recebido: recebidoDe(p.oSId),
  }));

  return {
    resumo: {
      faturamento,
      qtdPedidos,
      ticketMedio: qtdPedidos ? faturamento / qtdPedidos : 0,
      frete,
      recebido,
      aReceber: faturamento - recebido,
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
