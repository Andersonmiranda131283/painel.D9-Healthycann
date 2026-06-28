import React, { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, BarChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";

/* ============================================================
   CAMADA DE DADOS
   O painel consome o conector da D9Pro (GET /api/operacao). Sem conexão,
   usa o exemplo abaixo como fallback — a tela nunca fica em branco.
   ============================================================ */
const API_OPERACAO =
  (typeof window !== "undefined" && window.PAINEL_API_URL) || "/api/operacao";
const API_PRODUTOS = "/api/produtos";

const operacaoExemplo = {
  nome: "Healthycann",
  periodo: "Exercício 2026 — dados de exemplo",
  resumo: { faturamento: 642300, qtdPedidos: 98, ticketMedio: 6554, frete: 0 },
  porMes: [
    { chave: "2026-01", mes: "Jan/26", valor: 92000, qtd: 15 },
    { chave: "2026-02", mes: "Fev/26", valor: 104500, qtd: 16 },
    { chave: "2026-03", mes: "Mar/26", valor: 118000, qtd: 18 },
    { chave: "2026-04", mes: "Abr/26", valor: 99500, qtd: 15 },
    { chave: "2026-05", mes: "Mai/26", valor: 112300, qtd: 17 },
    { chave: "2026-06", mes: "Jun/26", valor: 116000, qtd: 17 },
  ],
  porStatus: [
    { oSId: "16", label: "Entregue", qtd: 41, valor: 286000 },
    { oSId: "8", label: "Pago", qtd: 28, valor: 192000 },
    { oSId: "14", label: "Verificando Documentação", qtd: 17, valor: 102300 },
    { oSId: "1", label: "Analisando receita", qtd: 12, valor: 62000 },
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
    { pId: "1", nome: "Óleo Full Spectrum 30 mL", preco: 300, custo: 120, margem: 0.6 },
    { pId: "2", nome: "Óleo Isolado 30 mL", preco: 250, custo: 100, margem: 0.6 },
    { pId: "3", nome: "Cápsulas 60 un", preco: 200, custo: 90, margem: 0.55 },
    { pId: "6", nome: "Anuidade", preco: 150, custo: 0, margem: 1 },
  ],
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
          <div className="bar-track"><div className="bar-fill" style={{ width: (d.valor / m) * 100 + "%", background: PALETA[i % PALETA.length] }} /></div>
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
  const [aba, setAba] = useState("visao");
  const [periodo, setPeriodo] = useState(() => anoAtual());
  const [dados, setDados] = useState(operacaoExemplo);
  const [produtos, setProdutos] = useState(produtosExemplo);
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
          {[["visao", "Visão geral"], ["pedidos", "Pedidos"], ["produtos", "Produtos"]].map(([id, nome]) => (
            <button key={id} className={"tab" + (aba === id ? " on" : "")} onClick={() => setAba(id)}>{nome}</button>
          ))}
        </div>

        {/* ---------- VISÃO GERAL ---------- */}
        {aba === "visao" && (
          <>
            <div className="kpis">
              <Kpi label="Faturamento" valor={brlK(r.faturamento)} sub="Soma dos pedidos no período" />
              <Kpi label="Pedidos" valor={int(r.qtdPedidos)} sub="Quantidade no período" />
              <Kpi label="Ticket médio" valor={brlK(r.ticketMedio)} sub="Faturamento ÷ pedidos" />
              <Kpi label="Status distintos" valor={int((dados.porStatus || []).length)} sub="Etapas com pedidos" />
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
                <BarrasHorizontais dados={(dados.porStatus || []).map((s) => ({ label: s.label, valor: s.valor, qtd: s.qtd }))} />
              </div>
              <div className="panel">
                <div className="section-h">Por grupo de pedido</div>
                <BarrasHorizontais dados={(dados.porGrupo || []).map((g) => ({ label: g.grupo, valor: g.valor, qtd: g.qtd }))} />
              </div>
            </div>
          </>
        )}

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
            <p className="note">Preço e custo vêm das regras de preço da D9Pro (uma chamada por produto) — habilitados na próxima iteração do conector.</p>
          </div>
        )}
      </div>
    </div>
  );
}
