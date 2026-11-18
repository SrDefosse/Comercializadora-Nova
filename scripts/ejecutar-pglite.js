import { PGlite } from '@electric-sql/pglite';
import * as pgliteSocket from '@electric-sql/pglite-socket';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const modo = process.argv[2];
if (!['init', 'demo'].includes(modo)) {
  console.error('Usa el comando npm run db:init o npm run db:demo.');
  process.exit(1);
}

const puerto = Number(process.env.PGLITE_PORT ?? 5432);
const directorioDatos = process.env.PGLITE_DATA_DIR
  ? path.resolve(process.env.PGLITE_DATA_DIR)
  : fileURLToPath(new URL('../data/postgres/', import.meta.url));
await mkdir(path.dirname(directorioDatos), { recursive: true });
const base = await PGlite.create(directorioDatos);
const servidor = new pgliteSocket.PGLiteSocketServer({
  db: base,
  port: puerto,
  host: '127.0.0.1'
});

try {
  await servidor.start();
  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${puerto}/postgres`;

  if (modo === 'init') await import('./inicializar-base.js');
  else await import('./demostrar-base.js');
} catch (error) {
  console.error(`No se pudo ejecutar PostgreSQL local: ${error.message}`);
  process.exitCode = 1;
} finally {
  await servidor.stop();
  await base.close();
}
