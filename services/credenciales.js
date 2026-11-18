import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT } from 'jose';

const scrypt = promisify(scryptCallback);
const emisor = process.env.JWT_ISSUER ?? 'comercializadora-nova-api';
const audiencia = process.env.JWT_AUDIENCE ?? 'comercializadora-nova-client';
const duracionAcceso = process.env.NODE_ENV === 'test'
  ? Number(process.env.JWT_TEST_ACCESS_TTL_SECONDS ?? 900)
  : 900;
const secretoBase64 = process.env.JWT_SECRET_BASE64;

if (!secretoBase64) {
  throw new Error('Falta JWT_SECRET_BASE64. Configura una clave aleatoria de al menos 32 bytes antes de iniciar.');
}
if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(secretoBase64)) {
  throw new Error('JWT_SECRET_BASE64 debe ser una cadena Base64 válida.');
}

const claveBytes = Buffer.from(secretoBase64, 'base64');
if (claveBytes.length < 32 || claveBytes.toString('base64') !== secretoBase64) {
  throw new Error('JWT_SECRET_BASE64 debe representar al menos 32 bytes aleatorios.');
}
if (!emisor.trim() || !audiencia.trim()) {
  throw new Error('JWT_ISSUER y JWT_AUDIENCE no pueden estar vacíos.');
}
if (!Number.isInteger(duracionAcceso) || duracionAcceso < 1
  || (process.env.NODE_ENV === 'test' && duracionAcceso > 60)) {
  throw new Error('La duración de prueba debe ser un entero entre 1 y 60 segundos.');
}

const claveJwt = new Uint8Array(claveBytes);
const hashSenal = await crearHash(randomBytes(32).toString('hex'));

export async function crearHash(contrasena) {
  const salt = randomBytes(16);
  const derivado = await scrypt(contrasena, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${derivado.toString('base64')}`;
}

export async function comprobarHash(contrasena, almacenado) {
  const [algoritmo, costo, bloque, paralelismo, saltBase64, hashBase64] = almacenado.split('$');
  if (algoritmo !== 'scrypt' || costo !== '16384' || bloque !== '8' || paralelismo !== '1') {
    return false;
  }

  const hashEsperado = Buffer.from(hashBase64, 'base64');
  const hashRecibido = await scrypt(contrasena, Buffer.from(saltBase64, 'base64'), hashEsperado.length, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  return hashEsperado.length === hashRecibido.length
    && timingSafeEqual(hashEsperado, hashRecibido);
}

export async function comprobarHashConSenal(contrasena, almacenado) {
  return comprobarHash(contrasena, almacenado ?? hashSenal);
}

export function emitirToken(usuarioId) {
  const ahora = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({
      alg: 'HS256',
      typ: 'JWT'
    })
    .setSubject(String(usuarioId))
    .setIssuer(emisor)
    .setAudience(audiencia)
    .setIssuedAt(ahora)
    .setExpirationTime(ahora + duracionAcceso)
    .sign(claveJwt);
}

export const configuracionJwt = {
  claveJwt,
  emisor,
  audiencia,
  duracionAcceso
};
