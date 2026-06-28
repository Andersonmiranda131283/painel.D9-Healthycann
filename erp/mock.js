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
      { pId: "1", nome: "Óleo Full Spectrum 30 mL", imagem: "", preco: 300, custo: 120, margem: 0.6 },
      { pId: "2", nome: "Óleo Isolado 30 mL", imagem: "", preco: 250, custo: 100, margem: 0.6 },
      { pId: "3", nome: "Cápsulas 60 un", imagem: "", preco: 200, custo: 90, margem: 0.55 },
      { pId: "6", nome: "Anuidade", imagem: "", preco: 150, custo: 0, margem: 1 },
    ],
  };
}
