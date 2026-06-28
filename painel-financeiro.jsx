import React, { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";

/* ============================================================
   CAMADA DE DADOS
   O painel consome o conector do ERP D9 (GET /api/financeiro). Enquanto a
   API não responde — ou se ela falhar — usa-se o objeto de exemplo
   abaixo como fallback, então a tela nunca fica em branco.

   Defina a URL do conector aqui (ou via window.PAINEL_API_URL).
   ============================================================ */
const API_URL =
  (typeof window !== "undefined" && (window.PAINEL_API_URL || window.OMIE_API_URL)) ||
  "/api/financeiro";
// Endpoint separado das Vendas (deriva do API_URL trocando /financeiro por /vendas).
const VENDAS_URL = API_URL.replace(/financeiro(\?.*)?$/, "vendas");

const empresaExemplo = {
  nome: "Healthycann",
  periodo: "Exercício 2025 — dados de exemplo",
  // Balanço Patrimonial (R$)
  balanco: {
    caixa: 480000, contasReceber: 920000, estoques: 650000,
    imobilizado: 1800000, intangivel: 250000,
    fornecedores: 540000, emprestimosCP: 380000, obrigacoes: 280000,
    emprestimosLP: 900000, patrimonioLiquido: 2000000,
  },
  // DRE (R$ / ano)
  dre: {
    receitaBruta: 6800000, deducoes: 1020000, receitaLiquida: 5780000,
    cmv: 3180000, lucroBruto: 2600000, despesasOper: 1560000,
    depreciacao: 260000, ebit: 1040000, ebitda: 1300000,
    resultadoFinanceiro: 180000, lair: 860000, impostos: 292400,
    lucroLiquido: 567600,
  },
};

// Série de exemplo (12 meses) — usada como fallback quando não há dados ao vivo
const serieMensalExemplo = [
  { mes:"Jan", receita:430, custos:355 }, { mes:"Fev", receita:445, custos:360 },
  { mes:"Mar", receita:512, custos:395 }, { mes:"Abr", receita:498, custos:388 },
  { mes:"Mai", receita:470, custos:372 }, { mes:"Jun", receita:455, custos:368 },
  { mes:"Jul", receita:488, custos:380 }, { mes:"Ago", receita:520, custos:398 },
  { mes:"Set", receita:505, custos:392 }, { mes:"Out", receita:540, custos:410 },
  { mes:"Nov", receita:468, custos:375 }, { mes:"Dez", receita:449, custos:362 },
].map(m => ({ ...m, resultado: m.receita - m.custos }));

// Contas e projetos de exemplo — usados quando não há dados ao vivo
const contasExemplo = {
  receber: {
    itens: [
      { tipo:"receber", titulo:"NF 1042", parceiro:"Cliente Alfa Ltda", categoria:"Vendas de serviço", projeto:"SCP Aurora", vencimento:"10/07/2025", valor:48000, pago:0, aberto:48000, status:"ABERTO" },
      { tipo:"receber", titulo:"NF 1031", parceiro:"Beta Comércio", categoria:"Vendas de serviço", projeto:"SCP Órion", vencimento:"02/06/2025", valor:22500, pago:0, aberto:22500, status:"ATRASADO" },
      { tipo:"receber", titulo:"NF 1018", parceiro:"Gama S.A.", categoria:"Vendas de produto", projeto:"SCP Aurora", vencimento:"15/05/2025", valor:65000, pago:65000, aberto:0, status:"PAGO" },
    ],
    truncada:false, total:3, qtdAbertas:2, qtdPagas:1, totalAberto:70500, totalPago:65000,
  },
  pagar: {
    itens: [
      { tipo:"pagar", titulo:"BOL 8841", parceiro:"Fornecedor Delta", categoria:"Matéria-prima", projeto:"SCP Aurora", vencimento:"08/07/2025", valor:31000, pago:0, aberto:31000, status:"ABERTO" },
      { tipo:"pagar", titulo:"BOL 8790", parceiro:"Energia SA", categoria:"Despesas administrativas", projeto:"", vencimento:"28/05/2025", valor:9400, pago:0, aberto:9400, status:"ATRASADO" },
      { tipo:"pagar", titulo:"BOL 8702", parceiro:"Locadora Epsilon", categoria:"Aluguel", projeto:"", vencimento:"05/05/2025", valor:12000, pago:12000, aberto:0, encargos:340, status:"PAGO" },
    ],
    truncada:false, total:3, qtdAbertas:2, qtdPagas:1, totalAberto:40400, totalPago:12000, totalEncargos:340,
  },
};
const projetosExemplo = [
  { codigo:1, nome:"SCP Aurora", receita:320000, despesa:185000, resultado:135000, aReceber:96000, aPagar:42000,
    dre:{ receitaBruta:320000, deducoes:48000, receitaLiquida:272000, cmv:120000, lucroBruto:152000, despesasOper:65000, ebitda:87000 } },
  { codigo:2, nome:"SCP Órion", receita:180000, despesa:142000, resultado:38000, aReceber:22500, aPagar:18000,
    dre:{ receitaBruta:180000, deducoes:27000, receitaLiquida:153000, cmv:90000, lucroBruto:63000, despesasOper:52000, ebitda:11000 } },
  { codigo:null, nome:"Health Importer (não alocado)", receita:90000, despesa:120000, resultado:-30000, aReceber:8000, aPagar:31000,
    dre:{ receitaBruta:90000, deducoes:13500, receitaLiquida:76500, cmv:40000, lucroBruto:36500, despesasOper:80000, ebitda:-43500 } },
];
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const dreMensalExemplo = ["Mai","Jun","Jul","Ago","Set"].map((mes, i) => {
  const receitaBruta = [980,1010,1180,1240,1090][i] * 1000;
  const cmv = [430,450,520,560,470][i] * 1000;
  const despesasOper = [250,260,300,290,270][i] * 1000;
  const deducoes = receitaBruta * 0.15;
  const receitaLiquida = receitaBruta - deducoes;
  const lucroBruto = receitaLiquida - cmv;
  const ebitda = lucroBruto - despesasOper;
  const depreciacao = 52000;
  const ebit = ebitda - depreciacao;
  const impostos = Math.max(0, ebit * 0.34);
  return { mes, receitaBruta, deducoes, receitaLiquida, cmv, lucroBruto, despesasOper, ebitda,
    depreciacao, ebit, impostos, lucroLiquido: ebit - impostos };
});
const categoriasMensalExemplo = [
  { codigo:"2.04.01", nome:"Salários e encargos", valores:[0,0,0,0,118,121,119,124,122,0,0,0], total:724 },
  { codigo:"2.01.01", nome:"Matéria-prima",       valores:[0,0,0,0,95,110,88,102,120,0,0,0], total:615 },
  { codigo:"2.02.01", nome:"Despesas administrativas", valores:[0,0,0,0,30,28,34,31,29,0,0,0], total:152 },
  { codigo:"2.03.01", nome:"Aluguel",             valores:[0,0,0,0,16,16,16,16,16,0,0,0], total:80 },
].map(c => ({ ...c, valores: c.valores.map(v => v * 1000), total: c.total * 1000 }));
const categoriasExemplo = [
  { codigo:"1.01.01", nome:"Vendas de serviço", receita:380000, despesa:0, resultado:380000, aReceber:70500, aPagar:0 },
  { codigo:"2.04.01", nome:"Salários e encargos", receita:0, despesa:142000, resultado:-142000, aReceber:0, aPagar:0 },
  { codigo:"2.01.01", nome:"Matéria-prima", receita:0, despesa:120000, resultado:-120000, aReceber:0, aPagar:31000 },
  { codigo:"2.02.01", nome:"Despesas administrativas", receita:0, despesa:96000, resultado:-96000, aReceber:0, aPagar:9400 },
  { codigo:"2.03.01", nome:"Aluguel", receita:0, despesa:48000, resultado:-48000, aReceber:0, aPagar:0 },
  { codigo:"1.02.01", nome:"Vendas de produto", receita:90000, despesa:0, resultado:90000, aReceber:8000, aPagar:0 },
];

/* ============================================================
   FORMATADORES
   ============================================================ */
const brl = (v) => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 });
const brlK = (v) => "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits:0 });
const pct = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits:1, maximumFractionDigits:1 }) + "%";
const mult = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 }) + "×";
const dias = (v) => Math.round(v) + " dias";
const parseBR = (s) => { const [d, m, a] = String(s || "").split("/").map(Number); return a ? new Date(a, m - 1, d) : null; };
// Selo de status p/ os cards (1 = saudável, 0 = atenção, -1 = crítico)
const st = (cond) => cond === 1 ? { t: "ok", l: "Saudável" } : cond === 0 ? { t: "mid", l: "Atenção" } : { t: "at", l: "Crítico" };

/* ---------- logout (HTTP Basic): sobrescreve a credencial em cache e recarrega ---------- */
function sair() {
  fetch(API_URL, { headers: { Authorization: "Basic " + btoa("sair:" + Date.now()) }, cache: "no-store" })
    .catch(() => {})
    .finally(() => window.location.reload());
}

/* ---------- aging: distribui o que está em aberto por faixa de vencimento ---------- */
const FAIXAS = [
  { id: "vencidas", nome: "Vencidas" }, { id: "d7", nome: "0–7 dias" },
  { id: "d30", nome: "8–30 dias" }, { id: "d60", nome: "31–60 dias" },
  { id: "d60p", nome: "60+ dias" },
];
function faixaVenc(venc) {
  const d = parseBR(venc); if (!d) return null;
  const h = new Date();
  const dd = Math.round((d - new Date(h.getFullYear(), h.getMonth(), h.getDate())) / 86400000);
  return dd < 0 ? "vencidas" : dd <= 7 ? "d7" : dd <= 30 ? "d30" : dd <= 60 ? "d60" : "d60p";
}
// Período imediatamente anterior, de mesma duração (para comparativos)
function periodoAnterior(inicioBR, fimBR) {
  const ini = parseBR(inicioBR), fim = parseBR(fimBR);
  if (!ini || !fim) return null;
  const umDia = 86400000;
  const dias = Math.max(0, Math.round((fim - ini) / umDia));
  const prevFim = new Date(ini.getTime() - umDia);
  const prevIni = new Date(prevFim.getTime() - dias * umDia);
  return { inicio: fmtBR(prevIni), fim: fmtBR(prevFim) };
}
// Variação percentual atual × anterior (null quando não dá para comparar)
function variacaoPct(atual, anterior) {
  if (anterior == null || anterior === 0 || !Number.isFinite(anterior)) return null;
  return (atual - anterior) / Math.abs(anterior) * 100;
}

// Vencimento dentro do intervalo (datas ISO "aaaa-mm-dd"; vazio = sem limite)
function dentroData(venc, deISO, ateISO) {
  if (!deISO && !ateISO) return true;
  const d = parseBR(venc); if (!d) return false;
  const mk = (iso) => { const [a, m, dd] = iso.split("-").map(Number); return new Date(a, m - 1, dd); };
  if (deISO && d < mk(deISO)) return false;
  if (ateISO) { const ate = mk(ateISO); ate.setHours(23, 59, 59); if (d > ate) return false; }
  return true;
}

function montarAging(contas) {
  const zero = () => Object.fromEntries(FAIXAS.map((f) => [f.id, 0]));
  const rec = zero(), pag = zero();
  const aberto = (i) => i.status === "ABERTO" || i.status === "ATRASADO";
  for (const i of contas?.receber?.itens || []) if (aberto(i)) { const f = faixaVenc(i.vencimento); if (f) rec[f] += i.aberto; }
  for (const i of contas?.pagar?.itens || []) if (aberto(i)) { const f = faixaVenc(i.vencimento); if (f) pag[f] += i.aberto; }
  return FAIXAS.map((f) => ({ nome: f.nome, "A receber": Math.round(rec[f.id]), "A pagar": Math.round(pag[f.id]) }));
}

/* ---------- período (datas dd/mm/aaaa ↔ yyyy-mm-dd do <input type=date>) ---------- */
const fmtBR = (date) => date.toLocaleDateString("pt-BR");
const brParaISO = (br) => {
  const [d, m, a] = String(br || "").split("/");
  return a ? `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "";
};
const isoParaBR = (iso) => {
  const [a, m, d] = String(iso || "").split("-");
  return d ? `${d}/${m}/${a}` : "";
};
// Atalhos de período, calculados a partir de hoje.
function presetsPeriodo() {
  const hoje = new Date();
  const y = hoje.getFullYear(), mo = hoje.getMonth();
  return [
    { id: "mes", nome: "Mês atual", inicio: fmtBR(new Date(y, mo, 1)), fim: fmtBR(hoje) },
    { id: "mesPassado", nome: "Mês passado", inicio: fmtBR(new Date(y, mo - 1, 1)), fim: fmtBR(new Date(y, mo, 0)) },
    { id: "ano", nome: "Este ano", inicio: fmtBR(new Date(y, 0, 1)), fim: fmtBR(hoje) },
    { id: "doze", nome: "Últimos 12 meses", inicio: fmtBR(new Date(y, mo - 11, 1)), fim: fmtBR(hoje) },
  ];
}

/* ============================================================
   MOTOR DE INDICADORES — calcula tudo a partir do balanço + DRE
   ============================================================ */
// Divisão segura: 0 quando o denominador é 0/indefinido (evita NaN/Infinity,
// ex.: ao olhar uma SCP só de despesa, sem receita).
const sd = (a, b) => (b && Number.isFinite(a / b) ? a / b : 0);
function calcularIndicadores(e) {
  const b = e.balanco, d = e.dre;
  const ativoCirc = b.caixa + b.contasReceber + b.estoques;
  const passivoCirc = b.fornecedores + b.emprestimosCP + b.obrigacoes;
  const ativoTotal = ativoCirc + b.imobilizado + b.intangivel;
  const passivoTotal = passivoCirc + b.emprestimosLP;
  const dividaBruta = b.emprestimosCP + b.emprestimosLP;
  const dividaLiquida = dividaBruta - b.caixa;

  return {
    ativoCirc, passivoCirc, ativoTotal, passivoTotal, dividaBruta, dividaLiquida,
    liquidez: {
      corrente: sd(ativoCirc, passivoCirc),
      seca: sd(ativoCirc - b.estoques, passivoCirc),
      imediata: sd(b.caixa, passivoCirc),
      geral: sd(ativoCirc, passivoTotal),
    },
    rentabilidade: {
      margemBruta: sd(d.lucroBruto, d.receitaLiquida) * 100,
      margemEbitda: sd(d.ebitda, d.receitaLiquida) * 100,
      margemLiquida: sd(d.lucroLiquido, d.receitaLiquida) * 100,
      roe: sd(d.lucroLiquido, b.patrimonioLiquido) * 100,
      roa: sd(d.lucroLiquido, ativoTotal) * 100,
      roic: sd(d.ebit * 0.66, b.patrimonioLiquido + dividaBruta) * 100,
    },
    endividamento: {
      geral: sd(passivoTotal, ativoTotal) * 100,
      composicao: sd(passivoCirc, passivoTotal) * 100,
      imobilizacaoPL: sd(b.imobilizado, b.patrimonioLiquido) * 100,
      dlEbitda: sd(dividaLiquida, d.ebitda),
    },
    ciclo: {
      pmr: sd(b.contasReceber, d.receitaBruta) * 365,
      pme: sd(b.estoques, d.cmv) * 365,
      pmp: sd(b.fornecedores, d.cmv) * 365,
      get operacional() { return this.pmr + this.pme; },
      get caixa() { return this.pmr + this.pme - this.pmp; },
    },
  };
}

/* ============================================================
   SCORE DE SAÚDE FINANCEIRA (0–100) — composto e transparente
   ============================================================ */
function calcularSaude(ind) {
  const banda = (v, ruim, bom) => {
    const r = (v - ruim) / (bom - ruim) * 100;
    return Number.isFinite(r) ? Math.max(0, Math.min(100, r)) : 0;
  };
  const sLiq = banda(ind.liquidez.corrente, 1.0, 2.0);
  const sEnd = banda(2.5 - ind.endividamento.dlEbitda, 0, 2.5); // menor dívida = melhor
  const sRent = banda(ind.rentabilidade.roe, 8, 25);
  const sCiclo = banda(90 - ind.ciclo.caixa, 0, 90); // ciclo menor = melhor
  const total = sLiq * 0.3 + sEnd * 0.25 + sRent * 0.30 + sCiclo * 0.15;
  return { total, sLiq, sEnd, sRent, sCiclo };
}

/* ============================================================
   PALETA / TOKENS
   ============================================================ */
const C = {
  ink:"#13212E", inkSoft:"#22384A", paper:"#F4F6F3", surface:"#FFFFFF",
  line:"#E1E6E0", emerald:"#0B7A55", emeraldSoft:"#13A06F", gold:"#B07D2B",
  brick:"#B23A2E", mute:"#65757F", paperLine:"#2E4456",
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
* { box-sizing: border-box; }
.fin-root {
  font-family:'Inter',system-ui,sans-serif; color:${C.ink};
  background:${C.paper}; min-height:100%; padding:0; line-height:1.5;
}
.fin-wrap { max-width:1100px; margin:0 auto; padding:0 20px 64px; }
.mono { font-family:'IBM Plex Mono',monospace; font-variant-numeric:tabular-nums; }
.disp { font-family:'Space Grotesk',sans-serif; }

/* Console / hero band */
.console { background:${C.ink}; color:#fff; border-radius:0 0 18px 18px;
  padding:26px 20px 30px; margin-bottom:24px; }
.console-inner { max-width:1100px; margin:0 auto; position:relative; }
.topo-acoes { position:absolute; top:0; right:0; display:flex; gap:8px; }
.sair-btn { background:rgba(255,255,255,.08);
  border:1px solid ${C.paperLine}; color:#CDD9E1; border-radius:8px; padding:7px 14px;
  font-size:12px; cursor:pointer; font-family:'Inter',sans-serif; white-space:nowrap; }
.sair-btn:hover { background:rgba(255,255,255,.18); color:#fff; }
.sair-btn[disabled] { opacity:.6; cursor:default; }
.console .eyebrow { font-family:'IBM Plex Mono',monospace; font-size:11px;
  letter-spacing:.18em; text-transform:uppercase; color:#7FA8C0; }
.console h1 { font-family:'Space Grotesk',sans-serif; font-weight:600;
  font-size:26px; margin:6px 0 2px; }
.console .periodo { color:#8FA5B2; font-size:13px; }
.vitals { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  gap:1px; background:${C.paperLine}; border:1px solid ${C.paperLine};
  border-radius:12px; overflow:hidden; margin-top:22px; }
.vital { background:${C.ink}; padding:14px 16px; }
.vital .k { font-size:11px; color:#8FA5B2; letter-spacing:.04em; }
.vital .v { font-family:'IBM Plex Mono',monospace; font-size:21px; font-weight:500;
  margin-top:4px; letter-spacing:-.01em; }
.vital .v.pos { color:#43C796; } .vital .v.neg { color:#E8826F; }

/* Seletor de período */
.periodo-bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:16px; }
.periodo-bar .preset { background:${C.inkSoft}; border:1px solid ${C.paperLine};
  color:#CDD9E1; border-radius:8px; padding:6px 12px; font-size:12px; cursor:pointer;
  font-family:'Inter',sans-serif; }
.periodo-bar .preset:hover { background:${C.paperLine}; color:#fff; }
.periodo-bar .preset.on { background:${C.emerald}; border-color:${C.emerald}; color:#fff; }
.periodo-bar .campo { display:flex; align-items:center; gap:7px; background:${C.inkSoft};
  border:1px solid ${C.paperLine}; border-radius:8px; padding:5px 10px; }
.periodo-bar .campo label { font-size:10px; color:#8FA5B2; letter-spacing:.08em;
  text-transform:uppercase; }
.periodo-bar .campo input[type=date] { background:none; border:none; color:#fff;
  font-family:'IBM Plex Mono',monospace; font-size:12px; color-scheme:dark; padding:0; }

/* Seletor de SCP */
.scp-bar { display:flex; align-items:center; gap:10px; margin-top:12px; }
.scp-bar label { font-size:11px; color:#8FA5B2; letter-spacing:.08em; text-transform:uppercase; }
.scp-select { background:${C.inkSoft}; border:1px solid ${C.paperLine}; color:#fff;
  border-radius:8px; padding:7px 12px; font-family:'Inter',sans-serif; font-size:13px;
  cursor:pointer; color-scheme:dark; min-width:220px; }
.scp-aviso { margin-top:12px; background:rgba(176,125,43,.15); border:1px solid ${C.gold};
  color:#F0DCB6; border-radius:10px; padding:10px 14px; font-size:12px; line-height:1.5; }

/* Score gauge */
.scorebox { display:flex; align-items:center; gap:18px; margin-top:8px; flex-wrap:wrap; }
.gauge { position:relative; width:96px; height:96px; flex:none; }
.gauge .num { position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; }
.gauge .num b { font-family:'IBM Plex Mono',monospace; font-size:24px; line-height:1; }
.gauge .num span { font-size:9px; color:#8FA5B2; letter-spacing:.1em; margin-top:2px; }

/* Tabs */
.tabs { display:flex; gap:4px; border-bottom:1px solid ${C.line}; margin-bottom:22px;
  flex-wrap:wrap; }
.tab { font-family:'Space Grotesk',sans-serif; font-weight:500; font-size:14px;
  padding:11px 16px; border:none; background:none; color:${C.mute}; cursor:pointer;
  border-bottom:2px solid transparent; margin-bottom:-1px; }
.tab:hover { color:${C.ink}; }
.tab.on { color:${C.ink}; border-bottom-color:${C.emerald}; }

/* Cards */
.grid { display:grid; gap:14px; }
.g2 { grid-template-columns:repeat(2,1fr); }
.g3 { grid-template-columns:repeat(3,1fr); }
.g4 { grid-template-columns:repeat(4,1fr); }
.card { background:${C.surface}; border:1px solid ${C.line}; border-radius:12px;
  padding:16px 18px; }
.card .label { font-size:12px; color:${C.mute}; letter-spacing:.02em; }
.card .big { font-family:'IBM Plex Mono',monospace; font-size:23px; font-weight:500;
  margin-top:6px; letter-spacing:-.02em; }
.card .sub { font-size:11px; color:${C.mute}; margin-top:4px; }
.rule { height:2px; background:${C.line}; margin-top:10px; border-radius:2px; position:relative; }
.rule i { position:absolute; top:0; left:0; height:100%; border-radius:2px; }
.section-h { font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:15px;
  margin:26px 0 12px; display:flex; align-items:center; gap:8px; }
.section-h::before { content:''; width:10px; height:10px; background:${C.emerald};
  border-radius:2px; }
.tag { font-size:10px; font-weight:600; padding:2px 7px; border-radius:20px;
  letter-spacing:.03em; }
.tag.ok { background:#E3F3EC; color:${C.emerald}; }
.tag.at { background:#FBEAE7; color:${C.brick}; }
.tag.mid { background:#FBF3E3; color:${C.gold}; }
.tag.off { background:#ECEFEC; color:${C.mute}; text-decoration:line-through; }
.chart-card { background:${C.surface}; border:1px solid ${C.line}; border-radius:12px;
  padding:18px 14px 8px; }
.chart-title { font-family:'Space Grotesk',sans-serif; font-weight:500; font-size:14px;
  padding:0 6px 4px; }
.chart-sub { font-size:11px; color:${C.mute}; padding:0 6px 12px; }

/* Sliders (valuation) */
.controls { background:${C.surface}; border:1px solid ${C.line}; border-radius:12px;
  padding:18px; display:grid; gap:16px; }
.ctrl label { display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px; }
.ctrl label b { font-family:'IBM Plex Mono',monospace; color:${C.emerald}; }
.ctrl input[type=range] { width:100%; accent-color:${C.emerald}; }
.kpi-val { background:${C.ink}; color:#fff; border-radius:12px; padding:20px; text-align:center; }
.kpi-val .k { font-size:12px; color:#8FA5B2; letter-spacing:.05em; }
.kpi-val .v { font-family:'IBM Plex Mono',monospace; font-size:30px; font-weight:600; margin-top:6px; }
.note { font-size:12px; color:${C.mute}; margin-top:10px; line-height:1.6; }
table.dre { width:100%; border-collapse:collapse; font-size:13px; }
table.dre td { padding:9px 6px; border-bottom:1px solid ${C.line}; }
table.dre td.n { text-align:right; font-family:'IBM Plex Mono',monospace; }
table.dre tr.tot td { font-weight:600; background:#FAFBFA; }
table.dre tr.tot td.n { color:${C.emerald}; }
table.dre.lista th { text-align:left; font-size:11px; color:${C.mute}; font-weight:600;
  letter-spacing:.03em; text-transform:uppercase; padding:10px 12px; border-bottom:1px solid ${C.line};
  white-space:nowrap; }
table.dre.lista td { padding:9px 12px; white-space:nowrap; }
table.dre.lista th.n, table.dre.lista td.n { text-align:right; }
.filtro-bar { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px; }
.filtro-bar .preset { background:${C.surface}; border:1px solid ${C.line}; color:${C.mute};
  border-radius:8px; padding:6px 12px; font-size:12px; cursor:pointer; font-family:'Inter',sans-serif; }
.filtro-bar .preset:hover { color:${C.ink}; }
.filtro-bar .preset.on { background:${C.ink}; border-color:${C.ink}; color:#fff; }
.filtro-bar .preset.export { color:${C.emerald}; border-color:#CDE6DA; }
.filtro-bar .preset.export:hover { background:#E3F3EC; }
.preset.export[disabled] { opacity:.45; cursor:not-allowed; }
.section-h .preset.export { font-weight:500; }
.proj-select { font-family:'Inter',sans-serif; font-size:13px; color:${C.ink};
  background:${C.surface}; border:1px solid ${C.line}; border-radius:8px; padding:7px 10px;
  cursor:pointer; }
.orc-input { width:110px; text-align:right; font-family:'IBM Plex Mono',monospace; font-size:13px;
  color:${C.ink}; background:#FAFBFA; border:1px solid ${C.line}; border-radius:6px; padding:5px 8px; }
.orc-input:focus { outline:none; border-color:${C.emerald}; background:#fff; }
@media (max-width:720px){ .g4,.g3,.g2{ grid-template-columns:1fr 1fr; } .console h1{font-size:21px;} }
@media (max-width:460px){ .g4,.g3,.g2{ grid-template-columns:1fr; } }

/* Apresentação aos sócios */
.apresentacao { padding-top:6px; }
.ap-toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px;
  flex-wrap:wrap; margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid ${C.line}; }
.apresentacao .slide { margin-bottom:30px; }
.ap-capa { background:${C.ink}; border:1px solid ${C.ink}; border-radius:14px; padding:30px 28px;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }

/* Impressão / PDF */
.print-footer { display:none; }
@media print {
  @page { margin:14mm 14mm 18mm; }
  .no-print { display:none !important; }
  .console, .tabs { display:none !important; }
  .fin-root { background:#fff; }
  .fin-wrap { max-width:none; margin:0; padding:0; }
  /* Rodapé fixo: o Chrome repete elementos position:fixed em cada página */
  .print-footer { display:block; position:fixed; bottom:6mm; left:0; right:0;
    text-align:center; font-size:9px; letter-spacing:.04em; color:#7A8893;
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .apresentacao .slide { break-inside:avoid; page-break-inside:avoid; }
  .apresentacao .quebra { break-before:page; page-break-before:always; }
  .ap-capa { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .card, .chart-card, table { break-inside:avoid; }
  a[href]:after { content:""; }
}
`;

/* ---------- componentes pequenos ---------- */
function Vital({ k, v, tone }) {
  return <div className="vital"><div className="k">{k}</div>
    <div className={"v " + (tone||"")}>{v}</div></div>;
}
function Indicador({ label, valor, sub, status, fill, pctFill }) {
  return (
    <div className="card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div className="label">{label}</div>
        {status && <span className={"tag "+status.t}>{status.l}</span>}
      </div>
      <div className="big">{valor}</div>
      {sub && <div className="sub">{sub}</div>}
      {pctFill != null && <div className="rule"><i style={{width:Math.min(100,pctFill)+"%",background:fill||C.emerald}} /></div>}
    </div>
  );
}
function Gauge({ value }) {
  const r = 42, c = 2*Math.PI*r, off = c*(1 - value/100);
  const col = value>=70?"#43C796":value>=45?"#E0B257":"#E8826F";
  return (
    <div className="gauge">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#2E4456" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={col} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform="rotate(-90 48 48)" />
      </svg>
      <div className="num"><b style={{color:col}}>{Math.round(value)}</b><span>/ 100</span></div>
    </div>
  );
}

/* ---------- marca Health Importer (vetor; nítida no PDF e em qualquer tamanho) ---------- */
function GloboHI({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ flex: "none" }}>
      <defs>
        <linearGradient id="hiGrad" x1="6" y1="8" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#24C7E0" /><stop offset="0.55" stopColor="#3E78C2" /><stop offset="1" stopColor="#5C3E9C" />
        </linearGradient>
        <clipPath id="hiClip"><circle cx="32" cy="32" r="30" /></clipPath>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#hiGrad)" />
      <g clipPath="url(#hiClip)" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" fill="none">
        <path d="M31 1 L23 19 L3 23" />
        <path d="M23 19 L41 28 L31 47 Z" />
        <path d="M41 28 L61 24" />
        <path d="M41 28 L53 51" />
        <path d="M31 47 L35 63" />
        <path d="M23 19 L11 39 L31 47" />
        <path d="M11 39 L1 43" />
      </g>
    </svg>
  );
}
// Marca completa (globo + nome). Se houver /logo.png no servidor, usa o arquivo.
// fallbackGloboOnly: quando não há /logo.png, mostra só o globo (sem o nome),
// útil onde o nome da empresa já aparece logo abaixo.
function MarcaHI({ size = 52, tagline = false, dark = true, fallbackGloboOnly = false }) {
  const [erroImg, setErroImg] = useState(false);
  const cor = dark ? "#fff" : C.ink;
  if (!erroImg) {
    return <img src="/logo.png" alt="Health Importer" onError={() => setErroImg(true)}
      style={{ height: size + 12, maxWidth: "100%", objectFit: "contain" }} />;
  }
  if (fallbackGloboOnly) return <GloboHI size={size} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <GloboHI size={size} />
      <div>
        <div className="disp" style={{ fontWeight: 600, fontSize: size * 0.5, color: cor, lineHeight: 1.05 }}>Health Importer</div>
        {tagline && <div style={{ fontSize: 12, color: dark ? "#9FB2C0" : C.mute, marginTop: 3 }}>Inovação que transforma</div>}
      </div>
    </div>
  );
}

/* ---------- exportação CSV (abre no Excel; separador ; e vírgula decimal) ---------- */
function baixarCSV(nomeArquivo, cabecalho, linhas) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const corpo = [cabecalho, ...linhas].map((row) => row.map(esc).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + corpo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomeArquivo;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
const numBR = (n) => Number(n || 0).toFixed(2).replace(".", ",");
const ROTULO_STATUS = { PAGO: "Paga", ABERTO: "Em aberto", ATRASADO: "Atrasada" };
function exportarContas(arquivo, itens) {
  baixarCSV(arquivo,
    ["Vencimento", "Cliente/Fornecedor", "Categoria", "Projeto", "Valor", "Em aberto", "Juros/multa", "Status"],
    itens.map((i) => [i.vencimento, i.parceiro, i.categoria, i.projeto,
      numBR(i.valor), numBR(i.aberto), numBR(i.encargos), ROTULO_STATUS[i.status] || i.status]));
}
function exportarProjetos(itens) {
  baixarCSV("scps.csv",
    ["SCP", "Receita", "Despesa", "Resultado", "A receber", "A pagar"],
    itens.map((p) => [p.nome, numBR(p.receita), numBR(p.despesa),
      numBR(p.resultado), numBR(p.aReceber), numBR(p.aPagar)]));
}
function exportarCategorias(itens) {
  baixarCSV("categorias.csv",
    ["Categoria", "Receita", "Despesa", "Resultado", "A receber", "A pagar"],
    itens.map((p) => [p.nome, numBR(p.receita), numBR(p.despesa),
      numBR(p.resultado), numBR(p.aReceber), numBR(p.aPagar)]));
}
// Paleta para os gráficos de pizza (categorias)
const PALETA = ["#0B7A55", "#13A06F", "#B07D2B", "#22384A", "#B23A2E", "#65757F", "#7FA8C0", "#8E63CE", "#43C796", "#E0B257"];
// Exporta a matriz Despesa mês a mês (categoria × meses ativos + total).
function exportarDespesaMensal(linhas, ativos) {
  const head = ["Categoria", ...ativos.map((i) => MESES[i]), "Total"];
  const rows = linhas.map((l) => [l.nome, ...ativos.map((i) => numBR(l.valores[i] || 0)), numBR(l.total)]);
  rows.push(["Total", ...ativos.map((i) => numBR(linhas.reduce((s, l) => s + (l.valores[i] || 0), 0))),
    numBR(linhas.reduce((s, l) => s + l.total, 0))]);
  baixarCSV("despesa-mes-a-mes.csv", head, rows);
}
// Exporta a conciliação completa: conciliados + inconsistências (só extrato / só ERP D9).
function exportarConciliacao(res) {
  const linhas = [];
  for (const i of res.conciliados || []) linhas.push(["Conciliado", i.banco || "", i.data, `${i.extrato} ↔ ${i.omie}`, numBR(i.valor)]);
  for (const i of res.soExtrato || []) linhas.push(["Só no extrato", i.banco || "", i.data, i.descricao, numBR(i.valor)]);
  for (const i of res.soOmie || []) linhas.push(["Só no ERP D9", "", i.data, i.descricao, numBR(i.valor)]);
  baixarCSV("conciliacao.csv", ["Situação", "Banco", "Data", "Descrição", "Valor"], linhas);
}

// Linhas da DRE por projeto (negativo = entra como subtração; tot = subtotal)
const LINHAS_DRE = [
  { k: "receitaBruta", l: "Receita bruta" },
  { k: "deducoes", l: "(–) Deduções", neg: true },
  { k: "receitaLiquida", l: "Receita líquida", tot: true },
  { k: "cmv", l: "(–) CMV / custos", neg: true },
  { k: "lucroBruto", l: "Lucro bruto", tot: true },
  { k: "despesasOper", l: "(–) Despesas operacionais", neg: true },
  { k: "ebitda", l: "EBITDA", tot: true },
];
// DRE mês a mês vai até o lucro líquido (depreciação + impostos por mês).
const LINHAS_DRE_MENSAL = [
  ...LINHAS_DRE,
  { k: "depreciacao", l: "(–) Depreciação", neg: true },
  { k: "impostos", l: "(–) IR / CSLL", neg: true },
  { k: "lucroLiquido", l: "Lucro líquido", tot: true, fim: true },
];
function exportarDreProjetos(projs) {
  baixarCSV("dre-por-scp.csv",
    ["Linha", ...projs.map((p) => p.nome), "Total"],
    LINHAS_DRE.map((ln) => [ln.l,
      ...projs.map((p) => numBR(p.dre[ln.k])),
      numBR(projs.reduce((s, p) => s + (p.dre[ln.k] || 0), 0))]));
}

/* ---------- contas a pagar / a receber ---------- */
const TAG_STATUS = {
  PAGO: { t: "ok", l: "Paga" },
  ABERTO: { t: "mid", l: "Em aberto" },
  ATRASADO: { t: "at", l: "Atrasada" },
  CANCELADO: { t: "off", l: "Cancelada" },
};
const FILTROS_CONTA = [
  { id: "abertas", nome: "Em aberto" },
  { id: "atrasadas", nome: "Atrasadas" },
  { id: "pagas", nome: "Pagas" },
  { id: "canceladas", nome: "Canceladas" },
  { id: "todas", nome: "Todas" },
];
function filtrarContas(itens, filtro) {
  if (filtro === "todas") return itens;
  if (filtro === "pagas") return itens.filter((i) => i.status === "PAGO");
  if (filtro === "canceladas") return itens.filter((i) => i.status === "CANCELADO");
  if (filtro === "atrasadas") return itens.filter((i) => i.status === "ATRASADO");
  return itens.filter((i) => i.status === "ABERTO" || i.status === "ATRASADO"); // abertas
}

function BlocoContas({ titulo, dados, cor, projetoSel, dataDe, dataAte }) {
  const [filtro, setFiltro] = useState("abertas");
  if (!dados) return null;
  let itens = filtrarContas(dados.itens || [], filtro);
  if (projetoSel && projetoSel !== "__todos") {
    itens = itens.filter((i) => (i.projeto || "Health Importer (não alocado)") === projetoSel);
  }
  if (dataDe || dataAte) {
    itens = itens.filter((i) => dentroData(i.vencimento, dataDe, dataAte));
  }
  const arquivo = /receber/i.test(titulo) ? "contas-a-receber.csv" : "contas-a-pagar.csv";
  return (
    <div style={{ marginBottom: 26 }}>
      <div className="section-h" style={{ marginBottom: 10 }}>
        {titulo}
        <span className="tag mid" style={{ marginLeft: 4 }}>{dados.total} títulos</span>
      </div>
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <Indicador label="Em aberto" valor={brl(dados.totalAberto)} sub={`${dados.qtdAbertas} título(s)`} fill={cor} status={{ t: "mid", l: "A liquidar" }} />
        <Indicador label="Já liquidado" valor={brl(dados.totalPago)} sub={`${dados.qtdPagas} título(s)`} fill={C.emerald} status={{ t: "ok", l: "Pago" }} />
        <Indicador label={/pagar/i.test(titulo) ? "Juros/multa pagos" : "Juros/multa recebidos"} valor={brl(dados.totalEncargos || 0)} sub="Encargos de atraso" fill={C.gold} status={(dados.totalEncargos || 0) > 0 ? { t: "at", l: "Atraso" } : { t: "ok", l: "Em dia" }} />
        <Indicador label="Total de títulos" valor={String(dados.total)} sub="No período/cadastro" fill={C.inkSoft} />
      </div>
      <div className="filtro-bar">
        {FILTROS_CONTA.map((f) => (
          <button key={f.id} className={"preset" + (filtro === f.id ? " on" : "")} onClick={() => setFiltro(f.id)}>{f.nome}</button>
        ))}
        <button className="preset export" disabled={!itens.length} onClick={() => exportarContas(arquivo, itens)} style={{ marginLeft: "auto" }}>⬇ Exportar CSV</button>
      </div>
      <div className="card" style={{ padding: "4px 0", overflowX: "auto" }}>
        <table className="dre lista">
          <thead>
            <tr>
              <th>Vencimento</th><th>Cliente / Fornecedor</th><th>Categoria</th>
              <th>Projeto</th><th className="n">Valor</th><th className="n">Em aberto</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: C.mute, padding: 18 }}>Nenhum título nesse filtro.</td></tr>
            )}
            {itens.map((i, k) => (
              <tr key={k}>
                <td className="mono">{i.vencimento || "—"}</td>
                <td>{i.parceiro}</td>
                <td style={{ color: C.mute }}>{i.categoria || "—"}</td>
                <td>{i.projeto || <span style={{ color: C.mute }}>—</span>}</td>
                <td className="n">{brl(i.valor)}</td>
                <td className="n">{i.aberto > 0 ? brl(i.aberto) : "—"}</td>
                <td><span className={"tag " + TAG_STATUS[i.status].t}>{TAG_STATUS[i.status].l}</span></td>
              </tr>
            ))}
          </tbody>
          {itens.length > 0 && (
            <tfoot>
              <tr className="tot">
                <td colSpan={4}>Total exibido ({itens.length})</td>
                <td className="n">{brl(itens.reduce((s, i) => s + i.valor, 0))}</td>
                <td className="n">{brl(itens.reduce((s, i) => s + i.aberto, 0))}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {dados.truncada && (
        <p className="note">Mostrando os {dados.itens.length} títulos mais relevantes de {dados.total}.</p>
      )}
    </div>
  );
}

function AgingContas({ contas }) {
  const dados = useMemo(() => montarAging(contas), [contas]);
  if (!dados.some((d) => d["A receber"] || d["A pagar"])) return null;
  return (
    <>
      <div className="section-h">Vencimentos em aberto (aging)</div>
      <div className="chart-card">
        <div className="chart-sub">Quanto vence — e quanto já venceu — por faixa de prazo</div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={dados} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
            <XAxis dataKey="nome" tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} tickFormatter={(v) => "R$" + (v / 1000).toFixed(0) + "k"} />
            <Tooltip formatter={(v) => brl(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
            <Bar dataKey="A receber" fill={C.emerald} radius={[3, 3, 0, 0]} />
            <Bar dataKey="A pagar" fill={C.brick} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, padding: "4px 8px 8px", fontSize: 11, color: C.mute }}>
          <span style={{ color: C.emerald }}>● A receber</span>
          <span style={{ color: C.brick }}>● A pagar</span>
        </div>
      </div>
    </>
  );
}

function PainelContas({ contas }) {
  const [projetoSel, setProjetoSel] = useState("__todos");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const projetos = useMemo(() => {
    const set = new Set();
    for (const grupo of [contas?.receber, contas?.pagar])
      for (const i of grupo?.itens || []) set.add(i.projeto || "Health Importer (não alocado)");
    return [...set].sort();
  }, [contas]);
  const temData = dataDe || dataAte;
  return (
    <>
      <AgingContas contas={contas} />
      <div className="filtro-bar" style={{ marginBottom: 16, alignItems: "center", gap: 10 }}>
        {projetos.length > 1 && (
          <>
            <span style={{ fontSize: 12, color: C.mute }}>SCP:</span>
            <select className="proj-select" value={projetoSel} onChange={(e) => setProjetoSel(e.target.value)}>
              <option value="__todos">Todas as SCPs</option>
              {projetos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </>
        )}
        <span style={{ fontSize: 12, color: C.mute, marginLeft: projetos.length > 1 ? 8 : 0 }}>Vencimento de:</span>
        <input type="date" className="proj-select" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
        <span style={{ fontSize: 12, color: C.mute }}>até:</span>
        <input type="date" className="proj-select" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
        {temData && (
          <button className="preset" onClick={() => { setDataDe(""); setDataAte(""); }}>Limpar datas</button>
        )}
      </div>
      <BlocoContas titulo="Contas a receber" dados={contas?.receber} cor={C.emerald} projetoSel={projetoSel} dataDe={dataDe} dataAte={dataAte} />
      <BlocoContas titulo="Contas a pagar" dados={contas?.pagar} cor={C.brick} projetoSel={projetoSel} dataDe={dataDe} dataAte={dataAte} />
    </>
  );
}

/* ---------- gestão por SCP (cada projeto do ERP D9 = uma SCP) ---------- */
function PainelProjetos({ projetos }) {
  const dados = projetos && projetos.length ? projetos : [];
  const chart = dados.slice(0, 8).map((p) => ({
    nome: p.nome.length > 16 ? p.nome.slice(0, 15) + "…" : p.nome,
    Receita: Math.round(p.receita), Despesa: Math.round(p.despesa),
  }));
  const tot = dados.reduce((a, p) => ({
    receita: a.receita + p.receita, despesa: a.despesa + p.despesa,
    aReceber: a.aReceber + p.aReceber, aPagar: a.aPagar + p.aPagar,
  }), { receita: 0, despesa: 0, aReceber: 0, aPagar: 0 });

  if (!dados.length) {
    return <p className="note">Nenhuma SCP com movimento no período. Associe o projeto (SCP) aos lançamentos no ERP D9 para vê-las aqui.</p>;
  }
  return (
    <>
      <p className="note" style={{ marginTop: 0 }}>Cada <b>SCP</b> é um projeto no ERP D9. “Health Importer (não alocado)” reúne o que ainda não foi marcado em uma SCP — mas é tudo da Health Importer.</p>
      <div className="grid g4">
        <Indicador label="Receita das SCPs" valor={brl(tot.receita)} fill={C.emerald} status={{ t: "ok", l: "Entradas" }} />
        <Indicador label="Despesa das SCPs" valor={brl(tot.despesa)} fill={C.brick} status={{ t: "at", l: "Saídas" }} />
        <Indicador label="A receber" valor={brl(tot.aReceber)} fill={C.emeraldSoft} />
        <Indicador label="A pagar" valor={brl(tot.aPagar)} fill={C.gold} />
      </div>

      <div className="section-h">Receita × despesa por SCP</div>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={Math.max(200, chart.length * 46)}>
          <BarChart layout="vertical" data={chart} margin={{ top: 6, right: 16, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} tickFormatter={(v) => "R$" + (v / 1000).toFixed(0) + "k"} />
            <YAxis type="category" dataKey="nome" tick={{ fontSize: 12, fill: C.ink }} axisLine={false} tickLine={false} width={120} />
            <Tooltip formatter={(v) => brl(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
            <Bar dataKey="Receita" fill={C.emerald} radius={[0, 3, 3, 0]} />
            <Bar dataKey="Despesa" fill={C.inkSoft} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-h" style={{ justifyContent: "space-between" }}>
        Resultado por SCP
        <button className="preset export" onClick={() => exportarProjetos(dados)}>⬇ Exportar CSV</button>
      </div>
      <div className="card" style={{ padding: "4px 0", overflowX: "auto" }}>
        <table className="dre lista">
          <thead>
            <tr>
              <th>SCP</th><th className="n">Receita</th><th className="n">Despesa</th>
              <th className="n">Resultado</th><th className="n">A receber</th><th className="n">A pagar</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((p, k) => (
              <tr key={k}>
                <td>{p.nome}</td>
                <td className="n">{brl(p.receita)}</td>
                <td className="n">{brl(p.despesa)}</td>
                <td className="n" style={{ color: p.resultado >= 0 ? C.emerald : C.brick }}>{brl(p.resultado)}</td>
                <td className="n">{brl(p.aReceber)}</td>
                <td className="n">{brl(p.aPagar)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tot">
              <td>Total</td>
              <td className="n">{brl(tot.receita)}</td>
              <td className="n">{brl(tot.despesa)}</td>
              <td className="n" style={{ color: (tot.receita - tot.despesa) >= 0 ? C.emerald : C.brick }}>{brl(tot.receita - tot.despesa)}</td>
              <td className="n">{brl(tot.aReceber)}</td>
              <td className="n">{brl(tot.aPagar)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="note">Receita e despesa vêm dos lançamentos realizados no período; “a receber/a pagar” são os títulos em aberto. SCPs com nome próprio têm investidores; “Health Importer” é só dos sócios gerais; “Health Importer (não alocado)” ainda não foi marcado em uma SCP.</p>

      <DrePorProjeto projetos={dados} />
      <PreencherProjetoVazio />
    </>
  );
}

/* ---------- DRE mês a mês (matriz linhas da DRE × meses) ---------- */
function DREMensal({ dreMensal }) {
  const todos = dreMensal && dreMensal.length ? dreMensal : dreMensalExemplo;
  const meses = todos.filter((m) => m.receitaBruta || m.cmv || m.despesasOper);
  if (!meses.length) return null;
  const totLinha = (k) => meses.reduce((s, m) => s + (m[k] || 0), 0);
  const cel = (ln, v) => (ln.neg ? `(${brl(Math.abs(v))})` : brl(v));
  return (
    <>
      <div className="section-h">DRE mês a mês</div>
      <div className="card" style={{ padding: "4px 0", overflowX: "auto" }}>
        <table className="dre lista">
          <thead>
            <tr><th>Linha</th>{meses.map((m, i) => <th key={i} className="n">{m.mes}</th>)}<th className="n">Total</th></tr>
          </thead>
          <tbody>
            {LINHAS_DRE_MENSAL.map((ln) => {
              const destaca = ln.k === "ebitda" || ln.k === "lucroLiquido";
              const cor = (v) => (destaca ? { color: v >= 0 ? C.emerald : C.brick } : undefined);
              return (
                <tr key={ln.k} className={ln.tot ? "tot" : ""}>
                  <td>{ln.l}</td>
                  {meses.map((m, i) => (
                    <td key={i} className="n" style={cor(m[ln.k])}>{cel(ln, m[ln.k])}</td>
                  ))}
                  <td className="n" style={cor(totLinha(ln.k))}>{cel(ln, totLinha(ln.k))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">DRE completa por mês (até o lucro líquido), pelo mês do pagamento. Deduções e impostos pela alíquota configurada; depreciação distribuída pelos meses com movimento — por isso a coluna <b>Total</b> ≈ DRE consolidada acima.</p>
    </>
  );
}

/* ---------- matriz Despesa mês a mês (reutilizada em Categorias e Orçamento) ---------- */
function DespesaMensal({ categoriasMensal }) {
  const linhas = categoriasMensal && categoriasMensal.length ? categoriasMensal : categoriasMensalExemplo;
  const ativos = MESES.map((_, i) => i).filter((i) => linhas.some((l) => (l.valores[i] || 0) > 0));
  if (!linhas.length || !ativos.length) return null;
  const realizadoTotal = linhas.reduce((s, l) => s + l.total, 0);
  return (
    <>
      <div className="section-h" style={{ justifyContent: "space-between" }}>
        Despesa mês a mês
        <button className="preset export" onClick={() => exportarDespesaMensal(linhas, ativos)}>⬇ Exportar CSV</button>
      </div>
      <div className="card" style={{ padding: "4px 0", overflowX: "auto" }}>
        <table className="dre lista">
          <thead>
            <tr><th>Categoria</th>{ativos.map((i) => <th key={i} className="n">{MESES[i]}</th>)}<th className="n">Total</th></tr>
          </thead>
          <tbody>
            {linhas.map((l, k) => (
              <tr key={k}>
                <td>{l.nome}</td>
                {ativos.map((i) => <td key={i} className="n">{l.valores[i] ? brl(l.valores[i]) : "—"}</td>)}
                <td className="n">{brl(l.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tot">
              <td>Total</td>
              {ativos.map((i) => <td key={i} className="n">{brl(linhas.reduce((s, l) => s + (l.valores[i] || 0), 0))}</td>)}
              <td className="n">{brl(realizadoTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

/* ---------- controle por categoria (plano de contas) ---------- */
function PainelCategorias({ categorias, categoriasMensal }) {
  const dados = categorias && categorias.length ? categorias : [];
  if (!dados.length) {
    return <p className="note">Nenhuma categoria com movimento no período. As categorias vêm do plano de contas do ERP D9.</p>;
  }
  const tot = dados.reduce((a, p) => ({
    receita: a.receita + p.receita, despesa: a.despesa + p.despesa,
    aReceber: a.aReceber + p.aReceber, aPagar: a.aPagar + p.aPagar,
  }), { receita: 0, despesa: 0, aReceber: 0, aPagar: 0 });

  const corta = (s) => (s.length > 22 ? s.slice(0, 21) + "…" : s);
  const barras = dados.slice(0, 12).map((p) => ({ nome: corta(p.nome), Receita: Math.round(p.receita), Despesa: Math.round(p.despesa) }));
  const pizza = dados.filter((p) => p.despesa > 0).slice(0, 9)
    .map((p, i) => ({ name: corta(p.nome), value: Math.round(p.despesa), c: PALETA[i % PALETA.length] }));

  return (
    <>
      <p className="note" style={{ marginTop: 0 }}>Receita e despesa por <b>categoria</b> (plano de contas), no período e na SCP selecionados. “A receber/a pagar” são os títulos em aberto.</p>
      <div className="grid g4">
        <Indicador label="Receita" valor={brl(tot.receita)} fill={C.emerald} status={{ t: "ok", l: "Entradas" }} />
        <Indicador label="Despesa" valor={brl(tot.despesa)} fill={C.brick} status={{ t: "at", l: "Saídas" }} />
        <Indicador label="A receber" valor={brl(tot.aReceber)} fill={C.emeraldSoft} />
        <Indicador label="A pagar" valor={brl(tot.aPagar)} fill={C.gold} />
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="chart-card">
          <div className="chart-title">Receita × despesa por categoria</div>
          <ResponsiveContainer width="100%" height={Math.max(220, barras.length * 34)}>
            <BarChart layout="vertical" data={barras} margin={{ top: 6, right: 16, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} tickFormatter={(v) => "R$" + (v / 1000).toFixed(0) + "k"} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} width={140} />
              <Tooltip formatter={(v) => brl(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
              <Bar dataKey="Receita" fill={C.emerald} radius={[0, 3, 3, 0]} />
              <Bar dataKey="Despesa" fill={C.inkSoft} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <div className="chart-title">Despesas por categoria</div>
          <div className="chart-sub">Onde o dinheiro está saindo</div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pizza} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={2}>
                {pizza.map((e, i) => <Cell key={i} fill={e.c} />)}
              </Pie>
              <Tooltip formatter={(v) => brl(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", padding: "0 8px 6px", fontSize: 11, color: C.mute }}>
            {pizza.map((e, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <i style={{ width: 9, height: 9, borderRadius: 2, background: e.c, display: "inline-block" }} />{e.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="section-h" style={{ justifyContent: "space-between" }}>
        Detalhe por categoria
        <button className="preset export" onClick={() => exportarCategorias(dados)}>⬇ Exportar CSV</button>
      </div>
      <div className="card" style={{ padding: "4px 0", overflowX: "auto" }}>
        <table className="dre lista">
          <thead>
            <tr><th>Categoria</th><th className="n">Receita</th><th className="n">Despesa</th>
              <th className="n">Resultado</th><th className="n">A receber</th><th className="n">A pagar</th></tr>
          </thead>
          <tbody>
            {dados.map((p, k) => (
              <tr key={k}>
                <td>{p.nome}</td>
                <td className="n">{brl(p.receita)}</td>
                <td className="n">{brl(p.despesa)}</td>
                <td className="n" style={{ color: p.resultado >= 0 ? C.emerald : C.brick }}>{brl(p.resultado)}</td>
                <td className="n">{brl(p.aReceber)}</td>
                <td className="n">{brl(p.aPagar)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tot">
              <td>Total</td>
              <td className="n">{brl(tot.receita)}</td>
              <td className="n">{brl(tot.despesa)}</td>
              <td className="n" style={{ color: (tot.receita - tot.despesa) >= 0 ? C.emerald : C.brick }}>{brl(tot.receita - tot.despesa)}</td>
              <td className="n">{brl(tot.aReceber)}</td>
              <td className="n">{brl(tot.aPagar)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <DespesaMensal categoriasMensal={categoriasMensal} />
    </>
  );
}

/* ---------- vendas: faturamento (NF de saída) cruzado com a SCP do produto ---------- */
function exportarVendasProdutos(itens) {
  baixarCSV("vendas-produtos.csv",
    ["SKU", "Produto", "SCP", "Faturamento", "Itens"],
    itens.map((p) => [p.sku, p.descricao, p.scp, numBR(p.faturamento), p.quantidade]));
}
function exportarCatalogoProdutos(itens) {
  baixarCSV("produtos.csv",
    ["SKU", "Produto", "SCP", "Valor unitário", "Situação"],
    itens.map((p) => [p.sku, p.descricao, p.scp, numBR(p.valorUnit), p.inativo ? "Inativo" : "Ativo"]));
}
function exportarVendasRelacao(itens) {
  baixarCSV("vendas-notas.csv",
    ["Data", "Nota", "Cliente", "SCP", "Itens", "Produtos", "Frete", "Encargos", "Faturamento"],
    itens.map((n) => [n.data, n.numero, n.cliente, n.scp, n.itens, numBR(n.produtos || 0), numBR(n.frete || 0), numBR(n.encargos || 0), numBR(n.valor)]));
}

function PainelVendas({ periodo, scp }) {
  const [vendas, setVendas] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  useEffect(() => {
    let ativo = true;
    setCarregando(true); setErro(null);
    const q = scp ? `&projeto=${encodeURIComponent(scp)}` : "";
    fetch(`${VENDAS_URL}?inicio=${encodeURIComponent(periodo.inicio)}&fim=${encodeURIComponent(periodo.fim)}${q}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { if (!ativo) return; if (data && data.erro) throw new Error(data.detalhe || data.erro); setVendas(data); })
      .catch((e) => { if (ativo) setErro(e.message); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [periodo.inicio, periodo.fim, scp]);

  if (carregando) return <p className="note">Carregando vendas…</p>;
  if (erro) return <p className="note">Não foi possível carregar as vendas: {erro}</p>;
  if (!vendas) return <p className="note">Sem dados de vendas ao vivo. Conecte as chaves do ERP D9 para ver o faturamento por SCP.</p>;
  const { total = 0, qtdNotas = 0, qtdItens = 0, porSCP = [], porProduto = [],
    serieMensal = [], relacao = [], catalogo = [], caracteristica = "Projeto" } = vendas;
  if (!qtdItens) {
    return <p className="note">Nenhuma nota fiscal de venda no período/SCP selecionados. A SCP de cada produto vem da característica “{caracteristica}” no cadastro do produto no ERP D9.</p>;
  }
  const ticket = qtdNotas ? total / qtdNotas : 0;
  const corta = (s) => (String(s).length > 24 ? String(s).slice(0, 23) + "…" : s);
  const barrasSCP = porSCP.map((p, i) => ({ nome: corta(p.nome), Faturamento: Math.round(p.faturamento), c: PALETA[i % PALETA.length] }));
  const serie = serieMensal.map((v, i) => ({ mes: MESES[i], Faturamento: Math.round(v || 0) }));
  const temMensal = serie.some((s) => s.Faturamento > 0);
  const top = porProduto.slice(0, 10);

  return (
    <>
      <p className="note" style={{ marginTop: 0 }}>Faturamento por <b>nota fiscal de saída</b>, cruzado com a <b>SCP</b> de cada produto (característica “{caracteristica}”). Respeita o período e a SCP selecionados; NFs canceladas não entram.</p>
      <div className="grid g4">
        <Indicador label="Faturamento (NF)" valor={brl(total)} fill={C.emerald} status={{ t: "ok", l: "Vendas líquidas" }} />
        <Indicador label="Notas emitidas" valor={String(qtdNotas)} fill={C.inkSoft} />
        <Indicador label="Ticket médio" valor={brl(ticket)} fill={C.gold} />
        <Indicador label="Itens vendidos" valor={String(qtdItens)} fill={C.emeraldSoft} />
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="chart-card">
          <div className="chart-title">Faturamento por SCP</div>
          <ResponsiveContainer width="100%" height={Math.max(200, barrasSCP.length * 40)}>
            <BarChart layout="vertical" data={barrasSCP} margin={{ top: 6, right: 16, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} tickFormatter={(v) => "R$" + (v / 1000).toFixed(0) + "k"} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: C.ink }} axisLine={false} tickLine={false} width={150} />
              <Tooltip formatter={(v) => brl(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
              <Bar dataKey="Faturamento" radius={[0, 3, 3, 0]}>{barrasSCP.map((e, i) => <Cell key={i} fill={e.c} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <div className="chart-title">Faturamento mês a mês</div>
          {temMensal ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={serie} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} tickFormatter={(v) => "R$" + (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v) => brl(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
                <Bar dataKey="Faturamento" fill={C.emerald} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="note">Sem distribuição mensal no período.</p>}
        </div>
      </div>

      <div className="section-h" style={{ justifyContent: "space-between" }}>
        Top produtos por faturamento
        <button className="preset export" onClick={() => exportarVendasProdutos(porProduto)}>⬇ Exportar CSV</button>
      </div>
      <div className="card" style={{ padding: "4px 0", overflowX: "auto" }}>
        <table className="dre lista">
          <thead><tr><th>SKU</th><th>Produto</th><th>SCP</th><th className="n">Faturamento</th><th className="n">Itens</th></tr></thead>
          <tbody>
            {top.map((p, k) => (
              <tr key={k}><td>{p.sku}</td><td>{p.descricao}</td><td>{p.scp}</td>
                <td className="n">{brl(p.faturamento)}</td><td className="n">{p.quantidade}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-h" style={{ justifyContent: "space-between" }}>
        Relação de vendas — notas fiscais ({relacao.length})
        <button className="preset export" onClick={() => exportarVendasRelacao(relacao)}>⬇ Exportar CSV</button>
      </div>
      <div className="card" style={{ padding: "4px 0", overflowX: "auto" }}>
        <table className="dre lista">
          <thead><tr><th>Data</th><th>Nota</th><th>Cliente</th><th>SCP</th><th className="n">Itens</th>
            <th className="n">Produtos</th><th className="n">Frete</th><th className="n">Encargos</th><th className="n">Faturamento</th></tr></thead>
          <tbody>
            {relacao.map((n, k) => (
              <tr key={k}><td>{n.data}</td><td>{n.numero}</td><td>{n.cliente}</td><td>{n.scp}</td>
                <td className="n">{n.itens}</td><td className="n">{brl(n.produtos || 0)}</td>
                <td className="n">{(n.frete || 0) ? brl(n.frete) : "—"}</td>
                <td className="n">{(n.encargos || 0) ? brl(n.encargos) : "—"}</td><td className="n">{brl(n.valor)}</td></tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tot">
              <td colSpan={4}>Total</td>
              <td className="n">{relacao.reduce((s, n) => s + n.itens, 0)}</td>
              <td className="n">{brl(relacao.reduce((s, n) => s + (n.produtos || 0), 0))}</td>
              <td className="n">{brl(relacao.reduce((s, n) => s + (n.frete || 0), 0))}</td>
              <td className="n">{brl(relacao.reduce((s, n) => s + (n.encargos || 0), 0))}</td>
              <td className="n">{brl(relacao.reduce((s, n) => s + n.valor, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {(() => {
        const ativos = catalogo.filter((p) => !p.inativo);
        const qtdInativos = catalogo.length - ativos.length;
        const lista = mostrarInativos ? catalogo : ativos;
        return (
          <>
            <div className="section-h" style={{ justifyContent: "space-between" }}>
              Produtos cadastrados ({lista.length}{!mostrarInativos && qtdInativos ? ` ativos` : ""})
              <span style={{ display: "flex", gap: 8 }}>
                {qtdInativos ? <button className="preset" onClick={() => setMostrarInativos((v) => !v)}>{mostrarInativos ? "Ocultar inativos" : `Mostrar inativos (${qtdInativos})`}</button> : null}
                <button className="preset export" onClick={() => exportarCatalogoProdutos(lista)}>⬇ Exportar CSV</button>
              </span>
            </div>
            <div className="card" style={{ padding: "4px 0", overflowX: "auto" }}>
              <table className="dre lista">
                <thead><tr><th>SKU</th><th>Produto</th><th>SCP</th><th className="n">Valor unit.</th><th>Situação</th></tr></thead>
                <tbody>
                  {lista.map((p, k) => (
                    <tr key={k}><td>{p.sku}</td><td>{p.descricao}</td><td>{p.scp}</td>
                      <td className="n">{brl(p.valorUnit)}</td><td>{p.inativo ? "Inativo" : "Ativo"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}
    </>
  );
}

/* ---------- DRE detalhada: CMV e despesas abertos por categoria ---------- */
function exportarDRE(dre, det) {
  const n = (v) => numBR(v || 0);
  const linhas = [["Receita bruta", n(dre.receitaBruta)]];
  (det.receitas || []).forEach((c) => linhas.push(["   " + c.nome, n(c.valor)]));
  linhas.push(["(-) Deducoes e impostos s/ venda", n(dre.deducoes)]);
  linhas.push(["Receita liquida", n(dre.receitaLiquida)]);
  linhas.push(["(-) CMV", n(dre.cmv)]);
  (det.cmv || []).forEach((c) => linhas.push(["   " + c.nome, n(c.valor)]));
  linhas.push(["Lucro bruto", n(dre.lucroBruto)]);
  linhas.push(["(-) Despesas operacionais", n(dre.despesasOper)]);
  (det.despesas || []).forEach((c) => linhas.push(["   " + c.nome, n(c.valor)]));
  linhas.push(["EBITDA", n(dre.ebitda)]);
  linhas.push(["(-) Depreciacao", n(dre.depreciacao)]);
  linhas.push(["(-) Resultado financeiro", n(dre.resultadoFinanceiro)]);
  linhas.push(["(-) IR / CSLL", n(dre.impostos)]);
  linhas.push(["Lucro liquido", n(dre.lucroLiquido)]);
  baixarCSV("dre.csv", ["Linha", "Valor"], linhas);
}

function PainelDRE({ dre, detalhe, competencia, dreMensal, escopo, premissas, periodo, scp }) {
  const [aberto, setAberto] = useState({ cmv: true, despesas: true });
  // Receita por COMPETÊNCIA = faturamento das NFs (mesma base da aba Vendas),
  // com os impostos sobre venda destacados nas notas (deduções reais).
  const [vnd, setVnd] = useState(null); // { total, impostos }
  useEffect(() => {
    let ativo = true; setVnd(null);
    const q = scp ? `&projeto=${encodeURIComponent(scp)}` : "";
    fetch(`${VENDAS_URL}?inicio=${encodeURIComponent(periodo.inicio)}&fim=${encodeURIComponent(periodo.fim)}${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (ativo && d && !d.erro) setVnd({ total: Number(d.total) || 0, impostos: Number(d.impostos) || 0, cmv: Number(d.cmv) || 0, cmvDetalhe: d.cmvDetalhe || [] }); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [periodo.inicio, periodo.fim, scp]);

  if (!dre) return <p className="note">Sem DRE no período.</p>;
  const toggle = (k) => setAberto((p) => ({ ...p, [k]: !p[k] }));

  // DRE 100% por COMPETÊNCIA: receita = faturamento das NFs; CMV e despesas pelos
  // TÍTULOS A PAGAR emitidos no período (o incorrido, não o pago). Deduções e
  // impostos usam as alíquotas do servidor.
  const comp = competencia || {};
  // CMV = custo dos produtos vendidos (das NFs); despesas = títulos emitidos (competência).
  const detMap = { cmv: (vnd && vnd.cmvDetalhe) || [], despesas: comp.despesasCategorias || [] };
  const recCaixa = dre.receitaBruta || 0;
  const aliqDed = premissas?.aliqDeducoes ?? (recCaixa > 0 ? dre.deducoes / recCaixa : 0.15);
  const aliqImp = premissas?.aliqImpostos ?? 0.34;
  const receitaBruta = vnd ? vnd.total : recCaixa;
  // Deduções = impostos reais destacados nas NFs (ICMS+PIS+COFINS+ISS).
  const deducoes = vnd ? vnd.impostos : receitaBruta * aliqDed;
  const receitaLiquida = receitaBruta - deducoes;
  // CMV = custo da mercadoria VENDIDA (custo médio × qtd das NFs), não as compras.
  const cmv = vnd ? vnd.cmv : (dre.cmv || 0);
  const lucroBruto = receitaLiquida - cmv;
  const despesasOper = comp.despesas != null ? comp.despesas : (dre.despesasOper || 0);
  const ebitda = lucroBruto - despesasOper;
  const depreciacao = dre.depreciacao || 0;
  const ebit = ebitda - depreciacao;
  const resultadoFinanceiro = dre.resultadoFinanceiro || 0;
  const lair = ebit - resultadoFinanceiro;
  const impostos = Math.max(0, lair * aliqImp);
  const lucroLiquido = lair - impostos;
  const D = { receitaBruta, deducoes, receitaLiquida, cmv, lucroBruto, despesasOper,
    ebitda, depreciacao, resultadoFinanceiro, impostos, lucroLiquido };

  const Detalhe = ({ chave }) => !aberto[chave] ? null : (detMap[chave] || []).map((c, i) => (
    <tr key={chave + i} className="sub">
      <td style={{ paddingLeft: 30, color: C.mute }}>{c.nome}{c.codigo ? ` · ${c.codigo}` : ""} <span style={{ fontSize: 10 }}>({c.qtd})</span></td>
      <td className="n" style={{ color: C.mute }}>{brl(c.valor)}</td>
    </tr>
  ));
  const Expansivel = ({ chave, label, valor }) => (
    <tr style={{ cursor: "pointer" }} onClick={() => toggle(chave)}>
      <td>{aberto[chave] ? "▾" : "▸"} (–) {label}{(detMap[chave] || []).length ? <span style={{ fontSize: 11, color: C.mute }}> ({detMap[chave].length} {chave === "cmv" ? "produtos" : "categorias"})</span> : null}</td>
      <td className="n">({brl(valor)})</td>
    </tr>
  );

  return (
    <>
      <div className="section-h" style={{ justifyContent: "space-between" }}>
        DRE{escopo ? ` — ${escopo.nome}` : " — consolidado"}
        <button className="preset export" onClick={() => exportarDRE(D, { receitas: [], cmv: detMap.cmv, despesas: detMap.despesas })}>⬇ Exportar CSV</button>
      </div>
      <p className="note" style={{ marginTop: 0 }}>Resultado por <b>regime de competência</b> no período e na SCP selecionados. <b>Receita</b> = faturamento das NFs; <b>Deduções</b> = impostos destacados nas NFs (ICMS+PIS+COFINS+ISS); <b>CMV</b> = custo das mercadorias <b>vendidas</b> (custo médio × qtd das NFs, por produto); <b>Despesas</b> = títulos a pagar emitidos no período. Clique no CMV/Despesas para abrir o detalhe. IR/CSLL usa a alíquota configurada.</p>
      <div className="card" style={{ padding: "6px 18px", overflowX: "auto" }}>
        <table className="dre"><tbody>
          <tr><td>Receita bruta <span style={{ fontSize: 11, color: C.mute }}>(faturamento NF)</span></td>
            <td className="n">{vnd == null ? "…" : brl(D.receitaBruta)}</td></tr>
          <tr className="sub"><td style={{ paddingLeft: 30, color: C.mute }}>recebido no caixa no período</td>
            <td className="n" style={{ color: C.mute }}>{brl(recCaixa)}</td></tr>
          <tr><td>(–) Deduções e impostos s/ venda</td><td className="n">({brl(D.deducoes)})</td></tr>
          <tr className="tot"><td>Receita líquida</td><td className="n">{brl(D.receitaLiquida)}</td></tr>
          <Expansivel chave="cmv" label="CMV — custo das mercadorias" valor={D.cmv} />
          <Detalhe chave="cmv" />
          <tr className="tot"><td>Lucro bruto</td><td className="n">{brl(D.lucroBruto)}</td></tr>
          <Expansivel chave="despesas" label="Despesas operacionais" valor={D.despesasOper} />
          <Detalhe chave="despesas" />
          <tr className="tot"><td>EBITDA</td><td className="n">{brl(D.ebitda)}</td></tr>
          <tr><td>(–) Depreciação</td><td className="n">({brl(D.depreciacao)})</td></tr>
          <tr><td>(–) Resultado financeiro</td><td className="n">({brl(D.resultadoFinanceiro)})</td></tr>
          <tr><td>(–) IR / CSLL</td><td className="n">({brl(D.impostos)})</td></tr>
          <tr className="tot"><td>Lucro líquido</td><td className="n">{brl(D.lucroLiquido)}</td></tr>
        </tbody></table>
      </div>

      <DREMensal dreMensal={dreMensal} />
    </>
  );
}

/* ---------- orçamento: previsto × realizado por categoria (mês a mês) ---------- */
function PainelOrcamento({ categoriasMensal }) {
  const linhas = categoriasMensal && categoriasMensal.length ? categoriasMensal : categoriasMensalExemplo;
  const [orc, setOrc] = useState({});
  useEffect(() => {
    try { const s = localStorage.getItem("orcamentoCategorias"); if (s) setOrc(JSON.parse(s)); } catch { /* ignora */ }
  }, []);
  const keyOf = (l) => (l.codigo != null ? String(l.codigo) : "nome:" + l.nome);
  const setOrcCat = (k, v) => setOrc((prev) => {
    const n = { ...prev, [k]: v };
    try { localStorage.setItem("orcamentoCategorias", JSON.stringify(n)); } catch { /* ignora */ }
    return n;
  });

  if (!linhas.length) return <p className="note">Sem despesas por categoria no período para orçar.</p>;

  // Meses com movimento no período (para não mostrar 12 colunas vazias).
  const ativos = MESES.map((_, i) => i).filter((i) => linhas.some((l) => (l.valores[i] || 0) > 0));
  const nMeses = Math.max(1, ativos.length);
  const orcMensal = (l) => Number(orc[keyOf(l)]) || 0;
  const previstoTotal = linhas.reduce((s, l) => s + orcMensal(l) * nMeses, 0);
  const realizadoTotal = linhas.reduce((s, l) => s + l.total, 0);
  const variacaoTotal = realizadoTotal - previstoTotal;

  // Gráfico: realizado × previsto por mês (total das categorias).
  const previstoMes = previstoTotal / nMeses;
  const chart = ativos.map((i) => ({
    mes: MESES[i],
    Realizado: Math.round(linhas.reduce((s, l) => s + (l.valores[i] || 0), 0)),
    Previsto: Math.round(previstoMes),
  }));

  const corVar = (v) => (v > 0 ? C.brick : C.emerald); // gasto acima do previsto = vermelho

  return (
    <>
      <div className="section-h">Orçamento — previsto × realizado</div>
      <p className="note" style={{ marginTop: -6 }}>
        Defina o <b>orçamento mensal</b> de cada categoria de despesa e o painel compara com o <b>realizado</b> no período.
        Acima do previsto fica <b style={{ color: C.brick }}>vermelho</b>; abaixo, <b style={{ color: C.emerald }}>verde</b>.
        Os valores do orçamento ficam salvos <b>neste navegador</b>. Respeita a SCP e o período selecionados.
      </p>

      <div className="grid g3" style={{ marginBottom: 8 }}>
        <Indicador label="Previsto (período)" valor={brl(previstoTotal)} sub={`${nMeses} mês(es) · orçamento × meses`} fill={C.inkSoft} />
        <Indicador label="Realizado (período)" valor={brl(realizadoTotal)} sub="Despesa efetiva" fill={C.gold} />
        <Indicador label="Variação" valor={brl(variacaoTotal)} sub={variacaoTotal > 0 ? "acima do previsto" : "dentro do previsto"} fill={corVar(variacaoTotal)} status={variacaoTotal > 0 ? { t: "at", l: "Estourou" } : { t: "ok", l: "No alvo" }} />
      </div>

      <div className="chart-card">
        <div className="chart-title">Realizado × previsto por mês</div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chart} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} tickFormatter={(v) => "R$" + (v / 1000).toFixed(0) + "k"} />
            <Tooltip formatter={(v) => brl(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
            <Bar dataKey="Realizado" fill={C.brick} radius={[3, 3, 0, 0]} />
            <Bar dataKey="Previsto" fill={C.inkSoft} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-h">Por categoria</div>
      <div className="card" style={{ padding: "4px 0", overflowX: "auto" }}>
        <table className="dre lista">
          <thead>
            <tr>
              <th>Categoria</th><th className="n">Orçamento (mês)</th>
              <th className="n">Previsto (período)</th><th className="n">Realizado</th><th className="n">Variação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, k) => {
              const prev = orcMensal(l) * nMeses;
              const v = l.total - prev;
              return (
                <tr key={k}>
                  <td>{l.nome}</td>
                  <td className="n">
                    <input type="number" className="orc-input" value={orc[keyOf(l)] ?? ""} placeholder="0"
                      onChange={(e) => setOrcCat(keyOf(l), e.target.value)} />
                  </td>
                  <td className="n">{prev ? brl(prev) : "—"}</td>
                  <td className="n">{brl(l.total)}</td>
                  <td className="n" style={{ color: prev ? corVar(v) : C.mute }}>{prev ? brl(v) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DespesaMensal categoriasMensal={categoriasMensal} />
    </>
  );
}

// Ferramenta (escreve no ERP D9): preenche o projeto "Health Importer" nos
// títulos de Contas a Pagar pagos e sem projeto. Simular antes; executar com confirmação.
function PreencherProjetoVazio() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [sim, setSim] = useState(null);
  const [exec, setExec] = useState(null);

  function chamar(confirmar) {
    setCarregando(true); setErro(null);
    return fetch("/api/projetos/preencher-vazios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projetoNome: "Health Importer", confirmar, limite: 150 }),
    })
      .then(async (r) => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error((d && (d.detalhe || d.erro)) || `HTTP ${r.status}`); return d; })
      .catch((e) => { setErro(e.message); return null; })
      .finally(() => setCarregando(false));
  }

  function simular() { setExec(null); chamar(false).then((d) => d && setSim(d)); }
  function executar() {
    if (!window.confirm(`Isto vai GRAVAR no ERP D9: atribuir o projeto "Health Importer" a ${sim?.total || ""} título(s) de Contas a Pagar pagos e sem projeto. Continuar?`)) return;
    chamar(true).then((d) => { if (d) { setExec(d); setSim((s) => s ? { ...s, total: d.restantes } : s); } });
  }

  return (
    <>
      <div className="section-h">Preencher projeto nos títulos sem SCP <span className="tag at" style={{ marginLeft: 4 }}>escreve no ERP D9</span></div>
      <div className="card">
        <p className="note" style={{ marginTop: 0 }}>
          Atribui o projeto <b>Health Importer</b> aos títulos de <b>Contas a Pagar pagos</b> que estão <b>sem projeto</b>.
          Clique em <b>Simular</b> para ver quantos seriam alterados (sem gravar). A execução grava no ERP D9 e é
          <b> irreversível</b> — feita em lotes, parando no primeiro erro.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="preset" disabled={carregando} onClick={simular}>🔍 Simular</button>
          {sim && sim.total > 0 && (
            <button className="preset" disabled={carregando} onClick={executar}
              style={{ background: C.brick, borderColor: C.brick, color: "#fff" }}>
              ✍ Executar no ERP D9 ({Math.min(sim.total, 150)})
            </button>
          )}
          {carregando && <span className="note" style={{ margin: 0 }}>◌ processando…</span>}
        </div>

        {erro && <p className="note" style={{ color: C.brick }}>● {erro}</p>}

        {sim && (
          <div style={{ marginTop: 12 }}>
            <p className="note" style={{ marginTop: 0 }}>
              <b>{sim.total}</b> título(s) pagos sem projeto · total {brl(sim.valorTotal || 0)} · projeto destino: <b>{sim.projeto?.nome}</b> (cód. {sim.projeto?.codigo})
              {sim.total === 0 && " — nada a preencher 🎉"}
            </p>
            {sim.amostra?.length > 0 && (
              <div className="card" style={{ padding: "4px 0", overflowX: "auto" }}>
                <table className="dre lista">
                  <thead><tr><th>Nº</th><th>Vencimento</th><th className="n">Valor</th></tr></thead>
                  <tbody>{sim.amostra.map((a, i) => (
                    <tr key={i}><td>{a.numero || "—"}</td><td>{a.vencimento || "—"}</td><td className="n">{brl(a.valor)}</td></tr>
                  ))}</tbody>
                </table>
                <p className="note">Amostra dos 10 primeiros.</p>
              </div>
            )}
          </div>
        )}

        {exec && (
          <div style={{ marginTop: 10 }}>
            <p className="note" style={{ color: C.emerald }}>
              ✓ {exec.alterados} título(s) atualizados no ERP D9{exec.semChave ? ` · ${exec.semChave} sem chave (ignorados)` : ""}.
              {exec.restantes > 0 && ` Faltam ${exec.restantes}.`}
            </p>
            {exec.restantes > 0 && (
              <button className="preset" disabled={carregando} onClick={executar}
                style={{ background: C.brick, borderColor: C.brick, color: "#fff" }}>
                ✍ Continuar ({Math.min(exec.restantes, 150)})
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function DrePorProjeto({ projetos }) {
  const projs = (projetos || []).filter((p) => p.dre && (p.dre.receitaBruta || p.dre.cmv || p.dre.despesasOper));
  if (!projs.length) return null;
  const totLinha = (k) => projs.reduce((s, p) => s + (p.dre[k] || 0), 0);
  const cel = (ln, v) => (ln.neg ? `(${brl(Math.abs(v))})` : brl(v));
  return (
    <>
      <div className="section-h" style={{ justifyContent: "space-between" }}>
        DRE por SCP
        <button className="preset export" onClick={() => exportarDreProjetos(projs)}>⬇ Exportar CSV</button>
      </div>
      <div className="card" style={{ padding: "4px 0", overflowX: "auto" }}>
        <table className="dre lista">
          <thead>
            <tr>
              <th>Linha</th>
              {projs.map((p, k) => <th key={k} className="n">{p.nome}</th>)}
              <th className="n">Total</th>
            </tr>
          </thead>
          <tbody>
            {LINHAS_DRE.map((ln) => (
              <tr key={ln.k} className={ln.tot ? "tot" : ""}>
                <td>{ln.l}</td>
                {projs.map((p, k) => (
                  <td key={k} className="n" style={ln.k === "ebitda" ? { color: p.dre.ebitda >= 0 ? C.emerald : C.brick } : undefined}>
                    {cel(ln, p.dre[ln.k])}
                  </td>
                ))}
                <td className="n" style={ln.k === "ebitda" ? { color: totLinha("ebitda") >= 0 ? C.emerald : C.brick } : undefined}>
                  {cel(ln, totLinha(ln.k))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">DRE por SCP até o EBITDA. Depreciação, resultado financeiro e impostos não são rateados por SCP (entram só na DRE geral da empresa, na aba Fluxo de caixa). As deduções usam a alíquota configurada (padrão 15%).</p>
    </>
  );
}

/* ---------- apresentação aos sócios (relatório mensal, pronto para PDF) ---------- */
function Delta({ atual, anterior, inverso }) {
  const v = variacaoPct(atual, anterior);
  if (v == null) return <span style={{ color: C.mute, fontSize: 12 }}>—</span>;
  const quase = Math.abs(v) < 0.05;
  const bom = inverso ? v < 0 : v > 0;
  const cor = quase ? C.mute : bom ? C.emerald : C.brick;
  const seta = quase ? "■" : v > 0 ? "▲" : "▼";
  return <span style={{ color: cor, fontSize: 12, fontWeight: 600 }}>{seta} {Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>;
}

function gerarDestaques(d, dPrev, ind, indPrev, contas) {
  const out = [];
  const vRec = variacaoPct(d.receitaLiquida, dPrev?.receitaLiquida);
  if (vRec != null) out.push(`Receita líquida ${vRec >= 0 ? "cresceu" : "recuou"} ${Math.abs(vRec).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% frente ao período anterior, somando ${brl(d.receitaLiquida)}.`);
  else out.push(`Receita líquida de ${brl(d.receitaLiquida)} no período.`);
  const vEb = variacaoPct(d.ebitda, dPrev?.ebitda);
  out.push(`EBITDA de ${brl(d.ebitda)} (margem ${pct(ind.rentabilidade.margemEbitda)})${vEb != null ? `, variação de ${vEb >= 0 ? "+" : ""}${vEb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : ""}.`);
  out.push(`Lucro líquido de ${brl(d.lucroLiquido)}, margem líquida de ${pct(ind.rentabilidade.margemLiquida)}.`);
  out.push(`Liquidez corrente em ${mult(ind.liquidez.corrente)} e dívida líquida/EBITDA em ${mult(ind.endividamento.dlEbitda)}.`);
  const venc = (contas?.receber?.itens || []).filter((i) => i.status === "ATRASADO").reduce((s, i) => s + i.aberto, 0);
  const vencP = (contas?.pagar?.itens || []).filter((i) => i.status === "ATRASADO").reduce((s, i) => s + i.aberto, 0);
  if (venc || vencP) out.push(`Em atraso: ${brl(venc)} a receber e ${brl(vencP)} a pagar — priorizar cobrança/negociação.`);
  return out;
}

function PainelApresentacao({ empresa, comparativo, periodo, contas, projetos, categorias, serie, projecao, composicaoAtivo, ind, saude }) {
  const top5Despesas = (categorias || []).filter((p) => p.despesa > 0)
    .sort((a, b) => b.despesa - a.despesa).slice(0, 5)
    .map((p) => ({ nome: p.nome.length > 22 ? p.nome.slice(0, 21) + "…" : p.nome, Despesa: Math.round(p.despesa) }));
  const d = empresa.dre, b = empresa.balanco;
  const indPrev = comparativo ? calcularIndicadores(comparativo) : null;
  const dPrev = comparativo?.dre || null;
  const hoje = new Date().toLocaleDateString("pt-BR");
  const ao = !!empresa.serieMensal?.length;
  const escopoNome = empresa.escopo ? empresa.escopo.nome : "Consolidado (todas as SCPs)";

  // Título da aba/PDF reflete a SCP apresentada (vira o nome sugerido do PDF).
  useEffect(() => {
    const anterior = document.title;
    document.title = `Apresentação — ${escopoNome} — ${empresa.nome}`;
    return () => { document.title = anterior; };
  }, [escopoNome, empresa.nome]);

  const KPIS = [
    { l: "Receita líquida", v: brl(d.receitaLiquida), a: d.receitaLiquida, p: dPrev?.receitaLiquida },
    { l: "EBITDA", v: brl(d.ebitda), a: d.ebitda, p: dPrev?.ebitda },
    { l: "Lucro líquido", v: brl(d.lucroLiquido), a: d.lucroLiquido, p: dPrev?.lucroLiquido },
    { l: "Margem líquida", v: pct(ind.rentabilidade.margemLiquida), a: ind.rentabilidade.margemLiquida, p: indPrev?.rentabilidade.margemLiquida },
    { l: "Caixa", v: brl(b.caixa), a: b.caixa, p: comparativo?.balanco?.caixa },
    { l: "Dívida líq./EBITDA", v: mult(ind.endividamento.dlEbitda), a: ind.endividamento.dlEbitda, p: indPrev?.endividamento.dlEbitda, inverso: true },
  ];

  const LINHAS_COMP = [
    ["Receita bruta", d.receitaBruta, dPrev?.receitaBruta],
    ["(–) Deduções", d.deducoes, dPrev?.deducoes, true],
    ["Receita líquida", d.receitaLiquida, dPrev?.receitaLiquida],
    ["(–) CMV / custos", d.cmv, dPrev?.cmv, true],
    ["Lucro bruto", d.lucroBruto, dPrev?.lucroBruto],
    ["(–) Despesas operacionais", d.despesasOper, dPrev?.despesasOper, true],
    ["EBITDA", d.ebitda, dPrev?.ebitda],
    ["Lucro líquido", d.lucroLiquido, dPrev?.lucroLiquido],
  ];

  const destaques = gerarDestaques(d, dPrev, ind, indPrev, contas);

  return (
    <div className="apresentacao">
      {/* Rodapé repetido em todas as páginas do PDF (só na impressão) */}
      <div className="print-footer">
        Confidencial · {empresa.nome}{empresa.escopo ? ` — ${empresa.escopo.nome}` : " — Consolidado"} · Gerado em {hoje}
      </div>

      <div className="ap-toolbar no-print">
        <span style={{ fontSize: 13, color: C.mute }}>Relatório pronto para projetar ou salvar em PDF.</span>
        <button className="preset export" onClick={() => window.print()}>🖨 Imprimir / Salvar PDF</button>
      </div>

      {/* CAPA */}
      <section className="slide ap-capa">
        <div style={{ marginBottom: 22 }}><MarcaHI size={54} tagline dark /></div>
        <div className="eyebrow" style={{ color: "#43C796" }}>Apresentação — {escopoNome}</div>
        <h1 className="disp" style={{ fontSize: 30, margin: "8px 0 4px", color: "#fff" }}>{empresa.nome}</h1>
        <div style={{ color: "#9FB2C0" }}>
          {empresa.escopo
            ? <>SCP <b style={{ color: "#fff" }}>{empresa.escopo.nome}</b> · {periodo.inicio} a {periodo.fim}</>
            : <>Consolidado de todas as SCPs · {periodo.inicio} a {periodo.fim}</>}
        </div>
        <div className="mono" style={{ fontSize: 12, color: "#8FA5B2", marginTop: 4 }}>
          Período: {periodo.inicio} a {periodo.fim} · Gerado em {hoje} · {ao ? "dados ERP D9" : "dados de exemplo"}
        </div>
        <div className="scorebox" style={{ marginTop: 18 }}>
          <Gauge value={saude.total} />
          <div>
            <div style={{ fontSize: 13, color: "#9FB2C0" }}>Saúde financeira geral</div>
            <div className="disp" style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>
              {saude.total >= 70 ? "Posição sólida" : saude.total >= 45 ? "Equilíbrio com pontos de atenção" : "Requer ação"}
            </div>
          </div>
        </div>
      </section>

      {/* SUMÁRIO EXECUTIVO */}
      <section className="slide">
        <div className="section-h">Sumário executivo {comparativo && <span className="tag ok" style={{ marginLeft: 4 }}>vs. período anterior</span>}</div>
        <div className="grid g3">
          {KPIS.map((k, i) => (
            <div className="card" key={i}>
              <div className="label">{k.l}</div>
              <div className="big">{k.v}</div>
              <div className="sub"><Delta atual={k.a} anterior={k.p} inverso={k.inverso} /> {comparativo ? "vs. anterior" : ""}</div>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARATIVO DRE */}
      <section className="slide quebra">
        <div className="section-h">Comparativo — período atual × anterior</div>
        {!comparativo && <p className="note" style={{ marginTop: -6 }}>Conecte os dados ao vivo do ERP D9 para preencher a coluna do período anterior.</p>}
        <div className="card" style={{ padding: "4px 0", overflowX: "auto" }}>
          <table className="dre lista">
            <thead><tr><th>Linha</th><th className="n">Atual</th><th className="n">Anterior</th><th className="n">Variação</th></tr></thead>
            <tbody>
              {LINHAS_COMP.map(([l, atual, ant, neg], i) => (
                <tr key={i} className={/líquid|EBITDA|bruto/i.test(l) ? "tot" : ""}>
                  <td>{l}</td>
                  <td className="n">{neg ? `(${brl(atual)})` : brl(atual)}</td>
                  <td className="n">{ant == null ? "—" : neg ? `(${brl(ant)})` : brl(ant)}</td>
                  <td className="n"><Delta atual={atual} anterior={ant} inverso={!!neg} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* DESEMPENHO MENSAL */}
      <section className="slide quebra">
        <div className="section-h">Desempenho mensal</div>
        <div className="chart-card">
          <div className="chart-title">Receita × custos+despesas (R$ mil)</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={serie} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => brlK(v * 1000)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
              <Bar dataKey="receita" name="Receita" fill={C.emerald} radius={[3, 3, 0, 0]} />
              <Bar dataKey="custos" name="Custos+despesas" fill={C.inkSoft} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* INDICADORES PRINCIPAIS */}
      <section className="slide quebra">
        <div className="section-h">Indicadores principais</div>
        <div className="grid g4">
          <Indicador label="Margem bruta" valor={pct(ind.rentabilidade.margemBruta)} pctFill={ind.rentabilidade.margemBruta} status={st(1)} />
          <Indicador label="Margem EBITDA" valor={pct(ind.rentabilidade.margemEbitda)} pctFill={ind.rentabilidade.margemEbitda * 2} status={st(1)} />
          <Indicador label="ROE" valor={pct(ind.rentabilidade.roe)} sub="Retorno sobre patrimônio" pctFill={ind.rentabilidade.roe * 3} fill={C.gold} status={st(1)} />
          <Indicador label="Liquidez corrente" valor={mult(ind.liquidez.corrente)} sub="Ativo circ. / Passivo circ." pctFill={ind.liquidez.corrente * 50} status={st(ind.liquidez.corrente >= 1.3 ? 1 : 0)} />
          <Indicador label="Endividamento geral" valor={pct(ind.endividamento.geral)} sub="Passivo / Ativo" pctFill={ind.endividamento.geral} fill={C.gold} status={st(ind.endividamento.geral <= 60 ? 0 : -1)} />
          <Indicador label="Dívida líq./EBITDA" valor={mult(ind.endividamento.dlEbitda)} sub="Alavancagem" pctFill={ind.endividamento.dlEbitda * 30} status={st(ind.endividamento.dlEbitda <= 2 ? 1 : 0)} />
          <Indicador label="Ciclo de caixa" valor={dias(ind.ciclo.caixa)} sub="Dias financiando a operação" pctFill={ind.ciclo.caixa} fill={C.gold} status={st(ind.ciclo.caixa <= 60 ? 1 : 0)} />
          <Indicador label="ROA" valor={pct(ind.rentabilidade.roa)} sub="Retorno sobre ativos" pctFill={ind.rentabilidade.roa * 5} fill={C.gold} status={st(1)} />
        </div>
        <div className="chart-card" style={{ marginTop: 14 }}>
          <div className="chart-title">Composição do ativo</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={composicaoAtivo} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2}>
                {composicaoAtivo.map((e, i) => <Cell key={i} fill={e.c} />)}
              </Pie>
              <Tooltip formatter={(v) => brl(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* CONTAS / AGING */}
      <section className="slide quebra">
        <AgingContas contas={contas} />
        <div className="grid g2" style={{ marginTop: 12 }}>
          <Indicador label="A receber em aberto" valor={brl(contas?.receber?.totalAberto || 0)} sub={`${contas?.receber?.qtdAbertas || 0} título(s)`} fill={C.emerald} />
          <Indicador label="A pagar em aberto" valor={brl(contas?.pagar?.totalAberto || 0)} sub={`${contas?.pagar?.qtdAbertas || 0} título(s)`} fill={C.brick} />
        </div>
      </section>

      {/* PROJETOS */}
      <section className="slide quebra">
        <DrePorProjeto projetos={projetos} />
      </section>

      {/* TOP 5 DESPESAS POR CATEGORIA */}
      <section className="slide quebra">
        <div className="section-h">Maiores despesas por categoria (Top 5)</div>
        {top5Despesas.length ? (
          <div className="chart-card">
            <ResponsiveContainer width="100%" height={Math.max(180, top5Despesas.length * 48)}>
              <BarChart layout="vertical" data={top5Despesas} margin={{ top: 6, right: 60, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} tickFormatter={(v) => "R$" + (v / 1000).toFixed(0) + "k"} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 12, fill: C.ink }} axisLine={false} tickLine={false} width={160} />
                <Tooltip formatter={(v) => brl(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
                <Bar dataKey="Despesa" fill={C.brick} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="note">Sem despesas por categoria no período.</p>}
      </section>

      {/* PROJEÇÃO DE CAIXA */}
      <section className="slide quebra">
        <div className="section-h">Projeção de caixa — 12 meses</div>
        <div className="chart-card">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={projecao} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => brlK(v * 1000)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
              <ReferenceLine y={0} stroke={C.brick} strokeDasharray="4 4" />
              <Line dataKey="otimista" name="Otimista" stroke={C.emeraldSoft} strokeWidth={2} dot={false} />
              <Line dataKey="base" name="Base" stroke={C.ink} strokeWidth={2.5} dot={false} />
              <Line dataKey="pessimista" name="Pessimista" stroke={C.brick} strokeWidth={2} dot={false} strokeDasharray="5 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* DESTAQUES */}
      <section className="slide quebra">
        <div className="section-h">Destaques e observações</div>
        <div className="card">
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
            {destaques.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
        <p className="note">Cada SCP é um projeto no ERP D9; “Health Importer (não alocado)” é o que ainda não foi marcado em uma SCP. Alíquotas de deduções e impostos são estimativas configuráveis. Itens puramente contábeis (estoques, imobilizado, PL) seguem o que foi informado. Depreciação e impostos não são rateados por SCP.</p>
      </section>
    </div>
  );
}

/* ---------- conciliação bancária (sobe OFX, cruza com o ERP D9) ---------- */
function TabelaConcil({ titulo, dados, cols }) {
  return (
    <>
      <div className="section-h">{titulo} <span className="tag mid" style={{ marginLeft: 4 }}>{dados.length}</span></div>
      <div className="card" style={{ padding: "4px 0", overflowX: "auto" }}>
        <table className="dre lista">
          <thead><tr>{cols.map((c) => <th key={c.k} className={c.n ? "n" : ""}>{c.l}</th>)}</tr></thead>
          <tbody>
            {dados.length === 0 && <tr><td colSpan={cols.length} style={{ textAlign: "center", color: C.mute, padding: 16 }}>Nada aqui.</td></tr>}
            {dados.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.k} className={c.n ? "n" : ""} style={c.k === "valor" ? { color: r.valor >= 0 ? C.emerald : C.brick } : undefined}>
                    {c.k === "valor" ? brl(r.valor) : (r[c.k] || "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PainelConciliacao() {
  const [arquivos, setArquivos] = useState([]); // [{ nome, conteudo }]
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [res, setRes] = useState(null);

  function aoSelecionar(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!files.length) return;
    Promise.all(files.map((f) => new Promise((resolve) => {
      const rd = new FileReader();
      rd.onload = () => resolve({ nome: f.name, conteudo: String(rd.result || "") });
      rd.onerror = () => resolve(null);
      rd.readAsText(f, "latin1");
    }))).then((lidos) => setArquivos((prev) => [...prev, ...lidos.filter(Boolean)]));
  }

  function conciliarTudo() {
    if (!arquivos.length) return;
    setErro(null); setRes(null); setCarregando(true);
    fetch("/api/conciliacao", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ofxs: arquivos }),
    })
      .then(async (r) => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error((d && (d.detalhe || d.erro)) || `HTTP ${r.status}`); return d; })
      .then((d) => setRes(d))
      .catch((er) => setErro(er.message))
      .finally(() => setCarregando(false));
  }

  return (
    <>
      <div className="section-h">Conciliação bancária</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="note" style={{ marginTop: 0 }}>
          Exporte o extrato de <b>cada banco</b> em <b>.OFX</b> e suba todos aqui (pode selecionar vários de uma vez
          ou ir adicionando). Eu cruzo com os lançamentos do ERP D9 por <b>valor e data</b> (tolerância de 3 dias) e mostro
          o que conciliou, o que está <b>só no extrato</b> (ex.: tarifas a lançar) e o que está <b>só no ERP D9</b>.
          Não altera nada no ERP D9.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label className="preset export" style={{ display: "inline-block", cursor: "pointer" }}>
            📄 Adicionar extrato(s) OFX
            <input type="file" accept=".ofx,.OFX,text/plain" multiple style={{ display: "none" }} onChange={aoSelecionar} />
          </label>
          <button className="preset" disabled={!arquivos.length || carregando} onClick={conciliarTudo}>
            ⚖ Conciliar {arquivos.length ? `(${arquivos.length})` : ""}
          </button>
          {arquivos.length > 0 && <button className="preset" onClick={() => { setArquivos([]); setRes(null); }}>Limpar</button>}
        </div>
        {arquivos.length > 0 && (
          <div style={{ display: "flex", gap: "6px 10px", flexWrap: "wrap", marginTop: 12 }}>
            {arquivos.map((a, i) => (
              <span key={i} className="tag mid" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {a.nome}
                <b style={{ cursor: "pointer" }} onClick={() => setArquivos((prev) => prev.filter((_, k) => k !== i))}>×</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {carregando && <p className="note">◌ conciliando com o ERP D9…</p>}
      {erro && <p className="note" style={{ color: C.brick }}>● {erro}</p>}

      {res && (
        <>
          <div className="grid g4" style={{ marginBottom: 6 }}>
            <Indicador label="Linhas no extrato" valor={String(res.resumo.extratoQtd)} sub={res.periodo} fill={C.inkSoft} />
            <Indicador label="Conciliados" valor={String(res.resumo.conciliados)} sub="Bateram com o ERP D9" fill={C.emerald} status={{ t: "ok", l: "OK" }} />
            <Indicador label="Só no extrato" valor={brl(res.resumo.soExtratoValor)} sub={`${res.resumo.soExtratoQtd} a lançar no ERP D9`} fill={C.gold} status={res.resumo.soExtratoQtd ? { t: "at", l: "Pendente" } : { t: "ok", l: "—" }} />
            <Indicador label="Só no ERP D9" valor={brl(res.resumo.soOmieValor)} sub={`${res.resumo.soOmieQtd} sem extrato`} fill={C.brick} status={res.resumo.soOmieQtd ? { t: "mid", l: "Verificar" } : { t: "ok", l: "—" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "8px 0 4px" }}>
            <span className="note" style={{ margin: 0 }}>
              {res.resumo.bancos?.length > 1 && <>Extratos: {res.resumo.bancos.map((b) => `${b.nome} (${b.qtd})`).join(" · ")}</>}
            </span>
            <button className="preset export" disabled={!(res.resumo.conciliados + res.resumo.soExtratoQtd + res.resumo.soOmieQtd)} onClick={() => exportarConciliacao(res)}>
              ⬇ Exportar conciliação (Excel)
            </button>
          </div>

          <TabelaConcil titulo="Só no extrato — lançar no ERP D9" dados={res.soExtrato}
            cols={[{ k: "data", l: "Data" }, { k: "banco", l: "Banco" }, { k: "descricao", l: "Descrição (banco)" }, { k: "valor", l: "Valor", n: true }]} />
          <TabelaConcil titulo="Só no ERP D9 — não caiu no extrato" dados={res.soOmie}
            cols={[{ k: "data", l: "Data" }, { k: "descricao", l: "Lançamento ERP D9" }, { k: "valor", l: "Valor", n: true }]} />
          <TabelaConcil titulo="Conciliados" dados={res.conciliados}
            cols={[{ k: "data", l: "Data" }, { k: "banco", l: "Banco" }, { k: "extrato", l: "Extrato" }, { k: "omie", l: "ERP D9" }, { k: "valor", l: "Valor", n: true }]} />
        </>
      )}
    </>
  );
}

function PeriodoBar({ periodo, onChange }) {
  const presets = presetsPeriodo();
  return (
    <div className="periodo-bar">
      {presets.map((p) => {
        const on = p.inicio === periodo.inicio && p.fim === periodo.fim;
        return (
          <button key={p.id} className={"preset" + (on ? " on" : "")}
            onClick={() => onChange({ inicio: p.inicio, fim: p.fim })}>{p.nome}</button>
        );
      })}
      <div className="campo">
        <label>de</label>
        <input type="date" value={brParaISO(periodo.inicio)}
          onChange={(e) => onChange({ ...periodo, inicio: isoParaBR(e.target.value) })} />
      </div>
      <div className="campo">
        <label>até</label>
        <input type="date" value={brParaISO(periodo.fim)}
          onChange={(e) => onChange({ ...periodo, fim: isoParaBR(e.target.value) })} />
      </div>
    </div>
  );
}

// Seletor de SCP no topo: "Geral (todas as SCPs)" = consolidado da empresa.
// A Healthycann não usa SCP — sem SCPs disponíveis o seletor some.
function ScpBar({ scps, value, onChange }) {
  if (!scps || scps.length === 0) return null;
  const valDe = (p) => (p.codigo == null ? "__nao_alocado" : String(p.codigo));
  return (
    <div className="scp-bar">
      <label>SCP:</label>
      <select className="scp-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Geral (todas as SCPs)</option>
        {(scps || []).map((p) => <option key={valDe(p)} value={valDe(p)}>{p.nome}</option>)}
      </select>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
export default function PainelFinanceiro() {
  const [aba, setAba] = useState("visao");

  // Período selecionado (dd/mm/aaaa). Padrão = ano corrente até hoje,
  // igual ao default do conector.
  const [periodo, setPeriodo] = useState(() => {
    const hoje = new Date();
    return { inicio: fmtBR(new Date(hoje.getFullYear(), 0, 1)), fim: fmtBR(hoje) };
  });

  // SCP selecionada no topo ("" = consolidado / geral; "__nao_alocado"; ou código)
  const [scp, setScp] = useState("");

  // Dados vindos do conector ERP D9 (com fallback para o exemplo)
  const [empresa, setEmpresa] = useState(empresaExemplo);
  const [carregando, setCarregando] = useState(true);
  const [erroApi, setErroApi] = useState(null);
  const [atualizadoEm, setAtualizadoEm] = useState(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    const q = scp ? `&projeto=${encodeURIComponent(scp)}` : "";
    const url = `${API_URL}?inicio=${encodeURIComponent(periodo.inicio)}&fim=${encodeURIComponent(periodo.fim)}${q}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data && data.erro) throw new Error(data.detalhe || data.erro);
        if (!data || !data.balanco || !data.dre)
          throw new Error("Resposta sem balanço/DRE");
        if (ativo) {
          setEmpresa(data);
          setErroApi(null);
          setAtualizadoEm(new Date());
        }
      })
      .catch((e) => {
        if (ativo) setErroApi(e.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [periodo.inicio, periodo.fim, scp]);

  // Recarrega os dados. forcar=true (botão) ignora o cache do servidor; o
  // auto-refresh usa forcar=false (mais leve, respeita o cache de 3 min).
  function atualizar(forcar = true) {
    setCarregando(true);
    const q = scp ? `&projeto=${encodeURIComponent(scp)}` : "";
    const f = forcar ? "&atualizar=1" : "";
    fetch(`${API_URL}?inicio=${encodeURIComponent(periodo.inicio)}&fim=${encodeURIComponent(periodo.fim)}${q}${f}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        if (data && data.erro) throw new Error(data.detalhe || data.erro);
        if (!data || !data.balanco || !data.dre) throw new Error("Resposta sem balanço/DRE");
        setEmpresa(data); setErroApi(null); setAtualizadoEm(new Date());
      })
      .catch((e) => setErroApi(e.message))
      .finally(() => setCarregando(false));
  }

  // Atualização automática: a cada 3 min (só com a aba visível), sem forçar
  // (respeita o cache, evita sobrecarregar o ERP D9). Edições aparecem sozinhas.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") atualizar(false);
    }, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, [periodo.inicio, periodo.fim, scp]);

  const ind = useMemo(() => calcularIndicadores(empresa), [empresa]);
  const saude = useMemo(() => calcularSaude(ind), [ind]);
  const d = empresa.dre;

  // Série mensal: usa a do conector (R$ cheios → convertidos p/ mil) ou o exemplo
  const serie = useMemo(() => {
    if (empresa.serieMensal?.length) {
      return empresa.serieMensal.map((m) => {
        const receita = m.receita / 1000, custos = m.custos / 1000;
        return { mes: m.mes, receita, custos, resultado: receita - custos };
      });
    }
    return serieMensalExemplo;
  }, [empresa]);
  const temDadosAoVivo = !!empresa.serieMensal?.length;
  const caixaInicialMil = temDadosAoVivo ? empresa.balanco.caixa / 1000 : 480;

  const protegido = !!empresa.protegido; // true quando o conector exige login

  // Contas e projetos: ao vivo do conector, ou exemplo quando offline
  const contas = empresa.contas || contasExemplo;
  const projetos = empresa.projetos?.length ? empresa.projetos
    : (temDadosAoVivo ? [] : projetosExemplo);
  const categoriasDados = empresa.porCategoria?.length ? empresa.porCategoria
    : (temDadosAoVivo ? [] : categoriasExemplo);

  // Comparativo: busca o período anterior (mesma duração) quando a aba
  // Apresentação está aberta e há dados ao vivo. Cacheado por período.
  const [comparativo, setComparativo] = useState(null);
  useEffect(() => {
    setComparativo(null);
    if (aba !== "apresentacao" || !temDadosAoVivo) return;
    const ant = periodoAnterior(periodo.inicio, periodo.fim);
    if (!ant) return;
    let ativo = true;
    const q = scp ? `&projeto=${encodeURIComponent(scp)}` : "";
    const url = `${API_URL}?inicio=${encodeURIComponent(ant.inicio)}&fim=${encodeURIComponent(ant.fim)}${q}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (ativo && data && data.dre && !data.erro) setComparativo(data); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [aba, temDadosAoVivo, periodo.inicio, periodo.fim, scp]);

  // Valuation interativo
  const [wacc, setWacc] = useState(14);
  const [cresc, setCresc] = useState(6);
  const [gPerp, setGPerp] = useState(3.5);
  const [multiplo, setMultiplo] = useState(6.5);

  const valuation = useMemo(() => {
    const fcf0 = 566400; const w = wacc/100, g = cresc/100, gp = gPerp/100;
    let pv = 0, fcf = fcf0, ultimo = fcf0;
    for (let t=1; t<=5; t++){ fcf = fcf0*Math.pow(1+g,t); pv += fcf/Math.pow(1+w,t); ultimo = fcf; }
    const terminal = ultimo*(1+gp)/(w-gp);
    const pvTerminal = terminal/Math.pow(1+w,5);
    const evDcf = pv + pvTerminal;
    const evMult = d.ebitda*multiplo;
    const equityDcf = evDcf - ind.dividaLiquida;
    const equityMult = evMult - ind.dividaLiquida;
    return { evDcf, evMult, equityDcf, equityMult };
  }, [wacc, cresc, gPerp, multiplo, d.ebitda, ind.dividaLiquida]);

  // Projeção de caixa 12 meses (3 cenários), partindo do caixa atual e do
  // fluxo líquido mensal realizado (ou do exemplo, quando offline)
  const projecao = useMemo(() => {
    const baseFlowDemo = [38,42,55,40,33,28,45,58,50,62,41,30]; // R$ mil, fluxo líquido/mês
    let base=caixaInicialMil, oti=caixaInicialMil, pes=caixaInicialMil;
    return serie.map((m,i)=>{
      const f = temDadosAoVivo ? m.resultado : baseFlowDemo[i];
      base += f; oti += f*1.35; pes += f*0.55 - 18;
      return { mes:m.mes, base:Math.round(base), otimista:Math.round(oti), pessimista:Math.round(pes) };
    });
  }, [serie, temDadosAoVivo, caixaInicialMil]);

  const composicaoAtivo = [
    { name:"Caixa", value:empresa.balanco.caixa, c:C.emerald },
    { name:"Recebíveis", value:empresa.balanco.contasReceber, c:C.emeraldSoft },
    { name:"Estoques", value:empresa.balanco.estoques, c:C.gold },
    { name:"Imobilizado", value:empresa.balanco.imobilizado, c:C.inkSoft },
    { name:"Intangível", value:empresa.balanco.intangivel, c:C.mute },
  ];

  return (
    <div className="fin-root">
      <style>{css}</style>

      {/* CONSOLE / HERO */}
      <div className="console"><div className="console-inner">
        <div className="topo-acoes">
          <button className="sair-btn" onClick={() => atualizar(true)} disabled={carregando} title="Recarregar ignorando o cache (reflete edições feitas no ERP D9)">
            {carregando ? "◌ Atualizando…" : "🔄 Atualizar"}
          </button>
          {protegido && <button className="sair-btn" onClick={sair} title="Encerrar a sessão (pede login de novo)">Sair</button>}
        </div>
        <div className="eyebrow">Painel de gestão financeira</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <GloboHI size={40} />
          <h1 className="disp" style={{ margin: 0 }}>{empresa.nome}</h1>
        </div>
        <div className="periodo">{empresa.periodo}</div>
        <div className="periodo" style={{marginTop:4,fontSize:11,fontFamily:"'IBM Plex Mono',monospace",letterSpacing:".04em"}}>
          {carregando
            ? "◌ conectando ao ERP D9…"
            : erroApi
            ? `● sem conexão com o ERP D9 — usando dados de exemplo (${erroApi})`
            : `● dados ao vivo do ERP D9${atualizadoEm ? ` · atualizado ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (atualiza sozinho a cada 3 min)` : ""}`}
        </div>

        <PeriodoBar periodo={periodo} onChange={setPeriodo} />
        <ScpBar scps={empresa.scpsDisponiveis} value={scp} onChange={setScp} />
        {empresa.escopo && (
          <div className="scp-aviso">
            Exibindo <b>{empresa.escopo.nome}</b> — DRE, desempenho mensal e contas filtrados para esta SCP.
            Balanço, caixa e indicadores de balanço seguem <b>consolidados</b> da empresa.
          </div>
        )}

        <div className="scorebox" style={{marginTop:18}}>
          <Gauge value={saude.total} />
          <div>
            <div style={{fontSize:13,color:"#8FA5B2"}}>Saúde financeira geral</div>
            <div className="disp" style={{fontSize:18,fontWeight:600,margin:"2px 0 6px"}}>
              {saude.total>=70?"Posição sólida":saude.total>=45?"Equilíbrio com pontos de atenção":"Requer ação"}
            </div>
            <div style={{display:"flex",gap:14,flexWrap:"wrap",fontSize:11,color:"#8FA5B2"}}>
              <span>Liquidez {Math.round(saude.sLiq)}</span>
              <span>Endivid. {Math.round(saude.sEnd)}</span>
              <span>Rentab. {Math.round(saude.sRent)}</span>
              <span>Ciclo {Math.round(saude.sCiclo)}</span>
            </div>
          </div>
        </div>

        <div className="vitals">
          <Vital k="Receita líquida" v={brlK(d.receitaLiquida)} />
          <Vital k="EBITDA" v={brlK(d.ebitda)} tone="pos" />
          <Vital k="Lucro líquido" v={brlK(d.lucroLiquido)} tone="pos" />
          <Vital k="Margem líquida" v={pct(ind.rentabilidade.margemLiquida)} />
          <Vital k="Dívida líq./EBITDA" v={mult(ind.endividamento.dlEbitda)} />
          <Vital k="Ciclo de caixa" v={dias(ind.ciclo.caixa)} />
        </div>
      </div></div>

      <div className="fin-wrap">
        <div className="tabs">
          {[["visao","Visão geral"],["apresentacao","Apresentação"],["contas","Contas"],["categorias","Categorias"],["vendas","Vendas"],["dre","DRE"],["orcamento","Orçamento"],["conciliacao","Conciliação"],["indicadores","Indicadores"],["caixa","Fluxo de caixa"],["valuation","Valuation"]]
            .map(([id,nome])=>(
            <button key={id} className={"tab"+(aba===id?" on":"")} onClick={()=>setAba(id)}>{nome}</button>
          ))}
        </div>

        {/* ---------- VISÃO GERAL ---------- */}
        {aba==="visao" && (<>
          <div className="grid g4">
            <Indicador label="Margem bruta" valor={pct(ind.rentabilidade.margemBruta)} pctFill={ind.rentabilidade.margemBruta} fill={C.emerald} status={st(1)} />
            <Indicador label="Margem EBITDA" valor={pct(ind.rentabilidade.margemEbitda)} pctFill={ind.rentabilidade.margemEbitda*2} fill={C.emerald} status={st(1)} />
            <Indicador label="ROE" valor={pct(ind.rentabilidade.roe)} sub="Retorno sobre patrimônio" pctFill={ind.rentabilidade.roe*3} fill={C.gold} status={st(1)} />
            <Indicador label="ROA" valor={pct(ind.rentabilidade.roa)} sub="Retorno sobre ativos" pctFill={ind.rentabilidade.roa*5} fill={C.gold} status={st(1)} />
          </div>

          <div className="section-h">Receita × custos ao longo do ano</div>
          <div className="chart-card">
            <div className="chart-title">Desempenho mensal (R$ mil)</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={serie} margin={{top:6,right:8,left:-8,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="mes" tick={{fontSize:11,fill:C.mute}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:11,fill:C.mute}} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v)=>brlK(v*1000)} contentStyle={{fontSize:12,borderRadius:8,border:`1px solid ${C.line}`}} />
                <Bar dataKey="receita" name="Receita" fill={C.emerald} radius={[3,3,0,0]} />
                <Bar dataKey="custos" name="Custos+despesas" fill={C.inkSoft} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid g2" style={{marginTop:14}}>
            <div className="chart-card">
              <div className="chart-title">Composição do ativo</div>
              <div className="chart-sub">Onde o capital da empresa está alocado</div>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={composicaoAtivo} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2}>
                    {composicaoAtivo.map((e,i)=><Cell key={i} fill={e.c} />)}
                  </Pie>
                  <Tooltip formatter={(v)=>brl(v)} contentStyle={{fontSize:12,borderRadius:8,border:`1px solid ${C.line}`}} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:"flex",flexWrap:"wrap",gap:"6px 14px",padding:"0 8px 6px",fontSize:11,color:C.mute}}>
                {composicaoAtivo.map((e,i)=>(
                  <span key={i} style={{display:"flex",alignItems:"center",gap:5}}>
                    <i style={{width:9,height:9,borderRadius:2,background:e.c,display:"inline-block"}} />{e.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-title">Resultado mensal (R$ mil)</div>
              <div className="chart-sub">Receita líquida menos custos e despesas</div>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={serie} margin={{top:6,right:8,left:-8,bottom:0}}>
                  <defs><linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.emerald} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.emerald} stopOpacity={0} />
                  </linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="mes" tick={{fontSize:11,fill:C.mute}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:11,fill:C.mute}} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v)=>brlK(v*1000)} contentStyle={{fontSize:12,borderRadius:8,border:`1px solid ${C.line}`}} />
                  <Area dataKey="resultado" stroke={C.emerald} strokeWidth={2} fill="url(#gRes)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>)}

        {/* ---------- APRESENTAÇÃO ---------- */}
        {aba==="apresentacao" && (
          <PainelApresentacao
            empresa={empresa} comparativo={comparativo} periodo={periodo}
            contas={contas} projetos={projetos} categorias={categoriasDados} serie={serie} projecao={projecao}
            composicaoAtivo={composicaoAtivo} ind={ind} saude={saude} />
        )}

        {/* ---------- CONTAS ---------- */}
        {aba==="contas" && <PainelContas contas={contas} />}

        {/* ---------- PROJETOS ---------- */}
        {aba==="projetos" && <PainelProjetos projetos={projetos} />}

        {/* ---------- CATEGORIAS ---------- */}
        {aba==="categorias" && <PainelCategorias categorias={categoriasDados} categoriasMensal={empresa.categoriasMensal} />}

        {/* ---------- VENDAS ---------- */}
        {aba==="vendas" && <PainelVendas periodo={periodo} scp={scp} />}

        {/* ---------- DRE ---------- */}
        {aba==="dre" && <PainelDRE dre={empresa.dre} detalhe={empresa.dreDetalhe} competencia={empresa.dreCompetencia} dreMensal={empresa.dreMensal} escopo={empresa.escopo} premissas={empresa.premissas} periodo={periodo} scp={scp} />}

        {/* ---------- ORÇAMENTO ---------- */}
        {aba==="orcamento" && <PainelOrcamento categoriasMensal={empresa.categoriasMensal} />}

        {/* ---------- CONCILIAÇÃO ---------- */}
        {aba==="conciliacao" && <PainelConciliacao />}

        {/* ---------- INDICADORES ---------- */}
        {aba==="indicadores" && (<>
          <div className="section-h">Liquidez <span className="tag ok" style={{marginLeft:4}}>capacidade de pagar contas</span></div>
          <div className="grid g4">
            <Indicador label="Liquidez corrente" valor={mult(ind.liquidez.corrente)} sub="Ativo circ. / Passivo circ." pctFill={ind.liquidez.corrente*50} status={st(ind.liquidez.corrente>=1.3?1:0)} />
            <Indicador label="Liquidez seca" valor={mult(ind.liquidez.seca)} sub="Sem depender de estoque" pctFill={ind.liquidez.seca*70} status={st(ind.liquidez.seca>=1?1:0)} />
            <Indicador label="Liquidez imediata" valor={mult(ind.liquidez.imediata)} sub="Só com caixa disponível" pctFill={ind.liquidez.imediata*150} fill={C.gold} status={st(ind.liquidez.imediata>=0.3?1:0)} />
            <Indicador label="Liquidez geral" valor={mult(ind.liquidez.geral)} sub="Curto + longo prazo" pctFill={ind.liquidez.geral*70} fill={C.gold} status={st(ind.liquidez.geral>=1?1:0)} />
          </div>

          <div className="section-h">Rentabilidade</div>
          <div className="grid g3">
            <Indicador label="Margem bruta" valor={pct(ind.rentabilidade.margemBruta)} pctFill={ind.rentabilidade.margemBruta} status={st(1)} />
            <Indicador label="Margem EBITDA" valor={pct(ind.rentabilidade.margemEbitda)} pctFill={ind.rentabilidade.margemEbitda*2} status={st(1)} />
            <Indicador label="Margem líquida" valor={pct(ind.rentabilidade.margemLiquida)} pctFill={ind.rentabilidade.margemLiquida*5} status={st(ind.rentabilidade.margemLiquida>=5?1:0)} />
            <Indicador label="ROE" valor={pct(ind.rentabilidade.roe)} sub="Retorno sobre patrimônio" pctFill={ind.rentabilidade.roe*3} fill={C.gold} status={st(1)} />
            <Indicador label="ROA" valor={pct(ind.rentabilidade.roa)} sub="Retorno sobre ativos" pctFill={ind.rentabilidade.roa*5} fill={C.gold} status={st(1)} />
            <Indicador label="ROIC" valor={pct(ind.rentabilidade.roic)} sub="Retorno sobre capital investido" pctFill={ind.rentabilidade.roic*4} fill={C.gold} status={st(1)} />
          </div>

          <div className="section-h">Endividamento</div>
          <div className="grid g4">
            <Indicador label="Endividamento geral" valor={pct(ind.endividamento.geral)} sub="Passivo / Ativo total" pctFill={ind.endividamento.geral} fill={C.gold} status={st(ind.endividamento.geral<=60?0:-1)} />
            <Indicador label="Composição" valor={pct(ind.endividamento.composicao)} sub="% da dívida no curto prazo" pctFill={ind.endividamento.composicao} fill={C.gold} status={st(0)} />
            <Indicador label="Imobilização do PL" valor={pct(ind.endividamento.imobilizacaoPL)} sub="Imobilizado / Patrimônio" pctFill={ind.endividamento.imobilizacaoPL} fill={C.gold} status={st(0)} />
            <Indicador label="Dívida líq./EBITDA" valor={mult(ind.endividamento.dlEbitda)} sub="Alavancagem" pctFill={ind.endividamento.dlEbitda*30} status={st(ind.endividamento.dlEbitda<=2?1:0)} />
          </div>

          <div className="section-h">Ciclo financeiro</div>
          <div className="grid g4">
            <Indicador label="Prazo médio recebimento" valor={dias(ind.ciclo.pmr)} sub="Quanto demora p/ receber" pctFill={ind.ciclo.pmr} fill={C.inkSoft} />
            <Indicador label="Prazo médio estoque" valor={dias(ind.ciclo.pme)} sub="Giro do estoque" pctFill={ind.ciclo.pme} fill={C.inkSoft} />
            <Indicador label="Prazo médio pagamento" valor={dias(ind.ciclo.pmp)} sub="Prazo com fornecedores" pctFill={ind.ciclo.pmp} fill={C.emerald} />
            <Indicador label="Ciclo de caixa" valor={dias(ind.ciclo.caixa)} sub="Dias financiando a operação" pctFill={ind.ciclo.caixa} fill={C.gold} status={st(ind.ciclo.caixa<=60?1:0)} />
          </div>
        </>)}

        {/* ---------- FLUXO DE CAIXA ---------- */}
        {aba==="caixa" && (<>
          <div className="section-h">Projeção de saldo de caixa — 12 meses</div>
          <div className="chart-card">
            <div className="chart-title">Três cenários (R$ mil)</div>
            <div className="chart-sub">A partir do saldo atual de {brl(empresa.balanco.caixa)}</div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={projecao} margin={{top:6,right:8,left:-8,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="mes" tick={{fontSize:11,fill:C.mute}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:11,fill:C.mute}} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v)=>brlK(v*1000)} contentStyle={{fontSize:12,borderRadius:8,border:`1px solid ${C.line}`}} />
                <ReferenceLine y={0} stroke={C.brick} strokeDasharray="4 4" />
                <Line dataKey="otimista" name="Otimista" stroke={C.emeraldSoft} strokeWidth={2} dot={false} />
                <Line dataKey="base" name="Base" stroke={C.ink} strokeWidth={2.5} dot={false} />
                <Line dataKey="pessimista" name="Pessimista" stroke={C.brick} strokeWidth={2} dot={false} strokeDasharray="5 4" />
              </LineChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:18,flexWrap:"wrap",padding:"4px 8px 8px",fontSize:11,color:C.mute}}>
              <span style={{color:C.emeraldSoft}}>● Otimista</span>
              <span style={{color:C.ink}}>● Base</span>
              <span style={{color:C.brick}}>● Pessimista</span>
            </div>
          </div>

          <div className="grid g3" style={{marginTop:14}}>
            <Indicador label="Saldo projetado (base)" valor={brlK(projecao[11].base*1000)} sub="Em 12 meses" status={st(1)} />
            <Indicador label="Pior cenário" valor={brlK(projecao[11].pessimista*1000)} sub="Cenário pessimista" status={st(projecao[11].pessimista>0?0:-1)} />
            <Indicador label="Geração de caixa/ano" valor={brlK((projecao[11].base-caixaInicialMil)*1000)} sub="Fluxo líquido acumulado" status={st(1)} />
          </div>

          <div className="section-h">DRE resumida</div>
          <div className="card" style={{padding:"6px 18px"}}>
            <table className="dre"><tbody>
              <tr><td>Receita bruta</td><td className="n">{brl(d.receitaBruta)}</td></tr>
              <tr><td>(–) Deduções e impostos</td><td className="n">({brl(d.deducoes)})</td></tr>
              <tr className="tot"><td>Receita líquida</td><td className="n">{brl(d.receitaLiquida)}</td></tr>
              <tr><td>(–) CMV / CPV</td><td className="n">({brl(d.cmv)})</td></tr>
              <tr className="tot"><td>Lucro bruto</td><td className="n">{brl(d.lucroBruto)}</td></tr>
              <tr><td>(–) Despesas operacionais</td><td className="n">({brl(d.despesasOper)})</td></tr>
              <tr className="tot"><td>EBITDA</td><td className="n">{brl(d.ebitda)}</td></tr>
              <tr><td>(–) Depreciação</td><td className="n">({brl(d.depreciacao)})</td></tr>
              <tr><td>(–) Resultado financeiro</td><td className="n">({brl(d.resultadoFinanceiro)})</td></tr>
              <tr><td>(–) IR / CSLL</td><td className="n">({brl(d.impostos)})</td></tr>
              <tr className="tot"><td>Lucro líquido</td><td className="n">{brl(d.lucroLiquido)}</td></tr>
            </tbody></table>
          </div>

          <DREMensal dreMensal={empresa.dreMensal} />
        </>)}

        {/* ---------- VALUATION ---------- */}
        {aba==="valuation" && (<>
          <div className="section-h">Quanto vale a sua empresa</div>
          <p className="note" style={{marginTop:-4,marginBottom:16}}>
            Dois métodos lado a lado. Ajuste as premissas e veja o valor recalcular em tempo real.
            O fluxo de caixa livre base é estimado em {brl(566400)}/ano a partir do seu EBITDA.
          </p>

          <div className="grid g2">
            <div className="controls">
              <div style={{fontFamily:"'Space Grotesk'",fontWeight:600,fontSize:14}}>Premissas — Fluxo de Caixa Descontado</div>
              <div className="ctrl">
                <label>Taxa de desconto (WACC) <b>{wacc.toFixed(1)}%</b></label>
                <input type="range" min="8" max="22" step="0.5" value={wacc} onChange={e=>setWacc(+e.target.value)} />
              </div>
              <div className="ctrl">
                <label>Crescimento anual (5 anos) <b>{cresc.toFixed(1)}%</b></label>
                <input type="range" min="0" max="20" step="0.5" value={cresc} onChange={e=>setCresc(+e.target.value)} />
              </div>
              <div className="ctrl">
                <label>Crescimento na perpetuidade <b>{gPerp.toFixed(1)}%</b></label>
                <input type="range" min="0" max="6" step="0.5" value={gPerp} onChange={e=>setGPerp(+e.target.value)} />
              </div>
              <div style={{borderTop:`1px solid ${C.line}`,paddingTop:14,fontFamily:"'Space Grotesk'",fontWeight:600,fontSize:14}}>Premissa — Múltiplos de mercado</div>
              <div className="ctrl">
                <label>Múltiplo EV/EBITDA do setor <b>{multiplo.toFixed(1)}×</b></label>
                <input type="range" min="3" max="12" step="0.5" value={multiplo} onChange={e=>setMultiplo(+e.target.value)} />
              </div>
            </div>

            <div className="grid" style={{gridTemplateColumns:"1fr",gap:14}}>
              <div className="kpi-val">
                <div className="k">VALOR DA EMPRESA (DCF) — equity</div>
                <div className="v">{brl(valuation.equityDcf)}</div>
                <div style={{fontSize:11,color:"#8FA5B2",marginTop:6}}>EV {brl(valuation.evDcf)} − dívida líquida {brl(ind.dividaLiquida)}</div>
              </div>
              <div className="kpi-val" style={{background:C.gold}}>
                <div className="k" style={{color:"#FBEFD6"}}>VALOR DA EMPRESA (Múltiplos) — equity</div>
                <div className="v">{brl(valuation.equityMult)}</div>
                <div style={{fontSize:11,color:"#FBEFD6",marginTop:6}}>{multiplo.toFixed(1)}× EBITDA de {brl(d.ebitda)}</div>
              </div>
            </div>
          </div>

          <div className="section-h">Comparação dos métodos</div>
          <div className="chart-card">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart layout="vertical" data={[
                {nome:"DCF (equity)", valor:Math.round(valuation.equityDcf)},
                {nome:"Múltiplos (equity)", valor:Math.round(valuation.equityMult)},
              ]} margin={{top:6,right:60,left:20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
                <XAxis type="number" tick={{fontSize:11,fill:C.mute}} axisLine={false} tickLine={false} tickFormatter={(v)=>"R$"+(v/1e6).toFixed(1)+"M"} />
                <YAxis type="category" dataKey="nome" tick={{fontSize:12,fill:C.ink}} axisLine={false} tickLine={false} width={130} />
                <Tooltip formatter={(v)=>brl(v)} contentStyle={{fontSize:12,borderRadius:8,border:`1px solid ${C.line}`}} />
                <Bar dataKey="valor" radius={[0,4,4,0]}>
                  <Cell fill={C.ink} /><Cell fill={C.gold} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="note">
            DCF reflete a sua geração de caixa futura e premissas próprias; múltiplos refletem como o mercado
            precifica empresas parecidas. A diferença entre os dois é normal — a faixa entre eles costuma ser
            o intervalo razoável de negociação.
          </p>
        </>)}

        <p className="note" style={{marginTop:28,borderTop:`1px solid ${C.line}`,paddingTop:14}}>
          O painel consome o conector do ERP D9 em <span className="mono">{API_URL}</span> e recalcula todos os
          indicadores, gráficos, projeções e o valuation automaticamente. Sem conexão, exibe os dados de exemplo.
          Para apontar para outra URL, defina <span className="mono">window.PAINEL_API_URL</span> antes de montar o componente.
        </p>
      </div>
    </div>
  );
}
