/**
 * PROVIDER DO ERP D9Pro  (conector — em implementação)
 * ----------------------------------------------------------------------------
 * Conector para a "D9Pro API" (OpenAPI 3.0). Documentação/spec da instância:
 *   https://healthycann.d9pro.com/api/api.yaml
 *
 * Detalhes confirmados pela doc:
 *   - URL base: https://<instancia>.d9pro.com/api   (instância = "healthycann")
 *   - Autenticação: header  token: <seu_token>      (NÃO é Bearer)
 *     ex.: token: 12345_aaaddd
 *   - Endpoints são arquivos .php (ex.: GET /user/me.php).
 *
 * `chamar()` e `testarConexao()` já estão prontos para a autenticação real.
 * Falta mapear os endpoints financeiros (balanço, títulos, categorias, notas)
 * para o CONTRATO (ver erp/contrato.js) — depende de lermos o api.yaml para
 * saber os caminhos exatos.
 *
 * Configuração no .env:
 *   D9_API_URL   = https://healthycann.d9pro.com/api
 *   D9_API_TOKEN = <token gerado no D9Pro>
 */
import { contratoVazio, montarDRE, resumirLista } from "./contrato.js";

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
  const resp = await fetch(url, {
    headers: {
      token: API_TOKEN,
      Accept: "application/json",
    },
  });
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    throw new Error(`D9Pro API HTTP ${resp.status} em ${caminho}${corpo ? ` — ${corpo.slice(0, 200)}` : ""}`);
  }
  return resp.json();
}

/** Testa a conexão/autenticação batendo no endpoint do usuário atual. */
export async function testarConexao() {
  return chamar("/user/me.php");
}

export async function financeiro({ inicio, fim } = {}) {
  if (!configurado) {
    throw new Error("D9Pro não configurado — defina D9_API_URL e D9_API_TOKEN no .env.");
  }

  // TODO: mapear os endpoints reais da D9Pro API (ver api.yaml) para o contrato.
  // Quando soubermos os caminhos, algo como:
  //
  //   const titulos    = await chamar("/financeiro/titulos.php", { inicio, fim });
  //   const categorias = await chamar("/financeiro/categorias.php", { inicio, fim });
  //   ... montar balanço/DRE/série/contas a partir disso ...

  const base = contratoVazio("Healthycann");
  base.periodo = `${inicio || ""} a ${fim || ""} — D9Pro`;
  // Helpers disponíveis para a implementação:
  void montarDRE; void resumirLista;
  return base;
}

export async function vendas({ inicio, fim } = {}) {
  if (!configurado) {
    throw new Error("D9Pro não configurado — defina D9_API_URL e D9_API_TOKEN no .env.");
  }
  // TODO: implementar conforme a API de faturamento/notas da D9Pro.
  return { total: 0, qtdNotas: 0, qtdItens: 0, porSCP: [], porProduto: [], porNota: [] };
}
