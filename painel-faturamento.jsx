import React, { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, BarChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from "recharts";

/* ============================================================
   CAMADA DE DADOS
   O painel consome o conector da D9Pro (GET /api/operacao). Sem conexão,
   usa o exemplo abaixo como fallback — a tela nunca fica em branco.
   ============================================================ */
const API_OPERACAO =
  (typeof window !== "undefined" && window.PAINEL_API_URL) || "/api/operacao";
const API_PRODUTOS = "/api/produtos";
const API_COMISSOES = "/api/comissoes";
const API_RESUMO = "/api/resumo";
const API_VENDAS = "/api/vendas";

const vendasExemplo = {
  nome: "Healthycann",
  periodo: "Exercício 2026 — dados de exemplo",
  resumo: { faturamento: 249375, pedidos: 264, itensVendidos: 700 },
  produtos: [
    { nome: "HC BLISS (Delta 9: 10mg) GUMMY", sku: "BL10", quantidade: 268, faturamento: 72323, pedidos: 91 },
    { nome: "HC FULL SPECTRUM (3000mg CBD)", sku: "FS3000", quantidade: 158, faturamento: 72297, pedidos: 78 },
    { nome: "HC FULL SPECTRUM (1500mg CBD)", sku: "FS1500", quantidade: 157, faturamento: 49166, pedidos: 49 },
    { nome: "HC FULL SPECTRUM NEW (6000mg CBD)", sku: "FS6000NEW", quantidade: 45, faturamento: 28580, pedidos: 23 },
    { nome: "HC PLUS+", sku: "PL2000", quantidade: 72, faturamento: 27009, pedidos: 23 },
  ],
  porMes: [
    { chave: "2026-04", mes: "Abr/26", valor: 96000, qtd: 280 },
    { chave: "2026-05", mes: "Mai/26", valor: 112000, qtd: 320 },
    { chave: "2026-06", mes: "Jun/26", valor: 353513, qtd: 981 },
  ],
  porDia: [],
};

const resumoExemplo = {
  nome: "Healthycann",
  periodo: "Últimos 30 dias — dados de exemplo",
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

const operacaoExemplo = {
  nome: "Healthycann",
  periodo: "Exercício 2026 — dados de exemplo",
  resumo: { faturamento: 642300, qtdPedidos: 98, ticketMedio: 6554, frete: 0, recebido: 478000, aReceber: 164300 },
  porMes: [
    { chave: "2026-01", mes: "Jan/26", valor: 92000, qtd: 15 },
    { chave: "2026-02", mes: "Fev/26", valor: 104500, qtd: 16 },
    { chave: "2026-03", mes: "Mar/26", valor: 118000, qtd: 18 },
    { chave: "2026-04", mes: "Abr/26", valor: 99500, qtd: 15 },
    { chave: "2026-05", mes: "Mai/26", valor: 112300, qtd: 17 },
    { chave: "2026-06", mes: "Jun/26", valor: 116000, qtd: 17 },
  ],
  porStatus: [
    { oSId: "16", label: "Entregue", qtd: 41, valor: 286000, recebido: true },
    { oSId: "8", label: "Pago", qtd: 28, valor: 192000, recebido: true },
    { oSId: "14", label: "Verificando Documentação", qtd: 17, valor: 102300, recebido: false },
    { oSId: "1", label: "Analisando receita", qtd: 12, valor: 62000, recebido: false },
  ],
  porGrupo: [
    { grupo: "Comum", qtd: 64, valor: 430000 },
    { grupo: "Renovação", qtd: 22, valor: 142300 },
    { grupo: "Anuidade", qtd: 12, valor: 70000 },
  ],
  pedidos: [
    { orderId: "612", data: "21/06/2026", cliente: "Ester R.", cidade: "São Paulo", uf: "SP", status: "Entregue", grupo: "Comum", total: 7240, rastreio: "BR123456785BR" },
    { orderId: "609", data: "19/06/2026", cliente: "Marcos A.", cidade: "Curitiba", uf: "PR", status: "Pago", grupo: "Renovação", total: 4180, rastreio: "" },
    { orderId: "605", data: "15/06/2026", cliente: "Paula M.", cidade: "Salvador", uf: "BA", status: "Verificando Documentação", grupo: "Comum", total: 5320, rastreio: "" },
    { orderId: "601", data: "11/06/2026", cliente: "João S.", cidade: "Belo Horizonte", uf: "MG", status: "Analisando receita", grupo: "Anuidade", total: 1500, rastreio: "" },
    { orderId: "598", data: "08/06/2026", cliente: "Carla T.", cidade: "Rio de Janeiro", uf: "RJ", status: "Entregue", grupo: "Comum", total: 8990, rastreio: "BR987654321BR" },
  ],
  totalPedidos: 98,
  pedidosTruncados: false,
};

const produtosExemplo = {
  itens: [
    { pId: "1", nome: "Óleo Full Spectrum 30 mL", preco: 300, custo: 120, margem: 0.6, regras: 2 },
    { pId: "2", nome: "Óleo Isolado 30 mL", preco: 250, custo: 100, margem: 0.6, regras: 2 },
    { pId: "3", nome: "Cápsulas 60 un", preco: 200, custo: 90, margem: 0.55, regras: 1 },
    { pId: "6", nome: "Anuidade", preco: 150, custo: 0, margem: 1, regras: 1 },
  ],
};

const comissoesExemplo = {
  total: 23730,
  qtd: 4,
  porOperador: [
    { nome: "Bruno L.", valor: 8200 },
    { nome: "Aline F.", valor: 6450 },
    { nome: "Rafael C.", valor: 5100 },
    { nome: "Carla T.", valor: 3980 },
  ],
  colunas: ["Operador", "Pedidos", "Comissão"],
  colValor: "Comissão", colOper: "Operador",
  itens: [
    { Operador: "Bruno L.", Pedidos: "12", Comissão: "8200,00" },
    { Operador: "Aline F.", Pedidos: "10", Comissão: "6450,00" },
    { Operador: "Rafael C.", Pedidos: "8", Comissão: "5100,00" },
    { Operador: "Carla T.", Pedidos: "6", Comissão: "3980,00" },
  ],
  aviso: null,
};

/* ============================================================
   FORMATADORES / TEMA
   ============================================================ */
const C = {
  ink: "#13212E", inkSoft: "#22384A", paper: "#F4F6F3", surface: "#FFFFFF",
  line: "#E1E6E0", emerald: "#0B7A55", emeraldSoft: "#13A06F", gold: "#B07D2B",
  brick: "#B23A2E", mute: "#65757F", paperLine: "#2E4456",
};
const PALETA = [C.emerald, C.emeraldSoft, C.gold, C.brick, "#3E6B8B", "#7A5BA6"];

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brlK = (v) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const int = (v) => Number(v || 0).toLocaleString("pt-BR");
const pct = (v) => (Number(v || 0) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "%";
const pctDe = (a, b) => (b ? Math.round((Number(a) / Number(b)) * 100) : 0) + "%";
const fmtBR = (d) => d.toLocaleDateString("pt-BR");
const numBR = (n) => Number(n || 0).toFixed(2).replace(".", ",");

const CSS = `
* { box-sizing: border-box; }
.app { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: ${C.ink}; background: ${C.paper}; min-height: 100%; line-height: 1.5; }
.fin-head { background: ${C.ink}; color: #fff; padding: 26px 32px 18px; }
.fin-head .disp { font-size: 26px; font-weight: 700; letter-spacing: -.01em; }
.fin-head .periodo { color: #8FA5B2; font-size: 13px; margin-top: 2px; }
.fin-head .status { margin-top: 4px; font-size: 11px; font-family: "IBM Plex Mono", monospace; letter-spacing: .04em; color: #8FA5B2; }
.fin-wrap { max-width: 1180px; margin: 0 auto; padding: 22px 32px 60px; }
.periodo-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 14px; }
.periodo-bar .preset { background: ${C.inkSoft}; border: 1px solid ${C.paperLine}; color: #CDD9E1; border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
.periodo-bar .preset.on, .periodo-bar .preset:hover { background: ${C.emerald}; border-color: ${C.emerald}; color: #fff; }
.periodo-bar .campo { display: flex; align-items: center; gap: 6px; background: ${C.inkSoft}; border: 1px solid ${C.paperLine}; border-radius: 8px; padding: 4px 10px; }
.periodo-bar .campo input { background: none; border: none; color: #fff; font-size: 12px; outline: none; }
.periodo-bar .recarregar { margin-left: auto; background: ${C.inkSoft}; border: 1px solid ${C.paperLine}; color: #CDD9E1; border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid ${C.line}; margin: 18px 0 22px; flex-wrap: wrap; }
.tab { padding: 10px 16px; border: none; background: none; color: ${C.mute}; cursor: pointer; font-size: 14px; border-bottom: 2px solid transparent; }
.tab.on { color: ${C.ink}; border-bottom-color: ${C.emerald}; font-weight: 600; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
.card { background: ${C.surface}; border: 1px solid ${C.line}; border-radius: 12px; padding: 16px 18px; }
.card .label { font-size: 12px; color: ${C.mute}; }
.card .valor { font-size: 26px; font-weight: 700; margin-top: 4px; letter-spacing: -.01em; }
.card .sub { font-size: 11px; color: ${C.mute}; margin-top: 4px; }
.grid2 { display: grid; grid-template-columns: 1.5fr 1fr; gap: 18px; margin-top: 18px; }
@media (max-width: 820px) { .grid2 { grid-template-columns: 1fr; } }
.panel { background: ${C.surface}; border: 1px solid ${C.line}; border-radius: 12px; padding: 16px 18px; }
.section-h { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.section-h::before { content: ""; width: 9px; height: 9px; background: ${C.emerald}; border-radius: 2px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid ${C.line}; }
th.n, td.n { text-align: right; }
th { color: ${C.mute}; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 20px; background: #ECEFEC; color: ${C.mute}; white-space: nowrap; }
.bar-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; margin-bottom: 10px; font-size: 13px; }
.bar-track { grid-column: 1 / -1; height: 7px; background: ${C.line}; border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; background: ${C.emerald}; }
.note { font-size: 12px; color: ${C.mute}; margin-top: 10px; }
.toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.toolbar select, .toolbar button { font-size: 12px; padding: 6px 10px; border: 1px solid ${C.line}; border-radius: 8px; background: ${C.surface}; cursor: pointer; }
`;

/* ============================================================
   COMPONENTES
   ============================================================ */
function Kpi({ label, valor, sub }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="valor">{valor}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function PeriodoBar({ periodo, onChange, onRecarregar }) {
  const presets = [
    ["Este mês", () => mesAtual()],
    ["Mês passado", () => mesPassado()],
    ["Este ano", () => anoAtual()],
    ["12 meses", () => ultimos12()],
  ];
  return (
    <div className="periodo-bar">
      {presets.map(([nome, fn]) => (
        <button key={nome} className="preset" onClick={() => onChange(fn())}>{nome}</button>
      ))}
      <div className="campo">
        <span style={{ color: "#8FA5B2", fontSize: 11 }}>de</span>
        <input value={periodo.inicio} onChange={(e) => onChange({ ...periodo, inicio: e.target.value })} size={10} />
      </div>
      <div className="campo">
        <span style={{ color: "#8FA5B2", fontSize: 11 }}>até</span>
        <input value={periodo.fim} onChange={(e) => onChange({ ...periodo, fim: e.target.value })} size={10} />
      </div>
      <button className="recarregar" onClick={onRecarregar}>↻ Atualizar</button>
    </div>
  );
}

function BarrasHorizontais({ dados, max }) {
  const m = max || Math.max(1, ...dados.map((d) => d.valor));
  return (
    <div>
      {dados.map((d, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div className="bar-row">
            <span>{d.label} <span style={{ color: C.mute }}>· {int(d.qtd)} ped.</span></span>
            <b>{brl(d.valor)}</b>
          </div>
          <div className="bar-track"><div className="bar-fill" style={{ width: (d.valor / m) * 100 + "%", background: d.cor || PALETA[i % PALETA.length] }} /></div>
        </div>
      ))}
    </div>
  );
}

/* ---- exportação CSV ---- */
function baixarCSV(nome, cabecalho, linhas) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const txt = [cabecalho, ...linhas].map((l) => l.map(esc).join(";")).join("\n");
  const blob = new Blob(["﻿" + txt], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
}

/* ---- presets de período ---- */
function mesAtual() {
  const h = new Date();
  return { inicio: fmtBR(new Date(h.getFullYear(), h.getMonth(), 1)), fim: fmtBR(h) };
}
function mesPassado() {
  const h = new Date();
  return { inicio: fmtBR(new Date(h.getFullYear(), h.getMonth() - 1, 1)), fim: fmtBR(new Date(h.getFullYear(), h.getMonth(), 0)) };
}
function anoAtual() {
  const h = new Date();
  return { inicio: fmtBR(new Date(h.getFullYear(), 0, 1)), fim: fmtBR(h) };
}
function ultimos12() {
  const h = new Date();
  return { inicio: fmtBR(new Date(h.getFullYear() - 1, h.getMonth(), 1)), fim: fmtBR(h) };
}

/* ============================================================
   APP
   ============================================================ */
export default function PainelFaturamento() {
  const [aba, setAba] = useState("resumo");
  const [periodo, setPeriodo] = useState(() => anoAtual());
  const [dados, setDados] = useState(operacaoExemplo);
  const [resumo, setResumo] = useState(resumoExemplo);
  const [produtos, setProdutos] = useState(produtosExemplo);
  const [comissoes, setComissoes] = useState(comissoesExemplo);
  const [vendas, setVendas] = useState(vendasExemplo);
  const [ordenarVendas, setOrdenarVendas] = useState("faturamento");
  const [granVendas, setGranVendas] = useState("mes");
  const [metaMensal, setMetaMensal] = useState(() => {
    const salvo = typeof localStorage !== "undefined" ? Number(localStorage.getItem("metaMensal")) : 0;
    return salvo || 0;
  });
  function salvarMeta(v) {
    const n = Math.max(0, Number(v) || 0);
    setMetaMensal(n);
    if (typeof localStorage !== "undefined") localStorage.setItem("metaMensal", String(n));
  }
  const [carregando, setCarregando] = useState(true);
  const [erroApi, setErroApi] = useState(null);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("__todos");

  function carregar() {
    setCarregando(true);
    const url = `${API_OPERACAO}?inicio=${encodeURIComponent(periodo.inicio)}&fim=${encodeURIComponent(periodo.fim)}`;
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        if (d && d.erro) throw new Error(d.detalhe || d.erro);
        if (!d || !d.resumo) throw new Error("Resposta sem resumo");
        setDados(d); setErroApi(null); setAtualizadoEm(new Date());
      })
      .catch((e) => setErroApi(e.message))
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [periodo.inicio, periodo.fim]);

  useEffect(() => {
    fetch(API_PRODUTOS)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.itens) setProdutos(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const url = `${API_COMISSOES}?inicio=${encodeURIComponent(periodo.inicio)}&fim=${encodeURIComponent(periodo.fim)}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.porOperador) setComissoes(d); })
      .catch(() => {});
  }, [periodo.inicio, periodo.fim]);

  useEffect(() => {
    const url = `${API_RESUMO}?inicio=${encodeURIComponent(periodo.inicio)}&fim=${encodeURIComponent(periodo.fim)}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.kpis) setResumo(d); })
      .catch(() => {});
  }, [periodo.inicio, periodo.fim]);

  useEffect(() => {
    const url = `${API_VENDAS}?inicio=${encodeURIComponent(periodo.inicio)}&fim=${encodeURIComponent(periodo.fim)}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.produtos) setVendas(d); })
      .catch(() => {});
  }, [periodo.inicio, periodo.fim]);

  const r = dados.resumo || {};
  const pedidosFiltrados = useMemo(() => {
    const lista = dados.pedidos || [];
    return filtroStatus === "__todos" ? lista : lista.filter((p) => p.status === filtroStatus);
  }, [dados, filtroStatus]);
  const statusUnicos = useMemo(() => [...new Set((dados.pedidos || []).map((p) => p.status))], [dados]);

  return (
    <div className="app">
      <style>{CSS}</style>

      <div className="fin-head">
        <div className="disp">{dados.nome || "Healthycann"}</div>
        <div className="periodo">{dados.periodo}</div>
        <div className="status">
          {carregando ? "◌ conectando à D9Pro…"
            : erroApi ? `● sem conexão com a D9Pro — usando dados de exemplo (${erroApi})`
            : `● dados ao vivo da D9Pro${atualizadoEm ? ` · atualizado ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}`}
        </div>
        <PeriodoBar periodo={periodo} onChange={setPeriodo} onRecarregar={carregar} />
      </div>

      <div className="fin-wrap">
        <div className="tabs">
          {[["resumo", "Resumo"], ["visao", "Visão geral"], ["vendas", "Vendas"], ["pedidos", "Pedidos"], ["produtos", "Produtos"], ["comissoes", "Comissões"]].map(([id, nome]) => (
            <button key={id} className={"tab" + (aba === id ? " on" : "")} onClick={() => setAba(id)}>{nome}</button>
          ))}
        </div>

        {/* ---------- RESUMO (estilo Home D9Pro) ---------- */}
        {aba === "resumo" && (
          <>
            <div className="kpis">
              <Kpi label="Clientes" valor={resumo.kpis.clientes != null ? int(resumo.kpis.clientes) : "—"} sub="Cadastros na base" />
              <Kpi label="Prescritores" valor={resumo.kpis.prescritores != null ? int(resumo.kpis.prescritores) : "—"} sub="Cadastros na base" />
              <Kpi label="Pedidos no período" valor={int(resumo.kpis.pedidosPeriodo)} sub="Conforme o período selecionado" />
              <Kpi label="Em trânsito" valor={int(resumo.kpis.emTransito)} sub="Pedidos a caminho (estimado)" />
            </div>

            {(resumo.avisos || []).map((a, i) => (
              <p key={i} className="note" style={{ color: C.gold }}>⚠ {a}</p>
            ))}

            <div className="grid2">
              <div className="panel">
                <div className="section-h">Últimos pedidos</div>
                <table>
                  <thead><tr><th>Pedido</th><th>Cliente</th><th>Cidade/UF</th><th>Status</th><th>Data</th></tr></thead>
                  <tbody>
                    {(resumo.ultimosPedidos || []).map((p) => (
                      <tr key={p.orderId}>
                        <td>#{p.orderId}</td><td>{p.cliente}</td>
                        <td>{p.cidade}{p.uf ? `/${p.uf}` : ""}</td>
                        <td><span className="tag">{p.status}</span></td><td>{p.data}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!(resumo.ultimosPedidos || []).length && <p className="note">Sem pedidos no período.</p>}
              </div>
              <div className="panel">
                <div className="section-h">Últimos clientes</div>
                <table>
                  <thead><tr><th>#</th><th>Cliente</th><th>Cidade/UF</th></tr></thead>
                  <tbody>
                    {(resumo.ultimosClientes || []).map((c, i) => (
                      <tr key={c.id || i}>
                        <td>{c.id ? `#${c.id}` : "—"}</td><td>{c.nome}</td>
                        <td>{c.cidade}{c.uf ? `/${c.uf}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!(resumo.ultimosClientes || []).length && <p className="note">Lista de clientes recentes indisponível (depende do relatório de cadastros).</p>}
              </div>
            </div>
          </>
        )}

        {/* ---------- VISÃO GERAL ---------- */}
        {aba === "visao" && (
          <>
            <div className="kpis">
              <Kpi label="Faturamento" valor={brlK(r.faturamento)} sub="Soma dos pedidos no período" />
              <Kpi label="Recebido" valor={brlK(r.recebido)} sub={`${pctDe(r.recebido, r.faturamento)} do faturamento`} />
              <Kpi label="A receber" valor={brlK(r.aReceber)} sub="Pedidos ainda não pagos/entregues" />
              <Kpi label="Pedidos" valor={int(r.qtdPedidos)} sub="Quantidade no período" />
              <Kpi label="Ticket médio" valor={brlK(r.ticketMedio)} sub="Faturamento ÷ pedidos" />
            </div>

            <div className="panel" style={{ marginTop: 18 }}>
              <div className="section-h">Faturamento por mês</div>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={dados.porMes || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: C.mute }} />
                  <YAxis tickFormatter={(v) => "R$" + (v / 1000) + "k"} tick={{ fontSize: 11, fill: C.mute }} />
                  <Tooltip formatter={(v, n) => (n === "valor" ? brl(v) : int(v))} />
                  <Bar dataKey="valor" name="Faturamento" fill={C.emerald} radius={[4, 4, 0, 0]} barSize={34} />
                  <Line dataKey="qtd" name="Pedidos" stroke={C.gold} strokeWidth={2} dot={{ r: 3 }} yAxisId={0} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="grid2">
              <div className="panel">
                <div className="section-h">Faturamento por status</div>
                <BarrasHorizontais dados={(dados.porStatus || []).map((s) => ({ label: s.label, valor: s.valor, qtd: s.qtd, cor: s.recebido ? C.emerald : C.gold }))} />
                <p className="note"><span style={{ color: C.emerald }}>■</span> recebido (pago/entregue) · <span style={{ color: C.gold }}>■</span> a receber</p>
              </div>
              <div className="panel">
                <div className="section-h">Por grupo de pedido</div>
                <BarrasHorizontais dados={(dados.porGrupo || []).map((g) => ({ label: g.grupo, valor: g.valor, qtd: g.qtd }))} />
              </div>
            </div>
          </>
        )}

        {/* ---------- VENDAS (por produto e por data) ---------- */}
        {aba === "vendas" && (() => {
          const totalFat = vendas.resumo?.faturamento || 0;
          const lista = [...(vendas.produtos || [])].sort((a, b) =>
            ordenarVendas === "quantidade" ? b.quantidade - a.quantidade : b.faturamento - a.faturamento);
          const r = vendas.resumo || {};
          const serie = granVendas === "dia"
            ? (vendas.porDia || []).map((d) => ({ rotulo: `${d.chave.slice(8)}/${d.chave.slice(5, 7)}`, valor: d.valor }))
            : (vendas.porMes || []).map((m) => ({ rotulo: m.mes, valor: m.valor }));
          const meta = metaMensal > 0 ? metaMensal : (vendas.resumo?.metaMensal || 0);
          const ultimoMes = (vendas.porMes || [])[(vendas.porMes || []).length - 1];
          const maxY = Math.max(1, granVendas === "mes" ? meta : 0, ...serie.map((s) => s.valor));
          return (
            <>
              <div className="kpis">
                <Kpi label="Faturamento" valor={brlK(totalFat)} sub="Pedidos válidos no período" />
                <Kpi label="Lucro bruto" valor={brlK(r.lucro)} sub={r.margem != null ? `margem ${pctDe(r.lucro, totalFat)}` : "—"} />
                <Kpi label="Ticket médio" valor={brlK(r.ticketMedio)} sub="Faturamento ÷ pedidos" />
                <Kpi label="Pedidos" valor={int(r.pedidos)} sub={`${int(r.itensVendidos)} itens · ${int(lista.length)} produtos`} />
              </div>

              <div className="panel" style={{ marginTop: 18 }}>
                <div className="toolbar">
                  <div className="section-h" style={{ margin: 0 }}>Vendas por {granVendas === "dia" ? "dia" : "mês"}</div>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: C.mute }}>Meta/mês: R$</span>
                  <input type="number" min="0" step="1000" value={metaMensal || ""} placeholder={meta ? String(meta) : "0"}
                    onChange={(e) => salvarMeta(e.target.value)}
                    style={{ width: 110, fontSize: 12, padding: "6px 8px", border: `1px solid ${C.line}`, borderRadius: 8 }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ background: granVendas === "mes" ? C.emerald : C.surface, color: granVendas === "mes" ? "#fff" : C.ink, border: `1px solid ${C.line}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }} onClick={() => setGranVendas("mes")}>Mês</button>
                    <button style={{ background: granVendas === "dia" ? C.emerald : C.surface, color: granVendas === "dia" ? "#fff" : C.ink, border: `1px solid ${C.line}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }} onClick={() => setGranVendas("dia")}>Dia</button>
                  </div>
                </div>
                {meta > 0 && ultimoMes && (
                  <p className="note" style={{ marginTop: 0 }}>
                    Meta mensal <b>{brlK(meta)}</b> · {ultimoMes.mes}: <b style={{ color: ultimoMes.valor >= meta ? C.emerald : C.gold }}>{brlK(ultimoMes.valor)}</b> ({pctDe(ultimoMes.valor, meta)} da meta{ultimoMes.valor < meta ? ` · faltam ${brlK(meta - ultimoMes.valor)}` : " ✓ batida"})
                  </p>
                )}
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={serie}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                    <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: C.mute }} interval="preserveStartEnd" />
                    <YAxis domain={[0, Math.ceil(maxY * 1.08)]} tickFormatter={(v) => "R$" + Math.round(v / 1000) + "k"} tick={{ fontSize: 11, fill: C.mute }} />
                    <Tooltip formatter={(v) => brl(v)} />
                    {granVendas === "mes" && meta > 0 && (
                      <ReferenceLine y={meta} stroke={C.gold} strokeDasharray="4 4"
                        label={{ value: "Meta", fill: C.gold, fontSize: 11, position: "insideTopRight" }} />
                    )}
                    <Bar dataKey="valor" name="Faturamento" fill={C.emerald} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6 }}>
                  {(vendas.porMes || []).map((m) => (
                    <span key={m.chave} style={{ fontSize: 12, color: C.mute }}>
                      <b style={{ color: C.ink }}>{m.mes}</b> {brlK(m.valor)}
                      {m.variacao != null && (
                        <span style={{ color: m.variacao >= 0 ? C.emerald : C.brick, marginLeft: 4 }}>
                          {m.variacao >= 0 ? "▲" : "▼"} {pctDe(Math.abs(m.variacao), 1)}
                        </span>
                      )}
                      {meta > 0 && (
                        <span style={{ color: m.valor >= meta ? C.emerald : C.mute, marginLeft: 4 }}>
                          · {pctDe(m.valor, meta)} da meta
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid2">
                <div className="panel">
                  <div className="section-h">Por estado (UF)</div>
                  <BarrasHorizontais dados={(vendas.porEstado || []).slice(0, 10).map((e) => ({ label: e.uf, valor: e.valor, qtd: e.qtd }))} />
                </div>
                <div className="panel">
                  <div className="section-h">Por forma de pagamento</div>
                  <BarrasHorizontais dados={(vendas.porPagamento || []).map((p) => ({ label: p.forma, valor: p.valor, qtd: p.qtd }))} />
                </div>
              </div>

              <div className="grid2">
                <div className="panel">
                  <div className="section-h">Por grupo de pedido</div>
                  <BarrasHorizontais dados={(vendas.porGrupo || []).filter((g) => g.valor > 0).map((g) => ({ label: g.grupo, valor: g.valor, qtd: g.qtd }))} />
                </div>
                <div className="panel">
                  <div className="section-h">Por cidade (top 10)</div>
                  <BarrasHorizontais dados={(vendas.porCidade || []).slice(0, 10).map((c) => ({ label: c.cidade, valor: c.valor, qtd: c.qtd }))} />
                </div>
              </div>

              <div className="panel" style={{ marginTop: 18 }}>
                <div className="toolbar">
                  <div className="section-h" style={{ margin: 0 }}>Por prescritor (top 10)</div>
                  <button style={{ marginLeft: "auto" }} onClick={() => baixarCSV("vendas-por-prescritor.csv",
                    ["Prescritor", "Faturamento", "Pedidos"],
                    (vendas.porPrescritor || []).map((p) => [p.nome, numBR(p.valor), p.qtd]))}>↓ CSV</button>
                </div>
                <BarrasHorizontais dados={(vendas.porPrescritor || []).slice(0, 10).map((p) => ({ label: p.nome, valor: p.valor, qtd: p.qtd }))} />
              </div>

              <div className="panel" style={{ marginTop: 18 }}>
                <div className="toolbar">
                  <div className="section-h" style={{ margin: 0 }}>Vendas por produto ({int(lista.length)})</div>
                  <span style={{ fontSize: 12, color: C.mute, marginLeft: "auto" }}>ordenar:</span>
                  <select value={ordenarVendas} onChange={(e) => setOrdenarVendas(e.target.value)}>
                    <option value="faturamento">Faturamento</option>
                    <option value="quantidade">Quantidade</option>
                  </select>
                  <button onClick={() => baixarCSV("vendas-por-produto.csv",
                    ["Produto", "SKU", "Quantidade", "Faturamento", "Lucro", "Margem", "Pedidos", "Ticket médio", "% faturamento"],
                    lista.map((p) => [p.nome, p.sku, p.quantidade, numBR(p.faturamento), numBR(p.lucro), p.margem != null ? Math.round(p.margem * 100) + "%" : "", p.pedidos, numBR(p.ticketMedio), pctDe(p.faturamento, totalFat)]))}>
                    ↓ CSV
                  </button>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th><th>SKU</th><th className="n">Qtd</th>
                      <th className="n">Faturamento</th><th className="n">Lucro</th><th className="n">Margem</th>
                      <th className="n">Ticket méd.</th><th className="n">% fat.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((p) => (
                      <tr key={p.sku || p.nome}>
                        <td>{p.nome}</td>
                        <td style={{ fontFamily: "monospace", color: C.mute }}>{p.sku}</td>
                        <td className="n">{int(p.quantidade)}</td>
                        <td className="n"><b>{brl(p.faturamento)}</b></td>
                        <td className="n">{brl(p.lucro)}</td>
                        <td className="n">{p.margem != null ? pct(p.margem) : "—"}</td>
                        <td className="n">{brl(p.ticketMedio)}</td>
                        <td className="n">{pctDe(p.faturamento, totalFat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!lista.length && <p className="note">Nenhuma venda no período.</p>}
                <p className="note">Quantidade vem exata da composição do pedido; o faturamento por produto é rateado pelo total do pedido entre seus itens.</p>
              </div>
            </>
          );
        })()}

        {/* ---------- PEDIDOS ---------- */}
        {aba === "pedidos" && (
          <div className="panel">
            <div className="toolbar">
              <div className="section-h" style={{ margin: 0 }}>Pedidos ({int(pedidosFiltrados.length)})</div>
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={{ marginLeft: "auto" }}>
                <option value="__todos">Todos os status</option>
                {statusUnicos.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => baixarCSV("pedidos.csv",
                ["Pedido", "Data", "Cliente", "Cidade", "UF", "Status", "Grupo", "Total", "Rastreio"],
                pedidosFiltrados.map((p) => [p.orderId, p.data, p.cliente, p.cidade, p.uf, p.status, p.grupo, numBR(p.total), p.rastreio]))}>
                ↓ CSV
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Pedido</th><th>Data</th><th>Cliente</th><th>Cidade/UF</th>
                  <th>Status</th><th>Grupo</th><th className="n">Total</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map((p) => (
                  <tr key={p.orderId}>
                    <td>#{p.orderId}</td>
                    <td>{p.data}</td>
                    <td>{p.cliente}</td>
                    <td>{p.cidade}{p.uf ? `/${p.uf}` : ""}</td>
                    <td><span className="tag">{p.status}</span></td>
                    <td>{p.grupo}</td>
                    <td className="n"><b>{brl(p.total)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dados.pedidosTruncados && <p className="note">Lista limitada aos primeiros pedidos do período. Refine o período para ver menos.</p>}
            {!pedidosFiltrados.length && <p className="note">Nenhum pedido no período/filtro selecionado.</p>}
          </div>
        )}

        {/* ---------- PRODUTOS ---------- */}
        {aba === "produtos" && (
          <div className="panel">
            <div className="toolbar">
              <div className="section-h" style={{ margin: 0 }}>Produtos ({int((produtos.itens || []).length)})</div>
              <button style={{ marginLeft: "auto" }} onClick={() => baixarCSV("produtos.csv",
                ["ID", "Produto", "Preço", "Custo", "Margem"],
                (produtos.itens || []).map((p) => [p.pId, p.nome, p.preco != null ? numBR(p.preco) : "", p.custo != null ? numBR(p.custo) : "", p.margem != null ? Math.round(p.margem * 100) + "%" : ""]))}>
                ↓ CSV
              </button>
            </div>
            <table>
              <thead>
                <tr><th>Produto</th><th className="n">Preço</th><th className="n">Custo</th><th className="n">Margem</th></tr>
              </thead>
              <tbody>
                {(produtos.itens || []).map((p) => (
                  <tr key={p.pId}>
                    <td>{p.nome}</td>
                    <td className="n">{p.preco != null ? brl(p.preco) : "—"}</td>
                    <td className="n">{p.custo != null ? brl(p.custo) : "—"}</td>
                    <td className="n">{p.margem != null ? pct(p.margem) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">Preço e custo vêm das regras de preço da D9Pro (“a partir de”, menor preço entre as regras). Produtos com várias regras mostram o valor de entrada.</p>
          </div>
        )}

        {/* ---------- COMISSÕES ---------- */}
        {aba === "comissoes" && (
          <>
            <div className="kpis">
              <Kpi label="Comissões no período" valor={brlK(comissoes.total)} sub={`${int(comissoes.qtd)} linha(s) no relatório`} />
              <Kpi label="Operadores" valor={int((comissoes.porOperador || []).length)} sub="Com comissão no período" />
            </div>

            {comissoes.aviso && <p className="note" style={{ color: C.brick }}>⚠ {comissoes.aviso}</p>}

            <div className="grid2">
              <div className="panel">
                <div className="section-h">Comissão por operador</div>
                <BarrasHorizontais dados={(comissoes.porOperador || []).map((o) => ({ label: o.nome, valor: o.valor, qtd: 0 }))} />
              </div>
              <div className="panel">
                <div className="section-h">Relatório (CSV da D9Pro)</div>
                <div className="toolbar">
                  <button style={{ marginLeft: "auto" }} onClick={() => baixarCSV("comissoes.csv",
                    comissoes.colunas || [],
                    (comissoes.itens || []).map((it) => (comissoes.colunas || []).map((c) => it[c])))}>
                    ↓ CSV
                  </button>
                </div>
                <div style={{ maxHeight: 320, overflow: "auto" }}>
                  <table>
                    <thead><tr>{(comissoes.colunas || []).map((c) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {(comissoes.itens || []).map((it, i) => (
                        <tr key={i}>{(comissoes.colunas || []).map((c) => <td key={c}>{it[c]}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!(comissoes.itens || []).length && <p className="note">Sem linhas de comissão no período.</p>}
              </div>
            </div>
            <p className="note">As colunas vêm direto do relatório <span style={{ fontFamily: "monospace" }}>/export/commission.php</span>. O total soma a coluna <b>{comissoes.colValor || "—"}</b> e o agrupamento usa <b>{comissoes.colOper || "—"}</b>. Se a detecção estiver errada no CSV real, ajustamos.</p>
          </>
        )}
      </div>
    </div>
  );
}
