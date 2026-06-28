/**
 * CONECTOR D9 — servidor do Painel Financeiro da Healthycann
 * ----------------------------------------------------------------------------
 * Um único servidor Node.js (Express) que:
 *   - serve o painel (public/, gerado pelo build.js a partir de painel-financeiro.jsx);
 *   - expõe a API que o painel consome (/api/financeiro e /api/vendas);
 *   - busca os dados num "provider" de ERP plugável (erp/index.js).
 *
 * Sem ERP configurado, /api/financeiro responde 503 e o painel mostra os dados
 * de exemplo embutidos — a tela nunca fica em branco. Para ver o caminho "ao
 * vivo" sem o ERP real, rode com ERP_PROVIDER=mock.
 *
 * A Healthycann não usa SCP (diferente da Health Importer): o contrato traz
 * projetos/scpsDisponiveis vazios e o painel esconde o seletor de SCP.
 */
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { provider } from "./erp/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

// Login do painel (HTTP Basic). Defina os DOIS para exigir usuário/senha.
const PAINEL_USUARIO = process.env.PAINEL_USUARIO;
const PAINEL_SENHA = process.env.PAINEL_SENHA;
const AUTH_ATIVA = Boolean(PAINEL_USUARIO && PAINEL_SENHA);

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" })); // p/ futuras rotas (ex.: conciliação OFX)

// Comparação em tempo constante (evita vazar a senha por timing)
function igualSeguro(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Login simples (HTTP Basic) — protege o painel inteiro quando ativo
app.use((req, res, next) => {
  if (!AUTH_ATIVA) return next();
  const [tipo, cred] = (req.headers.authorization || "").split(" ");
  if (tipo === "Basic" && cred) {
    const [user, pass] = Buffer.from(cred, "base64").toString().split(":");
    if (igualSeguro(user, PAINEL_USUARIO) && igualSeguro(pass, PAINEL_SENHA)) {
      return next();
    }
  }
  res.set("WWW-Authenticate", 'Basic realm="Painel Healthycann", charset="UTF-8"');
  return res.status(401).send("Autenticação necessária.");
});

// Datas no formato dd/mm/aaaa (padrão: ano corrente até hoje)
function periodoDaQuery(req) {
  const hoje = new Date();
  const fmt = (d) => d.toLocaleDateString("pt-BR");
  return {
    inicio: req.query.inicio || fmt(new Date(hoje.getFullYear(), 0, 1)),
    fim: req.query.fim || fmt(hoje),
  };
}

app.get("/api/financeiro", async (req, res) => {
  if (!provider.configurado) {
    return res.status(503).json({
      erro: "ERP não configurado",
      detalhe:
        "Defina D9_API_URL e D9_API_TOKEN no .env (ou rode com ERP_PROVIDER=mock para dados de exemplo).",
    });
  }
  try {
    const { inicio, fim } = periodoDaQuery(req);
    const dados = await provider.financeiro({ inicio, fim });
    res.json({ ...dados, protegido: AUTH_ATIVA }); // protegido → painel mostra "Sair"
  } catch (err) {
    console.error(err);
    res.status(502).json({ erro: `Falha ao consultar o ERP (${provider.nome})`, detalhe: String(err.message) });
  }
});

app.get("/api/vendas", async (req, res) => {
  if (!provider.configurado) {
    return res.status(503).json({ erro: "ERP não configurado" });
  }
  try {
    const { inicio, fim } = periodoDaQuery(req);
    const dados = await provider.vendas({ inicio, fim });
    res.json(dados);
  } catch (err) {
    console.error(err);
    res.status(502).json({ erro: "Falha ao consultar vendas no ERP", detalhe: String(err.message) });
  }
});

// Arquivos estáticos do painel
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

app.listen(PORT, () => {
  const modo = provider.configurado ? `ERP "${provider.nome}"` : "sem ERP (painel usa dados de exemplo)";
  console.log(`Painel Healthycann em http://localhost:${PORT}  ·  ${modo}`);
});
