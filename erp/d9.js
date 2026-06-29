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
import { contratoVazio, agregarPedidos } from "./contrato.js";
import { parseCSV, acharColuna, numeroBR } from "./csv.js";

const API_URL = process.env.D9_API_URL || "";
const API_TOKEN = process.env.D9_API_TOKEN || "";
const STATUS_RECEBIDOS = new Set(
  (process.env.D9_STATUS_RECEBIDOS || "").split(",").map((s) => s.trim()).filter(Boolean)
);
// (opcional) IDs de status de "em trânsito"; sem isto, deduz pelo rótulo.
const STATUS_TRANSITO = new Set(
  (process.env.D9_STATUS_TRANSITO || "").split(",").map((s) => s.trim()).filter(Boolean)
);
// Qual relatório CSV conta como "Clientes" na aba Resumo (patients|associates|patientsWithClient).
const EXPORT_CLIENTES = (process.env.D9_EXPORT_CLIENTES || "patients").trim();

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

/** Chamada que devolve texto cru (para os relatórios CSV /export/*.php). */
async function chamarTexto(caminho, params = {}) {
  const resp = await fetch(montarUrl(caminho, params), { headers: { token: API_TOKEN } });
  if (!resp.ok) throw new Error(`D9Pro API HTTP ${resp.status} em ${caminho}`);
  return resp.text();
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

/** "dd/mm/aaaa" → range D9Pro "dd/mm/aaaa 00:00 - dd/mm/aaaa 23:59". */
function rangeData(inicio, fim) {
  if (!inicio || !fim) return undefined;
  return `${inicio} 00:00 - ${fim} 23:59`;
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

  const statusLabels = {};
  for (const s of statusResp.data || []) statusLabels[String(s.oSId)] = s.label;

  const pedidos = (listaResp.data || []).map(normalizarPedido);
  const agregado = agregarPedidos(pedidos, statusLabels, { recebidosIds: STATUS_RECEBIDOS });

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

  const texto = await chamarTexto("/export/commission.php", { date: rangeData(inicio, fim) });
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

/** Um pedido está "em trânsito" pelos IDs configurados ou pela heurística do rótulo. */
function ehTransito(oSId, label) {
  if (STATUS_TRANSITO.size) return STATUS_TRANSITO.has(String(oSId));
  const n = String(label || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /(transit|enviad|despach|transporte|correio|a caminho|saiu para entrega|rastre)/.test(n);
}

/**
 * Resumo (estilo "Home" da D9Pro): KPIs de cadastros + pedidos + últimos.
 * Pedidos vêm de /orders/list.php (confiável). Clientes e Prescritores são a
 * contagem de linhas dos CSVs de cadastro (configurável via D9_EXPORT_CLIENTES).
 */
export async function resumo({ inicio, fim } = {}) {
  if (!configurado) throw new Error("D9Pro não configurado — defina D9_API_URL e D9_API_TOKEN no .env.");

  const [listaResp, statusResp] = await Promise.all([
    chamar("/orders/list.php", { oSId: 0, date: rangeData(inicio, fim), filters: "{}" }),
    chamar("/orders/status.php").catch(() => ({ data: [] })),
  ]);
  const statusLabels = {};
  for (const s of statusResp.data || []) statusLabels[String(s.oSId)] = s.label;

  const pedidos = (listaResp.data || []).map(normalizarPedido);
  const emTransito = pedidos.filter((p) => ehTransito(p.oSId, statusLabels[p.oSId])).length;
  const ultimosPedidos = [...pedidos]
    .sort((a, b) => (b.chaveOrd || "").localeCompare(a.chaveOrd || ""))
    .slice(0, 8)
    .map((p) => ({ orderId: p.orderId, cliente: p.cliente, cidade: p.cidade, uf: p.uf, data: p.dataBR, status: statusLabels[p.oSId] || p.status }));

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
    kpis: { clientes, prescritores, pedidosPeriodo: pedidos.length, emTransito },
    ultimosPedidos, ultimosClientes, avisos,
  };
}
