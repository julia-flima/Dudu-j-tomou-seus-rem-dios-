// Copia os arquivos do web app para dist/, que é o que o Tauri empacota no aplicativo.
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const ARQUIVOS = ['index.html', 'manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png'];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const arq of ARQUIVOS) cpSync(arq, `dist/${arq}`);
console.log(`dist/ pronto (${ARQUIVOS.length} arquivos)`);
