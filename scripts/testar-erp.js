/**
 * Teste rápido de conexão com a D9Pro API.
 * Use na SUA máquina (que tem acesso ao d9pro.com), depois de definir o .env:
 *
 *   D9_API_URL=https://healthycann.d9pro.com/api
 *   D9_API_TOKEN=<seu token>
 *
 *   node --env-file-if-exists=.env scripts/testar-erp.js
 *
 * Bate em /user/me.php e mostra a resposta — confirma URL base + token.
 */
import { configurado, testarConexao } from "../erp/d9.js";

if (!configurado) {
  console.error("✗ D9_API_URL / D9_API_TOKEN não definidos. Preencha o .env primeiro.");
  process.exit(1);
}

try {
  const me = await testarConexao();
  console.log("✓ Conexão OK com a D9Pro API. Usuário atual:");
  console.log(JSON.stringify(me, null, 2));
} catch (err) {
  console.error("✗ Falhou:", err.message);
  process.exit(1);
}
