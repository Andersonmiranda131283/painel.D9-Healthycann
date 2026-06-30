/**
 * PROVIDER DA D9Pro API — painel de Faturamento/Operação da Healthycann
 * ----------------------------------------------------------------------------
 * Conector para a "D9Pro API" (OpenAPI 3.0). Spec da instância:
 *   https://healthycann.d9pro.com/api/api.yaml
 *
 * Confirmado pela doc:
 *   - Base: https://<instancia>.d9pro.com/api   (instância = "healthycann")
 *   - Auth: header  token: <seu_token>          (NÃO é Bearer)
 *   - Respostas no envelope { t, success, data }.
 *
 * Config no .env:
 *   D9_API_URL          = https://healthycann.d9pro.com/api
 *   D9_API_TOKEN        = <token gerado no D9Pro>
 *   D9_STATUS_RECEBIDOS = (opcional) IDs de status que contam como pago/entregue,
 *                         ex.: "8,16". Sem isso, usa heurística pelo rótulo.
 */
import { contratoVazio, agregarPedidos, rotuloMes } from "./contrato.js";
import { parseCSV, acharColuna, numeroBR } from "./csv.js";

const API_URL = process.env.D9_API_URL || "";
const API_TOKEN = process.env.D9_API_TOKEN || "";
// Os relatórios /export/*.php são baixados via link e leem o token da QUERY.
// Por padrão usa o mesmo token da API; se a exportação tiver token próprio,
// defina D9_EXPORT_TOKEN.
const EXPORT_TOKEN = process.env.D9_EXPORT_TOKEN || API_TOKEN;
const STATUS_RECEBIDOS = new Set(
  (process.env.D9_STATUS_RECEBIDOS || "").split(",").map((s) => s.trim()).filter(Boolean)
);
// (opcional) IDs de status de "em trânsito"; sem isto, deduz pelo rótulo.
const STATUS_TRANSITO = new Set(
  (process.env.D9_STATUS_TRANSITO || "").split(",").map((s) => s.trim()).filter(Boolean)
);
// Qual relatório CSV conta como "Clientes" na aba Resumo (patients|associates|patientsWithClient).
const EXPORT_CLIENTES = (process.env.D9_EXPORT_CLIENTES || "patients").trim();
// (opcional) IDs de status a EXCLUIR do faturamento (cancelados). Sem isto, usa type "deleted".
const STATUS_EXCLUIR = new Set(
  (process.env.D9_STATUS_EXCLUIR || "").split(",").map((s) => s.trim()).filter(Boolean)
);

/**
 * Classifica os status do pedido a partir de /orders/status.php, usando os
 * campos `type` (sent/delivered/deleted) e `statusOrder`:
 *   - excluidos = cancelados (type "deleted") → fora do faturamento;
 *   - transito  = type "sent" (Enviado);
 *   - recebidos = pago/entregue = type sent|delivered OU etapa após o pagamento
 *                 (statusOrder maior que o do último status de "pagamento").
 * Variáveis D9_STATUS_* sobrescrevem cada conjunto, se definidas.
 */
function classificarStatus(statusData = []) {
  const meta = {};
  let pagamentoOrdem = 0;
  for (const s of statusData) {
    const id = String(s.oSId);
    const ordem = parseInt(s.statusOrder) || 0;
    meta[id] = { label: s.label, type: s.type || "", ordem, ordersHere: parseInt(s.ordersHere) || 0 };
    if (/pagamento/i.test(s.label) && s.type !== "deleted") pagamentoOrdem = Math.max(pagamentoOrdem, ordem);
  }
  const excluidos = new Set(), transito = new Set(), recebidos = new Set();
  for (const [id, m] of Object.entries(meta)) {
    if (m.type === "deleted") { excluidos.add(id); continue; }
    if (m.type === "sent") transito.add(id);
    if (m.type === "sent" || m.type === "delivered" || (pagamentoOrdem && m.ordem > pagamentoOrdem)) recebidos.add(id);
  }
  if (STATUS_RECEBIDOS.size) { recebidos.clear(); STATUS_RECEBIDOS.forEach((x) => recebidos.add(x)); }
  if (STATUS_TRANSITO.size) { transito.clear(); STATUS_TRANSITO.forEach((x) => transito.add(x)); }
  if (STATUS_EXCLUIR.size) { excluidos.clear(); STATUS_EXCLUIR.forEach((x) => excluidos.add(x)); }
  const labels = {};
  for (const [id, m] of Object.entries(meta)) labels[id] = m.label;
  return { meta, labels, excluidos, transito, recebidos };
}

export const nome = "d9";
export const configurado = Boolean(API_URL && API_TOKEN);

function montarUrl(caminho, params = {}) {
  const base = API_URL.endsWith("/") ? API_URL : API_URL + "/";
  const url = new URL(caminho.replace(/^\//, ""), base);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  return url;
}

/** Chamada JSON à D9Pro API. Auth via header `token`. */
async function chamar(caminho, params = {}) {
  const resp = await fetch(montarUrl(caminho, params), { headers: { token: API_TOKEN, Accept: "application/json" } });
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    throw new Error(`D9Pro API HTTP ${resp.status} em ${caminho}${corpo ? ` — ${corpo.slice(0, 200)}` : ""}`);
  }
  const json = await resp.json();
  if (json && json.success === false) throw new Error(`D9Pro API retornou success=false em ${caminho}`);
  return json;
}

/** Chamada que devolve texto cru (para os relatórios CSV /export/*.php).
 * Manda o token na QUERY (como o download via link) e também no header. */
async function chamarTexto(caminho, params = {}) {
  // Espaços nas datas (s/e) como %20, igual ao link de download da D9Pro.
  const href = montarUrl(caminho, { ...params, token: EXPORT_TOKEN }).toString().replace(/\+/g, "%20");
  const resp = await fetch(href, { headers: { token: API_TOKEN } });
  if (!resp.ok) throw new Error(`D9Pro API HTTP ${resp.status} em ${caminho}`);
  const txt = await resp.text();
  // Se vier HTML (ex.: página de login), o relatório não autenticou.
  if (/^\s*<(?:!doctype|html)/i.test(txt)) {
    throw new Error(`Relatório ${caminho} não autenticou (token de exportação?). Defina D9_EXPORT_TOKEN se a exportação tiver token próprio.`);
  }
  return txt;
}

// Cache simples (TTL) para os CSVs — evita rebaixar relatórios grandes a cada período.
const _cacheCSV = new Map();
async function csvCacheado(caminho, params = {}, ttlMs = 5 * 60 * 1000) {
  const chave = caminho + JSON.stringify(params);
  const hit = _cacheCSV.get(chave);
  const agora = Date.now();
  if (hit && agora - hit.ts < ttlMs) return hit.txt;
  const txt = await chamarTexto(caminho, params);
  _cacheCSV.set(chave, { ts: agora, txt });
  return txt;
}

/** Testa a conexão/autenticação batendo no endpoint do usuário atual. */
export async function testarConexao() {
  return chamar("/user/me.php");
}

/** "dd/mm/aaaa" → range D9Pro "dd/mm/aaaa 00:00 - dd/mm/aaaa 23:59" (endpoints JSON). */
function rangeData(inicio, fim) {
  if (!inicio || !fim) return undefined;
  return `${inicio} 00:00 - ${fim} 23:59`;
}

/** "dd/mm/aaaa" → "aaaa-mm-dd HH:MM:SS" (parâmetros s/e dos relatórios /export). */
function isoData(br, fimDoDia = false) {
  const m = String(br || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d} ${fimDoDia ? "23:59:59" : "00:00:00"}`;
}
/** Parâmetros de data dos relatórios CSV: { s, e }. */
function rangeExport(inicio, fim) {
  const s = isoData(inicio, false), e = isoData(fim, true);
  return s && e ? { s, e } : {};
}

/** Quebra a coluna `conteudo` do export em itens { nome, sku }. */
function parseConteudo(s) {
  return String(s || "")
    .split(/\s*\\+\s*/).map((x) => x.trim()).filter(Boolean)
    .map((item) => {
      const nome = item.split(/\s*:\s*SKU:/i)[0].trim();
      const sku = (item.match(/SKU:\s*([^,]+)/i) || [])[1];
      return { nome, sku: sku ? sku.trim() : "" };
    });
}

/** "dd/mm/aaaa hh:mm" (formato do CSV) → chaves de dia/mês. */
function dataCSV(createTime) {
  const m = String(createTime || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return { chaveDia: "", chaveMes: "", dataBR: "" };
  const [, d, mo, y] = m;
  return { chaveDia: `${y}-${mo}-${d}`, chaveMes: `${y}-${mo}`, dataBR: `${d}/${mo}/${y}` };
}

function acc(mapa, chave, valor, frascos = 0) {
  const a = mapa.get(chave) || { valor: 0, qtd: 0, frascos: 0 };
  a.valor += valor || 0; a.qtd += 1; a.frascos += frascos || 0; mapa.set(chave, a);
}

/** "2026-04-15 16:37:02" → { chaveMes, dataBR, chaveOrd }. */
function normalizarData(createTime) {
  const m = String(createTime || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { chaveMes: "0000-00", dataBR: "", chaveOrd: "" };
  const [, ano, mes, dia] = m;
  return { chaveMes: `${ano}-${mes}`, dataBR: `${dia}/${mes}/${ano}`, chaveOrd: String(createTime) };
}

function normalizarPedido(o) {
  return {
    orderId: o.orderId,
    total: parseFloat(o.orderTotal) || 0,
    frete: 0, // a D9Pro embute o frete no orderTotal; valor avulso não vem na lista
    oSId: String(o.oSId),
    status: "",
    grupo: o.orderGroup || "—",
    cliente: o.addressPersonName || "",
    cidade: o.addressCity || "",
    uf: o.addressState || "",
    rastreio: o.trackingCode || "",
    ...normalizarData(o.createTime),
  };
}

export async function operacao({ inicio, fim } = {}) {
  if (!configurado) throw new Error("D9Pro não configurado — defina D9_API_URL e D9_API_TOKEN no .env.");

  const [listaResp, statusResp] = await Promise.all([
    chamar("/orders/list.php", { oSId: 0, date: rangeData(inicio, fim), filters: "{}" }),
    chamar("/orders/status.php").catch(() => ({ data: [] })),
  ]);

  const cls = classificarStatus(statusResp.data || []);

  // Pedidos do período, excluindo cancelados (faturamento = pedidos válidos).
  const pedidos = (listaResp.data || [])
    .map(normalizarPedido)
    .filter((p) => !cls.excluidos.has(p.oSId));
  const agregado = agregarPedidos(pedidos, cls.labels, { recebidosIds: cls.recebidos });

  return {
    ...contratoVazio("Healthycann"),
    ...agregado,
    nome: "Healthycann",
    periodo: `${inicio || ""} a ${fim || ""} — D9Pro`,
  };
}

/** Catálogo com preço/custo/margem (cruza cada produto com suas regras de preço). */
export async function produtos() {
  if (!configurado) throw new Error("D9Pro não configurado — defina D9_API_URL e D9_API_TOKEN no .env.");

  const resp = await chamar("/products/list.php");
  const lista = resp.data || [];

  const itens = await Promise.all(lista.map(async (p) => {
    let preco = null, custo = null, margem = null, regras = 0;
    try {
      const r = await chamar("/products/getRules.php", { pId: p.pId });
      const rules = (r.data || [])
        .map((x) => ({ price: parseFloat(x.price) || 0, cost: parseFloat(x.cost) || 0 }))
        .filter((x) => x.price > 0);
      regras = rules.length;
      if (rules.length) {
        const rep = rules.reduce((min, x) => (x.price < min.price ? x : min), rules[0]); // "a partir de"
        preco = rep.price;
        custo = rep.cost;
        margem = preco > 0 ? (preco - custo) / preco : null;
      }
    } catch { /* produto sem regras / sem permissão — segue sem preço */ }
    return { pId: p.pId, nome: p.pName, imagem: p.pImage, preco, custo, margem, regras };
  }));

  return { itens };
}

/**
 * Comissões a partir do relatório CSV /export/commission.php.
 * Como as colunas do CSV não estão na spec, detectamos por heurística as
 * colunas de valor/operador/data. `aviso` sinaliza que pode precisar de ajuste
 * fino quando virmos o CSV real (configurável depois, se necessário).
 */
export async function comissoes({ inicio, fim } = {}) {
  if (!configurado) throw new Error("D9Pro não configurado — defina D9_API_URL e D9_API_TOKEN no .env.");

  const texto = await csvCacheado("/export/commission.php", rangeExport(inicio, fim));
  const { colunas, linhas } = parseCSV(texto);

  const colValor = acharColuna(colunas, ["comiss", "valor", "value", "total"]);
  const colOper = acharColuna(colunas, ["operador", "vendedor", "consultor", "usuario", "usuário", "name", "nome"]);

  let total = 0;
  const porOper = new Map();
  for (const l of linhas) {
    const v = colValor ? numeroBR(l[colValor]) : 0;
    total += v;
    const oper = colOper ? (l[colOper] || "—") : "—";
    porOper.set(oper, (porOper.get(oper) || 0) + v);
  }
  const porOperador = [...porOper.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);

  return {
    total,
    qtd: linhas.length,
    porOperador,
    colunas,
    colValor, colOper,
    itens: linhas.slice(0, 500),
    aviso: colValor ? null : "Não identifiquei a coluna de valor da comissão no CSV — confira docs/d9pro-endpoints.md.",
  };
}

/**
 * Vendas por produto e por data, a partir do relatório /export/orders.php.
 * A coluna `conteudo` lista os itens do pedido; o faturamento por produto é
 * rateado pelo total do pedido dividido entre seus itens (a quantidade é exata).
 * Considera só pedidos válidos (coluna `pedidoValido` = 1).
 */
const PAGAMENTO_LABEL = { credit: "Cartão de crédito", boleto: "Boleto", pix: "Pix" };
const rotuloPagamento = (p) => PAGAMENTO_LABEL[p] || (p ? p : "Não informado");
// Meta de faturamento mensal padrão (o painel também deixa editar na tela).
const META_MENSAL = Number(String(process.env.D9_META_MENSAL || "").replace(/\./g, "").replace(",", ".")) || null;

export async function vendas({ inicio, fim } = {}) {
  if (!configurado) throw new Error("D9Pro não configurado — defina D9_API_URL e D9_API_TOKEN no .env.");

  const [texto, statusResp] = await Promise.all([
    csvCacheado("/export/orders.php", rangeExport(inicio, fim)),
    chamar("/orders/status.php").catch(() => ({ data: [] })),
  ]);
  const cls = classificarStatus(statusResp.data || []);
  const validos = parseCSV(texto).linhas.filter((l) => String(l.pedidoValido) === "1");

  // Passo 1: preço e custo de referência por SKU (pedidos de um único SKU),
  // para ratear o total/custo dos pedidos misturados proporcional ao preço/custo.
  const refP = {}, refPN = {}, refC = {}, refCN = {};
  for (const l of validos) {
    const its = parseConteudo(l.conteudo); if (!its.length) continue;
    if (new Set(its.map((i) => i.sku)).size !== 1) continue;
    const k = its[0].sku;
    const t = numeroBR(l.orderTotal), c = numeroBR(l["custo total dos produtos"]);
    if (t > 0) { refP[k] = (refP[k] || 0) + t / its.length; refPN[k] = (refPN[k] || 0) + 1; }
    refC[k] = (refC[k] || 0) + c / its.length; refCN[k] = (refCN[k] || 0) + 1;
  }
  for (const k in refP) refP[k] /= refPN[k];
  for (const k in refC) refC[k] /= refCN[k];

  const porProduto = new Map(), porEstado = new Map(), porPagamento = new Map(),
    porPrescritor = new Map(), porGrupo = new Map(), porCidade = new Map(), porVendedor = new Map();
  const porDia = new Map(), porMes = new Map();
  let faturamento = 0, custo = 0, pedidos = 0, itensVendidos = 0, recebido = 0;

  for (const l of validos) {
    pedidos++;
    const total = numeroBR(l.orderTotal);
    const custoPed = numeroBR(l["custo total dos produtos"]);
    faturamento += total; custo += custoPed;
    if (cls.recebidos.has(String(l.oSId))) recebido += total;

    const itens = parseConteudo(l.conteudo);
    const frascos = itens.length; // cada item do pedido = 1 frasco/unidade
    itensVendidos += frascos;

    const { chaveDia, chaveMes } = dataCSV(l.createTime);
    acc(porDia, chaveDia, total, frascos);
    acc(porMes, chaveMes, total, frascos);
    acc(porEstado, l.addressState || "—", total, frascos);
    acc(porPagamento, rotuloPagamento(l.payMethod), total, frascos);
    acc(porPrescritor, l["nome prescritor"] || "—", total, frascos);
    acc(porGrupo, l.orderGroup || "—", total, frascos);
    acc(porCidade, l.addressCity || "—", total, frascos);
    acc(porVendedor, l.userRealName || "—", total, frascos);
    const wp = itens.map((i) => refP[i.sku] || 1); const sp = wp.reduce((a, b) => a + b, 0) || itens.length || 1;
    const wc = itens.map((i) => refC[i.sku] || 1); const sc = wc.reduce((a, b) => a + b, 0) || itens.length || 1;
    itens.forEach((it, i) => {
      const k = it.nome || it.sku || "?";
      const p = porProduto.get(k) || { nome: it.nome || k, sku: it.sku, quantidade: 0, faturamento: 0, custo: 0, pedidos: new Set() };
      p.quantidade += 1;
      p.faturamento += total * (wp[i] / sp);   // rateio por preço de referência
      p.custo += custoPed * (wc[i] / sc);       // rateio por custo de referência
      p.pedidos.add(l.orderId);
      porProduto.set(k, p);
    });
  }

  const produtos = [...porProduto.values()].map((p) => {
    const lucro = p.faturamento - p.custo;
    return {
      nome: p.nome, sku: p.sku, quantidade: p.quantidade, faturamento: p.faturamento,
      custo: p.custo, lucro, margem: p.faturamento > 0 ? lucro / p.faturamento : null,
      pedidos: p.pedidos.size, ticketMedio: p.pedidos.size ? p.faturamento / p.pedidos.size : 0,
    };
  }).sort((a, b) => b.faturamento - a.faturamento);

  const lista = (m, chaveNome) => [...m.entries()]
    .map(([k, v]) => ({ [chaveNome]: k, valor: v.valor, qtd: v.qtd, frascos: v.frascos }))
    .sort((a, b) => b.valor - a.valor);

  const porMesArr = [...porMes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([chave, v], i, arr) => {
      const prev = i > 0 ? arr[i - 1][1].valor : null;
      return { chave, mes: rotuloMes(chave), valor: v.valor, qtd: v.qtd, frascos: v.frascos, variacao: prev ? (v.valor - prev) / prev : null };
    });
  const porDiaArr = [...porDia.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([chave, v]) => ({ chave, valor: v.valor, qtd: v.qtd, frascos: v.frascos }));

  const lucro = faturamento - custo;
  return {
    nome: "Healthycann",
    periodo: `${inicio || ""} a ${fim || ""} — D9Pro`,
    resumo: {
      faturamento, custo, lucro, margem: faturamento > 0 ? lucro / faturamento : null,
      pedidos, itensVendidos, ticketMedio: pedidos ? faturamento / pedidos : 0,
      recebido, aReceber: faturamento - recebido,
      metaMensal: META_MENSAL,
    },
    produtos,
    porMes: porMesArr, porDia: porDiaArr,
    porEstado: lista(porEstado, "uf"),
    porPagamento: lista(porPagamento, "forma"),
    porPrescritor: lista(porPrescritor, "nome"),
    porGrupo: lista(porGrupo, "grupo"),
    porCidade: lista(porCidade, "cidade"),
    porVendedor: lista(porVendedor, "nome"),
  };
}

/**
 * Resumo (estilo "Home" da D9Pro): KPIs de cadastros + pedidos + últimos.
 * Pedidos vêm de /orders/list.php (confiável). Clientes e Prescritores são a
 * contagem de linhas dos CSVs de cadastro (configurável via D9_EXPORT_CLIENTES).
 */
export async function resumo({ inicio, fim } = {}) {
  if (!configurado) throw new Error("D9Pro não configurado — defina D9_API_URL e D9_API_TOKEN no .env.");

  const [csvOrders, statusResp] = await Promise.all([
    csvCacheado("/export/orders.php", rangeExport(inicio, fim)),
    chamar("/orders/status.php").catch(() => ({ data: [] })),
  ]);
  const cls = classificarStatus(statusResp.data || []);

  // "Em trânsito" = snapshot ao vivo (ordersHere dos status de envio) — igual à Home.
  let emTransito = 0;
  for (const id of cls.transito) emTransito += cls.meta[id]?.ordersHere || 0;

  // Pedidos do período vêm do relatório COMPLETO (não da lista paginada).
  const ordens = parseCSV(csvOrders).linhas.filter((l) => String(l.pedidoValido) === "1");
  const chaveOrd = (ct) => {
    const m = String(ct || "").match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
    return m ? `${m[3]}${m[2]}${m[1]}${m[4] || "00"}${m[5] || "00"}` : "";
  };
  const pedidos = ordens.length;
  const ultimosPedidos = [...ordens]
    .sort((a, b) => chaveOrd(b.createTime).localeCompare(chaveOrd(a.createTime)))
    .slice(0, 8)
    .map((l) => ({
      orderId: l.orderId, cliente: l.addressPersonName || l.cliente || "",
      cidade: l.addressCity || "", uf: l.addressState || "",
      data: (l.createTime || "").slice(0, 10),
      status: l.orderStatus || cls.labels[String(l.oSId)] || "",
    }));

  const avisos = [];
  let clientes = null, prescritores = null, ultimosClientes = [];

  try {
    const { colunas, linhas } = parseCSV(await csvCacheado(`/export/${EXPORT_CLIENTES}.php`));
    clientes = linhas.length;
    const colNome = acharColuna(colunas, ["nome", "name", "paciente", "cliente", "associado", "razao"]);
    const colId = acharColuna(colunas, ["^id$", "codigo", "código", "id$"]);
    const colCidade = acharColuna(colunas, ["cidade", "city", "municip"]);
    const colUf = acharColuna(colunas, ["^uf$", "estado", "state"]);
    if (colNome) {
      const ord = colId ? [...linhas].sort((a, b) => (parseInt(b[colId]) || 0) - (parseInt(a[colId]) || 0)) : linhas;
      ultimosClientes = ord.slice(0, 8).map((l) => ({
        id: colId ? l[colId] : "", nome: l[colNome],
        cidade: colCidade ? l[colCidade] : "", uf: colUf ? l[colUf] : "",
      }));
    }
  } catch {
    avisos.push(`Não consegui ler /export/${EXPORT_CLIENTES}.php para "Clientes" (ajuste D9_EXPORT_CLIENTES).`);
  }

  try {
    prescritores = parseCSV(await csvCacheado("/export/prescribers.php")).linhas.length;
  } catch {
    avisos.push("Não consegui ler /export/prescribers.php para \"Prescritores\".");
  }

  return {
    nome: "Healthycann",
    periodo: `${inicio || ""} a ${fim || ""} — D9Pro`,
    kpis: { clientes, prescritores, pedidosPeriodo: pedidos, emTransito },
    ultimosPedidos, ultimosClientes, avisos,
  };
}
