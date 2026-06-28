/**
 * Ponto de entrada do app web: monta o painel de faturamento/operação da
 * Healthycann. O painel busca os dados em /api/operacao (servido pelo mesmo
 * servidor, a partir da D9Pro).
 */
import React from "react";
import { createRoot } from "react-dom/client";
import PainelFaturamento from "../painel-faturamento.jsx";

const root = createRoot(document.getElementById("root"));
root.render(
  React.createElement(React.StrictMode, null, React.createElement(PainelFaturamento))
);
