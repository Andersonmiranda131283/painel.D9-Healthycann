/**
 * SELETOR DE PROVIDER DE ERP
 * ----------------------------------------------------------------------------
 * Escolhe de onde vêm os dados do painel, na ordem:
 *
 *   1. ERP_PROVIDER=mock  → provider de exemplo (erp/mock.js).
 *   2. ERP_PROVIDER=d9    → ERP real da D9 (erp/d9.js), se configurado.
 *   3. (padrão) usa o ERP D9 se ele estiver configurado (D9_API_URL + token);
 *      senão fica "não configurado" e o servidor responde 503 — o painel então
 *      mostra os dados de exemplo embutidos.
 *
 * Para acrescentar outra integração (planilha, outro ERP), crie erp/<nome>.js
 * com a mesma interface { nome, configurado, financeiro(), vendas() } e
 * registre aqui.
 */
import * as mock from "./mock.js";
import * as d9 from "./d9.js";

const PROVIDERS = { mock, d9 };

export function escolherProvider() {
  const escolhido = (process.env.ERP_PROVIDER || "").trim().toLowerCase();

  if (escolhido && PROVIDERS[escolhido]) return PROVIDERS[escolhido];

  // Padrão: D9 real se configurado; senão, "não configurado" (painel usa exemplo).
  if (d9.configurado) return d9;
  return d9; // continua devolvendo o d9 (não configurado) → 503 controlado
}

export const provider = escolherProvider();
