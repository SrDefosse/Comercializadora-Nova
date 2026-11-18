import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import * as pgliteSocket from '@electric-sql/pglite-socket';

await import('../config/cargar-env.js');

const puertoPostgres = Number(process.env.PGLITE_PORT ?? 5432);
const directorioProyecto = path.dirname(fileURLToPath(import.meta.url));
const directorioDatos = process.env.PGLITE_DATA_DIR
  ? path.resolve(process.env.PGLITE_DATA_DIR)
  : path.resolve(directorioProyecto, '../data/postgres');
await mkdir(path.dirname(directorioDatos), { recursive: true });

let base;
let servidorPostgres;
let detenerServidor = async () => {};
let cerrando = false;

async function cerrarTodo() {
  if (cerrando) {
    return;
  }
  cerrando = true;
  await detenerServidor();
  if (servidorPostgres) {
    await servidorPostgres.stop();
  }
  if (base) {
    await base.close();
  }
}

process.once('SIGINT', () => {
  cerrarTodo().then(() => process.exit(0));
});
process.once('SIGTERM', () => {
  cerrarTodo().then(() => process.exit(0));
});

try {
  base = await PGlite.create(directorioDatos);
  servidorPostgres = new pgliteSocket.PGLiteSocketServer({
    db: base,
    port: puertoPostgres,
    host: '127.0.0.1'
  });
  await servidorPostgres.start();
  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${puertoPostgres}/postgres`;
  const aplicacion = await import('../server.js');
  detenerServidor = aplicacion.detenerServidor;
  console.log(`Base local PGlite disponible en 127.0.0.1:${puertoPostgres}.`);
} catch (error) {
  console.error(`No se pudo iniciar el servidor local: ${error.message}`);
  process.exitCode = 1;
  await cerrarTodo();
}
