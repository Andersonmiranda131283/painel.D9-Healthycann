/**
 * Build do front-end: empacota src/main.jsx (e o painel) num único
 * arquivo public/app.js, com React e recharts embutidos (funciona offline).
 *
 *   node build.js            → build único
 *   node build.js --watch    → rebuild automático ao salvar
 */
import * as esbuild from "esbuild";

const ctx = await esbuild.context({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  outfile: "public/app.js",
  format: "iife",
  loader: { ".js": "jsx", ".jsx": "jsx" },
  jsx: "automatic",
  minify: true,
  sourcemap: true,
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});

if (process.argv.includes("--watch")) {
  await ctx.watch();
  console.log("👀 build em watch — salvando os arquivos faz rebuild automático");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
