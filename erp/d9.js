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
