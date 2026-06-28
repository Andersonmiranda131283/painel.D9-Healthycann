/**
 * CONTRATO DE DADOS DO PAINEL
 * ----------------------------------------------------------------------------
 * Tudo que o painel (painel-financeiro.jsx → GET /api/financeiro) espera receber.
 * Qualquer provider de ERP (mock, D9, etc.) deve devolver um objeto com este
 * formato. Mantenha os NOMES dos campos — o painel lê por nome.
 *
 * A Healthycann NÃO usa SCP, então `projetos`, `scpsDisponiveis` e `escopo`
 * ficam vazios/nulos. Eles continuam no contrato só para o painel (herdado do
 * molde painel-omie) não quebrar.
 *
 *   {
 *     nome: "Healthycann",
 *     periodo: "01/01/2025 a 31/12/2025 — dados ERP D9",
 *     balanco: { caixa, contasReceber, fornecedores, estoques, imobilizado,
 *                intangivel, emprestimosCP, obrigacoes, emprestimosLP,
 *                patrimonioLiquido },
 *     dre: { receitaBruta, deducoes, receitaLiquida, cmv, lucroBruto,
 *            despesasOper, ebitda, depreciacao, ebit, resultadoFinanceiro,
 *            lair, impostos, lucroLiquido },
 *     serieMensal: [{ mes, receita, custos }],          // R$ cheios
 *     contas: { receber: ListaTitulos, pagar: ListaTitulos },
 *     porCategoria: [{ codigo, nome, receita, despesa, resultado, aReceber, aPagar }],
 *     categoriasMensal: [{ codigo, nome, valores:[12], total }],
 *     dreMensal: [{ mes, receitaBruta, deducoes, receitaLiquida, cmv,
 *                   lucroBruto, despesasOper, ebitda, depreciacao, ebit,
 *                   impostos, lucroLiquido }],
 *     premissas: { aliqDeducoes, aliqImpostos },
 *     projetos: [],          // sem SCP
 *     scpsDisponiveis: [],   // sem SCP
 *     escopo: null,          // sem SCP
 *   }
 *
 * ListaTitulos = { itens:[{ tipo, titulo, parceiro, categoria, vencimento,
 *                           valor, pago, aberto, status }],
 *                  truncada, total, qtdAbertas, qtdPagas, totalAberto, totalPago }
 */

/** Completa um DRE a partir das linhas-base, calculando os derivados. */
export function montarDRE({
  receitaBruta = 0,
  deducoes = 0,
  cmv = 0,
  despesasOper = 0,
  depreciacao = 0,
  resultadoFinanceiro = 0,
  aliqImpostos = 0.34,
}) {
  const receitaLiquida = receitaBruta - deducoes;
  const lucroBruto = receitaLiquida - cmv;
  const ebitda = lucroBruto - despesasOper;
  const ebit = ebitda - depreciacao;
  const lair = ebit + resultadoFinanceiro;
  const impostos = Math.max(0, lair * aliqImpostos);
  const lucroLiquido = lair - impostos;
  return {
    receitaBruta, deducoes, receitaLiquida, cmv, lucroBruto, despesasOper,
    ebitda, depreciacao, ebit, resultadoFinanceiro, lair, impostos, lucroLiquido,
  };
}

/** Esqueleto vazio do contrato — base segura para um provider preencher. */
export function contratoVazio(nome = "Healthycann") {
  return {
    nome,
    periodo: "",
    balanco: {
      caixa: 0, contasReceber: 0, fornecedores: 0, estoques: 0, imobilizado: 0,
      intangivel: 0, emprestimosCP: 0, obrigacoes: 0, emprestimosLP: 0,
      patrimonioLiquido: 0,
    },
    dre: montarDRE({}),
    serieMensal: [],
    contas: { receber: listaVazia(), pagar: listaVazia() },
    porCategoria: [],
    categoriasMensal: [],
    dreMensal: [],
    premissas: { aliqDeducoes: 0.15, aliqImpostos: 0.34 },
    projetos: [],          // Healthycann não tem SCP
    scpsDisponiveis: [],   // idem
    escopo: null,          // idem
  };
}

export function listaVazia() {
  return {
    itens: [], truncada: false, total: 0, qtdAbertas: 0, qtdPagas: 0,
    totalAberto: 0, totalPago: 0,
  };
}

/** Resume uma lista de títulos nos totais que o painel mostra. */
export function resumirLista(itens) {
  const abertas = itens.filter((t) => (t.aberto || 0) > 0);
  const pagas = itens.filter((t) => (t.aberto || 0) <= 0);
  return {
    itens,
    truncada: false,
    total: itens.length,
    qtdAbertas: abertas.length,
    qtdPagas: pagas.length,
    totalAberto: abertas.reduce((s, t) => s + (t.aberto || 0), 0),
    totalPago: pagas.reduce((s, t) => s + (t.pago || 0), 0),
  };
}
