import { readFileSync } from 'node:fs';

try {
  const contenido = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const linea of contenido.split(/\r?\n/)) {
    const coincidencia = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!coincidencia || process.env[coincidencia[1]] !== undefined) continue;
    let valor = coincidencia[2];
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    process.env[coincidencia[1]] = valor;
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
