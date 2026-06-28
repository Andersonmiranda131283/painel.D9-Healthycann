/**
 * PROVIDER MOCK — dados de exemplo da Healthycann (sem SCP).
 *
 * Serve para ver o painel funcionando ponta a ponta pelo caminho "ao vivo"
 * (GET /api/financeiro) sem precisar do ERP real. Ative com ERP_PROVIDER=mock.
 *
 * Os números são fictícios e só ilustram o formato do contrato — troque pelo
 * provider real (erp/d9.js) quando a API do ERP D9 estiver disponível.
 */
import { montarDRE, resumirLista } from "./contrato.js";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export const nome = "mock";
export const configurado = true;

export async function financeiro({ inicio, fim } = {}) {
  const aliqDeducoes = 0.15;
  const aliqImpostos = 0.34;

  const dre = montarDRE({
    receitaBruta: 4200000,
    deducoes: 630000,
    cmv: 1880000,
    despesasOper: 980000,
    depreciacao: 160000,
    resultadoFinanceiro: 90000,
    aliqImpostos,
  });

  const receber = resumirLista([
    { tipo:"receber", titulo:"NF 2042", parceiro:"Farmácia Vida Verde", categoria:"Vendas de produto", vencimento:"10/07/2025", valor:52000, pago:0, aberto:52000, status:"ABERTO" },
    { tipo:"receber", titulo:"NF 2031", parceiro:"Clínica Bem-Estar", categoria:"Vendas de produto", vencimento:"02/06/2025", valor:28500, pago:0, aberto:28500, status:"ATRASADO" },
    { tipo:"receber", titulo:"NF 2018", parceiro:"Distribuidora Cannamed", categoria:"Vendas de produto", vencimento:"15/05/2025", valor:71000, pago:71000, aberto:0, status:"PAGO" },
  ]);
  const pagar = resumirLista([
    { tipo:"pagar", titulo:"BOL 9841", parceiro:"Fornecedor Insumos SA", categoria:"Matéria-prima", vencimento:"08/07/2025", valor:34000, pago:0, aberto:34000, status:"ABERTO" },
    { tipo:"pagar", titulo:"BOL 9790", parceiro:"Energia SA", categoria:"Despesas administrativas", vencimento:"28/05/2025", valor:9800, pago:0, aberto:9800, status:"ATRASADO" },
    { tipo:"pagar", titulo:"BOL 9702", parceiro:"Locadora Predial", categoria:"Aluguel", vencimento:"05/05/2025", valor:14000, pago:14000, aberto:0, status:"PAGO" },
  ]);

  const serieMensal = [
    { mes:"Jan", receita:300, custos:235 }, { mes:"Fev", receita:312, custos:240 },
    { mes:"Mar", receita:355, custos:262 }, { mes:"Abr", receita:340, custos:255 },
    { mes:"Mai", receita:328, custos:248 }, { mes:"Jun", receita:345, custos:258 },
    { mes:"Jul", receita:360, custos:268 }, { mes:"Ago", receita:372, custos:272 },
    { mes:"Set", receita:351, custos:260 }, { mes:"Out", receita:380, custos:280 },
    { mes:"Nov", receita:333, custos:252 }, { mes:"Dez", receita:324, custos:246 },
  ].map((m) => ({ mes: m.mes, receita: m.receita * 1000, custos: m.custos * 1000 }));

  const porCategoria = [
    { codigo:"1.01.01", nome:"Vendas de produto", receita:380000, despesa:0, resultado:380000, aReceber:80500, aPagar:0 },
    { codigo:"2.04.01", nome:"Salários e encargos", receita:0, despesa:142000, resultado:-142000, aReceber:0, aPagar:0 },
    { codigo:"2.01.01", nome:"Matéria-prima", receita:0, despesa:120000, resultado:-120000, aReceber:0, aPagar:34000 },
    { codigo:"2.02.01", nome:"Despesas administrativas", receita:0, despesa:96000, resultado:-96000, aReceber:0, aPagar:9800 },
    { codigo:"2.03.01", nome:"Aluguel", receita:0, despesa:48000, resultado:-48000, aReceber:0, aPagar:0 },
  ];

  const categoriasMensal = [
    { codigo:"2.04.01", nome:"Salários e encargos", valores:[110,112,118,115,119,121,119,124,122,120,116,114] },
    { codigo:"2.01.01", nome:"Matéria-prima",       valores:[88,90,95,92,95,110,88,102,120,105,96,93] },
    { codigo:"2.02.01", nome:"Despesas administrativas", valores:[28,29,30,31,30,28,34,31,29,32,30,29] },
    { codigo:"2.03.01", nome:"Aluguel",             valores:[14,14,14,14,14,14,14,14,14,14,14,14] },
  ].map((c) => {
    const valores = c.valores.map((v) => v * 1000);
    return { ...c, valores, total: valores.reduce((s, v) => s + v, 0) };
  });

  const dreMensal = MESES.map((mes, i) => {
    const receitaBruta = serieMensal[i].receita;
    const cmv = serieMensal[i].custos * 0.62;
    const despesasOper = serieMensal[i].custos * 0.30;
    return { mes, ...montarDRE({ receitaBruta, deducoes: receitaBruta * aliqDeducoes, cmv, despesasOper, depreciacao: 13000, aliqImpostos }) };
  });

  return {
    nome: "Healthycann",
    periodo: `${inicio || "01/01/2025"} a ${fim || "31/12/2025"} — dados de exemplo (mock)`,
    balanco: {
      caixa: 360000, contasReceber: 680000, estoques: 520000,
      imobilizado: 1200000, intangivel: 180000,
      fornecedores: 410000, emprestimosCP: 260000, obrigacoes: 190000,
      emprestimosLP: 600000, patrimonioLiquido: 1480000,
    },
    dre,
    serieMensal,
    contas: { receber, pagar },
    porCategoria,
    categoriasMensal,
    dreMensal,
    premissas: { aliqDeducoes, aliqImpostos },
    projetos: [],          // Healthycann não tem SCP
    scpsDisponiveis: [],
    escopo: null,
  };
}

export async function vendas({ inicio, fim } = {}) {
  return {
    total: 380000,
    qtdNotas: 24,
    qtdItens: 96,
    porSCP: [],            // sem SCP
    porProduto: [
      { sku:"HC-001", descricao:"Óleo Full Spectrum 30ml", faturamento:180000, quantidade:600, valorUnit:300, inativo:false },
      { sku:"HC-002", descricao:"Óleo Isolado 30ml", faturamento:120000, quantidade:480, valorUnit:250, inativo:false },
      { sku:"HC-003", descricao:"Cápsulas 60un", faturamento:80000, quantidade:400, valorUnit:200, inativo:false },
    ],
    porNota: [],
  };
}
