/**
 * Parser de CSV simples e tolerante, para os relatórios /export/*.php da D9Pro.
 * Detecta o delimitador (',' ou ';'), respeita aspas e quebra de linha dentro
 * de campo. Como não conhecemos as colunas exatas do CSV de comissões de
 * antemão, há heurísticas para achar as colunas de valor / operador / data.
 */

/** Detecta o delimitador mais provável a partir da 1ª linha. */
function detectarDelimitador(texto) {
  const linha = texto.split(/\r?\n/, 1)[0] || "";
  const ponto = (linha.match(/;/g) || []).length;
  const virg = (linha.match(/,/g) || []).length;
  const tab = (linha.match(/\t/g) || []).length;
  if (tab > ponto && tab > virg) return "\t";
  return ponto >= virg ? ";" : ",";
}

/** Faz o parse do CSV em { colunas:[...], linhas:[{col:valor}] }. */
export function parseCSV(texto) {
  const limpo = String(texto || "").replace(/^﻿/, "");
  if (!limpo.trim()) return { colunas: [], linhas: [] };
  const delim = detectarDelimitador(limpo);

  const linhas = [];
  let campo = "", registro = [], aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') { campo += '"'; i++; }
        else aspas = false;
      } else campo += c;
    } else if (c === '"') {
      aspas = true;
    } else if (c === delim) {
      registro.push(campo); campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i++;
      registro.push(campo); linhas.push(registro); campo = ""; registro = [];
    } else campo += c;
  }
  if (campo.length || registro.length) { registro.push(campo); linhas.push(registro); }

  const colunas = (linhas.shift() || []).map((c) => c.trim());
  const objs = linhas
    .filter((r) => r.some((v) => String(v).trim() !== ""))
    .map((r) => {
      const o = {};
      colunas.forEach((col, idx) => { o[col] = (r[idx] ?? "").trim(); });
      return o;
    });
  return { colunas, linhas: objs };
}

/** Acha o nome da 1ª coluna cujo cabeçalho casa com algum dos padrões. */
export function acharColuna(colunas, padroes) {
  for (const p of padroes) {
    const achou = colunas.find((c) => new RegExp(p, "i").test(c));
    if (achou) return achou;
  }
  return null;
}

/** "1.234,56" ou "1234.56" → 1234.56. */
export function numeroBR(v) {
  let s = String(v ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
