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
 * A D9Pro é um sistema de PEDIDOS/operação (sem contabilidade). O faturamento
 * vem da soma dos pedidos (/orders/list.php), com rótulos de status em
 * /orders/status.php. Ver erp/contrato.js para o formato de saída.
 *
 * Config no .env:
 *   D9_API_URL   = https://healthycann.d9pro.com/api
 *   D9_API_TOKEN = <token gerado no D9Pro>
 */
import { contratoVazio, agregarPedidos } from "./contrato.js";

const API_URL = process.env.D9_API_URL || "";
const API_TOKEN = process.env.D9_API_TOKEN || "";

export const nome = "d9";
export const configurado = Boolean(API_URL && API_TOKEN);

/** Chamada à D9Pro API. Auth via header `token`, conforme a documentação. */
async function chamar(caminho, params = {}) {
  const base = API_URL.endsWith("/") ? API_URL : API_URL + "/";
  const url = new URL(caminho.replace(/^\//, ""), base);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v);
  }
  const resp = await fetch(url, { headers: { token: API_TOKEN, Accept: "application/json" } });
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    throw new Error(`D9Pro API HTTP ${resp.status} em ${caminho}${corpo ? ` — ${corpo.slice(0, 200)}` : ""}`);
  }
  const json = await resp.json();
  if (json && json.success === false) {
    throw new Error(`D9Pro API retornou success=false em ${caminho}`);
  }
  return json;
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

/** "2026-04-15 16:37:02" → { chaveMes:"2026-04", dataBR:"15/04/2026", chaveOrd }. */
function normalizarData(createTime) {
  const m = String(createTime || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { chaveMes: "0000-00", dataBR: "", chaveOrd: "" };
  const [, ano, mes, dia] = m;
  return { chaveMes: `${ano}-${mes}`, dataBR: `${dia}/${mes}/${ano}`, chaveOrd: String(createTime) };
}

function normalizarPedido(o) {
  const d = normalizarData(o.createTime);
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
    ...d,
  };
}

export async function operacao({ inicio, fim } = {}) {
  if (!configurado) {
    throw new Error("D9Pro não configurado — defina D9_API_URL e D9_API_TOKEN no .env.");
  }

  const [listaResp, statusResp] = await Promise.all([
    chamar("/orders/list.php", { oSId: 0, date: rangeData(inicio, fim), filters: "{}" }),
    chamar("/orders/status.php").catch(() => ({ data: [] })),
  ]);

  const statusLabels = {};
  for (const s of statusResp.data || []) statusLabels[String(s.oSId)] = s.label;

  const pedidos = (listaResp.data || []).map(normalizarPedido);
  const agregado = agregarPedidos(pedidos, statusLabels);

  return {
    ...contratoVazio("Healthycann"),
    ...agregado,
    nome: "Healthycann",
    periodo: `${inicio || ""} a ${fim || ""} — D9Pro`,
  };
}

export async function produtos() {
  if (!configurado) {
    throw new Error("D9Pro não configurado — defina D9_API_URL e D9_API_TOKEN no .env.");
  }
  const resp = await chamar("/products/list.php");
  const itens = (resp.data || []).map((p) => ({
    pId: p.pId,
    nome: p.pName,
    imagem: p.pImage,
    preco: null, // disponível em /products/getRules.php?pId= (1 chamada por produto)
    custo: null,
    margem: null,
  }));
  return { itens };
}
