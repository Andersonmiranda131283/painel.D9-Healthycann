/**
 * Ponto de entrada do app web: monta o painel financeiro da Healthycann.
 * O painel busca os dados em /api/financeiro (servido pelo mesmo servidor).
 */
import React from "react";
import { createRoot } from "react-dom/client";
import PainelFinanceiro from "../painel-financeiro.jsx";

const root = createRoot(document.getElementById("root"));
root.render(
  React.createElement(React.StrictMode, null, React.createElement(PainelFinanceiro))
);
