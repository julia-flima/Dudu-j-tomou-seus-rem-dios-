// Copia os arquivos do web app para dist/, que é o que o Tauri empacota no aplicativo.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

export const ARQUIVOS = [
  "index.html",
  "styles.css",
  "main.js",
  "img",
  "manifest.json",
  "sw.js",
  "icon-192.png",
  "icon-512.png",
];

const raiz = resolve(import.meta.dirname, "..");
const dist = join(raiz, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const arq of ARQUIVOS) {
  const origem = join(raiz, arq);
  if (!existsSync(origem)) {
    throw new Error(`Arquivo obrigatório não encontrado: ${arq}`);
  }
  cpSync(origem, join(dist, arq), { recursive: true });
}
console.log(`dist/ pronto (${ARQUIVOS.length} itens)`);
