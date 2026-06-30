/**
 * PROVIDER MOCK — dados de exemplo de operação da Healthycann (pedidos).
 *
 * Mesmo formato que o provider real (D9Pro), para ver o painel ao vivo sem o
 * ERP. Ative com ERP_PROVIDER=mock. Números fictícios.
 */
import { agregarPedidos } from "./contrato.js";

export const nome = "mock";
export const configurado = true;

const STATUS = {
  "1": "Analisando receita",
  "8": "Pago",
  "14": "Verificando Documentação",
  "16": "Entregue",
};
const GRUPOS = ["Comum", "Renovação", "Anuidade"];
const CIDADES = [
  ["São Paulo", "SP"], ["Rio de Janeiro", "RJ"], ["Belo Horizonte", "MG"],
  ["Curitiba", "PR"], ["Porto Alegre", "RS"], ["Salvador", "BA"],
];
const NOMES = ["Ester R.", "Marcos A.", "Paula M.", "João S.", "Carla T.", "Bruno L.", "Aline F.", "Rafael C."];

// Gera ~120 pedidos espalhados em 6 meses, de forma determinística (sem random).
function pedidosExemplo() {
  const out = [];
  let id = 500;
  for (let mes = 1; mes <= 6; mes++) {
    const qtd = 14 + ((mes * 7) % 9); // varia por mês
    for (let i = 0; i < qtd; i++) {
      const dia = 1 + ((i * 3 + mes) % 27);
      const total = 180 + ((i * 37 + mes * 53) % 9) * 60 + (i % 4) * 45;
      const [cidade, uf] = CIDADES[(i + mes) % CIDADES.length];
      const oSId = ["1", "8", "14", "16"][(i + mes) % 4];
      const mm = String(mes).padStart(2, "0");
      const dd = String(dia).padStart(2, "0");
      out.push({
        orderId: String(id++),
        total,
        frete: 0,
        oSId,
        status: STATUS[oSId],
        grupo: GRUPOS[(i + mes) % GRUPOS.length],
        cliente: NOMES[(i + mes * 2) % NOMES.length],
        cidade, uf,
        rastreio: oSId === "16" ? "BR123456785BR" : "",
        chaveMes: `2026-${mm}`,
        dataBR: `${dd}/${mm}/2026`,
        chaveOrd: `2026-${mm}-${dd} 12:00:00`,
      });
    }
  }
  return out;
}

export async function operacao({ inicio, fim } = {}) {
  const agregado = agregarPedidos(pedidosExemplo(), STATUS);
  return {
    nome: "Healthycann",
    periodo: `${inicio || "01/01/2026"} a ${fim || "30/06/2026"} — dados de exemplo (mock)`,
    ...agregado,
  };
}

export async function produtos() {
  return {
    itens: [
      { pId: "1", nome: "Óleo Full Spectrum 30 mL", imagem: "", preco: 300, custo: 120, margem: 0.6, regras: 2 },
      { pId: "2", nome: "Óleo Isolado 30 mL", imagem: "", preco: 250, custo: 100, margem: 0.6, regras: 2 },
      { pId: "3", nome: "Cápsulas 60 un", imagem: "", preco: 200, custo: 90, margem: 0.55, regras: 1 },
      { pId: "6", nome: "Anuidade", imagem: "", preco: 150, custo: 0, margem: 1, regras: 1 },
    ],
  };
}

export async function resumo({ inicio, fim } = {}) {
  return {
    nome: "Healthycann",
    periodo: `${inicio || "01/01/2026"} a ${fim || "30/06/2026"} — dados de exemplo (mock)`,
    kpis: { clientes: 2566, prescritores: 1091, pedidosPeriodo: 315, emTransito: 222 },
    ultimosPedidos: [
      { orderId: "5493", cliente: "Maria Eduarda Couto", cidade: "Itajaí", uf: "SC", data: "26/06/2026", status: "Pago" },
      { orderId: "5492", cliente: "Julia Kovacs", cidade: "São José", uf: "SC", data: "26/06/2026", status: "Entregue" },
      { orderId: "5491", cliente: "Patricia Costa de Oliveira", cidade: "Campo Grande", uf: "MS", data: "26/06/2026", status: "Analisando receita" },
      { orderId: "5490", cliente: "João Mauricio Leite", cidade: "Patos", uf: "PB", data: "26/06/2026", status: "Em trânsito" },
    ],
    ultimosClientes: [
      { id: "3828", nome: "João Mauricio Leite Torres", cidade: "Patos", uf: "PB" },
      { id: "3827", nome: "Patricia Costa de Oliveira Campos", cidade: "Campo Grande", uf: "MS" },
      { id: "3826", nome: "Julia Kovacs", cidade: "São José", uf: "SC" },
      { id: "3825", nome: "Larissa Librelato", cidade: "Itajaí", uf: "SC" },
    ],
    avisos: [],
  };
}

export async function vendas({ inicio, fim } = {}) {
  const base = [
    { nome: "HC FULL SPECTRUM (3000mg CBD)", sku: "FS3000", quantidade: 158, faturamento: 75830, custo: 9925, pedidos: 78, ticketMedio: 972 },
    { nome: "HC BLISS (Delta 9: 10mg) GUMMY", sku: "BL10", quantidade: 268, faturamento: 67324, custo: 16327, pedidos: 91, ticketMedio: 740 },
    { nome: "HC FULL SPECTRUM (1500mg CBD)", sku: "FS1500", quantidade: 157, faturamento: 47558, custo: 9285, pedidos: 49, ticketMedio: 971 },
    { nome: "HC PLUS+", sku: "PL2000", quantidade: 72, faturamento: 29452, custo: 5967, pedidos: 23, ticketMedio: 1281 },
    { nome: "HC FULL SPECTRUM NEW (6000mg CBD)", sku: "FS6000NEW", quantidade: 45, faturamento: 28860, custo: 5119, pedidos: 23, ticketMedio: 1255 },
  ];
  const produtos = base.map((p) => ({ ...p, lucro: p.faturamento - p.custo, margem: (p.faturamento - p.custo) / p.faturamento }));
  const faturamento = produtos.reduce((s, p) => s + p.faturamento, 0);
  const custo = produtos.reduce((s, p) => s + p.custo, 0);
  const pedidos = 264;
  const porMes = [
    { chave: "2026-04", mes: "Abr/26", valor: 96000, qtd: 280, variacao: null },
    { chave: "2026-05", mes: "Mai/26", valor: 112000, qtd: 320, variacao: 0.1667 },
    { chave: "2026-06", mes: "Jun/26", valor: 353513, qtd: 981, variacao: 2.156 },
  ];
  return {
    nome: "Healthycann",
    periodo: `${inicio || "01/06/2026"} a ${fim || "30/06/2026"} — dados de exemplo (mock)`,
    resumo: { faturamento, custo, lucro: faturamento - custo, margem: (faturamento - custo) / faturamento, pedidos, itensVendidos: produtos.reduce((s, p) => s + p.quantidade, 0), ticketMedio: faturamento / pedidos, metaMensal: 400000 },
    produtos, porMes,
    porDia: [{ chave: "2026-06-01", valor: 4995, qtd: 10 }, { chave: "2026-06-02", valor: 6200, qtd: 14 }, { chave: "2026-06-03", valor: 5400, qtd: 12 }],
    porGrupo: [{ grupo: "Comum", valor: 325326, qtd: 295 }, { grupo: "Armazém", valor: 27313, qtd: 7 }, { grupo: "Comissão", valor: 874, qtd: 8 }],
    porCidade: [
      { cidade: "Balneário Camboriú", valor: 33923, qtd: 33 }, { cidade: "São Paulo", valor: 33596, qtd: 33 },
      { cidade: "Itajaí", valor: 28414, qtd: 19 }, { cidade: "Rio de Janeiro", valor: 16216, qtd: 19 }, { cidade: "Itapema", valor: 10321, qtd: 7 },
    ],
    porEstado: [
      { uf: "SC", valor: 116239, qtd: 102 }, { uf: "SP", valor: 77142, qtd: 68 },
      { uf: "MG", valor: 61700, qtd: 43 }, { uf: "RJ", valor: 40348, qtd: 40 }, { uf: "PR", valor: 10607, qtd: 12 },
    ],
    porPagamento: [
      { forma: "Cartão de crédito", valor: 205055, qtd: 169 },
      { forma: "Não informado", valor: 146534, qtd: 145 },
      { forma: "Boleto", valor: 1924, qtd: 2 },
    ],
    porPrescritor: [
      { nome: "Tatiana A. P. Moraes", valor: 35107, qtd: 20 },
      { nome: "Fernando B. Aparecido", valor: 32328, qtd: 32 },
      { nome: "Maria Cecilia I. Barbosa", valor: 25592, qtd: 21 },
    ],
  };
}

export async function comissoes({ inicio, fim } = {}) {
  const porOperador = [
    { nome: "Bruno L.", valor: 8200 },
    { nome: "Aline F.", valor: 6450 },
    { nome: "Rafael C.", valor: 5100 },
    { nome: "Carla T.", valor: 3980 },
  ];
  const total = porOperador.reduce((s, o) => s + o.valor, 0);
  const itens = porOperador.map((o, i) => ({
    Operador: o.nome, Pedidos: String(12 - i * 2), Comissão: o.valor.toFixed(2).replace(".", ","),
  }));
  return {
    total, qtd: itens.length, porOperador,
    colunas: ["Operador", "Pedidos", "Comissão"],
    colValor: "Comissão", colOper: "Operador",
    itens, aviso: null,
  };
}
