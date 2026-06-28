/**
 * PROVIDER DO ERP D9  (a implementar)
 * ----------------------------------------------------------------------------
 * Este é o conector para o ERP real da D9. Hoje é um ESQUELETO: ele só vira
 * "configurado" quando as variáveis de ambiente abaixo estiverem definidas, e
 * as funções `financeiro`/`vendas` ainda precisam ser escritas conforme a API
 * do ERP (endpoints, autenticação e formato de resposta).
 *
 * O que falta para ligar os dados reais:
 *   1. Definir as variáveis no .env:
 *        D9_API_URL   = base da API do ERP D9 (ex.: https://api.exemplo/v1)
 *        D9_API_TOKEN = token/credencial de acesso  (ou D9_API_KEY/secret)
 *   2. Implementar `chamar()` com a autenticação que o ERP exige.
 *   3. Mapear a resposta do ERP para o CONTRATO (ver erp/contrato.js):
 *        - balanço, DRE, série mensal, contas a pagar/receber, categorias.
 *        - Healthycann NÃO usa SCP → projetos/scpsDisponiveis/escopo vazios.
 *
 * Enquanto não estiver implementado, o servidor cai para `mock` (se
 * ERP_PROVIDER=mock) ou responde 503 e o painel mostra dados de exemplo.
 */
import { contratoVazio, montarDRE, resumirLista } from "./contrato.js";

const API_URL = process.env.D9_API_URL || "";
const API_TOKEN = process.env.D9_API_TOKEN || "";

export const nome = "d9";
export const configurado = Boolean(API_URL && API_TOKEN);

/** Chamada genérica ao ERP D9. Ajuste a autenticação conforme a API real. */
async function chamar(caminho, params = {}) {
  const url = new URL(caminho.replace(/^\//, ""), API_URL.endsWith("/") ? API_URL : API_URL + "/");
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v);
  }
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/json",
    },
  });
  if (!resp.ok) throw new Error(`ERP D9 respondeu HTTP ${resp.status} em ${caminho}`);
  return resp.json();
}

export async function financeiro({ inicio, fim } = {}) {
  if (!configurado) {
    throw new Error("ERP D9 não configurado — defina D9_API_URL e D9_API_TOKEN no .env.");
  }

  // TODO: substituir pelos endpoints reais do ERP D9 e mapear para o contrato.
  // Exemplo do esqueleto (não chama nada ainda):
  //
  //   const balanco   = await chamar("balanco",   { inicio, fim });
  //   const titulos   = await chamar("titulos",   { inicio, fim });
  //   const categorias = await chamar("categorias", { inicio, fim });
  //   ... montar o objeto do contrato a partir disso ...

  const base = contratoVazio("Healthycann");
  base.periodo = `${inicio || ""} a ${fim || ""} — ERP D9`;
  // Quando implementar, preencha base.balanco / base.dre (use montarDRE) /
  // base.serieMensal / base.contas (use resumirLista) / base.porCategoria etc.
  void montarDRE; void resumirLista; // disponíveis para a implementação
  return base;
}

export async function vendas({ inicio, fim } = {}) {
  if (!configurado) {
    throw new Error("ERP D9 não configurado — defina D9_API_URL e D9_API_TOKEN no .env.");
  }
  // TODO: implementar conforme a API de faturamento/notas do ERP D9.
  return { total: 0, qtdNotas: 0, qtdItens: 0, porSCP: [], porProduto: [], porNota: [] };
}
