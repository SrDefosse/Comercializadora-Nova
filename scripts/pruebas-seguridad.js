import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as esperar } from 'node:timers/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SignJWT } from 'jose';

const claveBytes = randomBytes(32);
const secreto = new Uint8Array(claveBytes);
const secretoBase64 = claveBytes.toString('base64');
const emisor = 'comercializadora-nova-api';
const audiencia = 'comercializadora-nova-client';
const contrasenaA = 'Nova-Prueba-Usuario-A-2026!';
const contrasenaB = 'Nova-Prueba-Usuario-B-2026!';

const puertoDisponible = await new Promise((resolve, reject) => {
  const listener = createServer();
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', () => {
    const { port } = listener.address();
    listener.close((error) => error ? reject(error) : resolve(port));
  });
});
const baseUrl = `http://127.0.0.1:${puertoDisponible}`;
const serverPath = fileURLToPath(new URL('../server.js', import.meta.url));
const projectPath = fileURLToPath(new URL('..', import.meta.url));
const proceso = spawn(process.execPath, [serverPath], {
  cwd: projectPath,
  env: {
    ...process.env,
    JWT_SECRET_BASE64: secretoBase64,
    JWT_ISSUER: emisor,
    JWT_AUDIENCE: audiencia,
    NODE_ENV: 'test',
    JWT_TEST_ACCESS_TTL_SECONDS: '2',
    PORT: String(puertoDisponible)
  },
  stdio: ['ignore', 'ignore', 'pipe']
});

let stderr = '';
proceso.stderr.setEncoding('utf8');
proceso.stderr.on('data', (chunk) => { stderr += chunk; });

async function pedir(ruta, { metodo = 'GET', token, cuerpo, contenido = 'application/json' } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) headers['Content-Type'] = contenido;
  const respuesta = await fetch(`${baseUrl}${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo === undefined ? undefined : (contenido === 'application/json' ? JSON.stringify(cuerpo) : String(cuerpo))
  });
  let json;
  try { json = await respuesta.json(); } catch { json = null; }
  return { status: respuesta.status, json };
}

const resultados = [];
function registrar(nombre, accion) {
  return Promise.resolve().then(accion).then(() => {
    resultados.push({ nombre, resultado: 'PASS' });
  }).catch((error) => {
    resultados.push({ nombre, resultado: 'FAIL', detalle: error.message });
  });
}

async function esperarServidor() {
  for (let intento = 0; intento < 60; intento += 1) {
    if (proceso.exitCode !== null) throw new Error(`El servidor terminó al iniciar: ${stderr}`);
    try {
      const respuesta = await pedir('/api/productos');
      if (respuesta.status === 401) return;
    } catch { /* El servidor aún está arrancando. */ }
    await esperar(100);
  }
  throw new Error(`El servidor no respondió: ${stderr}`);
}

async function tokenFirmado({ sub, exp, iss = emisor, aud = audiencia, alg = 'HS256' }) {
  const emisorJwt = new SignJWT({})
    .setProtectedHeader({ alg, typ: 'JWT' })
    .setSubject(String(sub))
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt();
  if (exp !== undefined) emisorJwt.setExpirationTime(exp);
  else emisorJwt.setExpirationTime(Math.floor(Date.now() / 1000) + 120);
  return emisorJwt.sign(secreto);
}

async function main() {
  const pruebaClaveFaltante = spawnSync(process.execPath, [serverPath], {
    cwd: projectPath,
    env: { ...process.env, JWT_SECRET_BASE64: '', PORT: String(puertoDisponible) },
    encoding: 'utf8',
    timeout: 5000
  });
  await registrar('Configuración sin clave: el servidor falla al iniciar', async () => {
    assert.notEqual(pruebaClaveFaltante.status, 0);
    assert.match(pruebaClaveFaltante.stderr, /Falta JWT_SECRET_BASE64/);
  });

  await esperarServidor();

  await registrar('La página existente sigue servida y permite el CDN de Bootstrap en CSP', async () => {
    const respuesta = await fetch(`${baseUrl}/`);
    const html = await respuesta.text();
    assert.equal(respuesta.status, 200);
    assert.match(html, /Sistema de inventarios Nova/);
    assert.match(respuesta.headers.get('content-security-policy'), /https:\/\/cdn\.jsdelivr\.net/);
    const ejemplos = await fetch(`${baseUrl}/productos.json`);
    assert.equal(ejemplos.status, 200);
  });

  const usuarioA = await pedir('/api/usuarios', {
    metodo: 'POST',
    cuerpo: { nombre: 'Ana Prueba', email: 'ana.prueba@example.test', telefono: '4771234567', contrasena: contrasenaA }
  });
  assert.equal(usuarioA.status, 201);
  const idA = usuarioA.json.datos.id;

  const usuarioB = await pedir('/api/usuarios', {
    metodo: 'POST',
    cuerpo: { nombre: 'Bruno Prueba', email: 'bruno.prueba@example.test', telefono: '4771234568', contrasena: contrasenaB }
  });
  assert.equal(usuarioB.status, 201);
  const idB = usuarioB.json.datos.id;

  await registrar('Registro guarda hash y rechaza rol asignado por cliente', async () => {
    assert.equal(Object.hasOwn(usuarioA.json.datos, 'contrasena'), false);
    assert.equal(Object.hasOwn(usuarioA.json.datos, 'hashContrasena'), false);
    const intento = await pedir('/api/usuarios', {
      metodo: 'POST',
      cuerpo: { nombre: 'Eve Prueba', email: 'eve.prueba@example.test', telefono: '4771234569', contrasena: contrasenaA, rol: 'admin' }
    });
    assert.equal(intento.status, 400);
  });

  const loginBueno = await pedir('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email: 'ana.prueba@example.test', contrasena: contrasenaA }
  });
  await registrar('1. Login correcto: 200 y JWT sin datos sensibles', async () => {
    assert.equal(loginBueno.status, 200);
    assert.equal(typeof loginBueno.json.token, 'string');
    assert.equal(loginBueno.json.expiraEnSegundos, 2);
    const partes = loginBueno.json.token.split('.');
    const payload = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
    assert.equal(payload.sub, String(idA));
    assert.equal(payload.iss, emisor);
    assert.equal(payload.aud, audiencia);
    assert.equal(payload.exp - payload.iat, 2);
    assert.equal(JSON.stringify(payload).includes('contrasena'), false);
    assert.equal(JSON.stringify(payload).includes('email'), false);
  });

  const loginMalo = await pedir('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email: 'ana.prueba@example.test', contrasena: 'incorrecta-123' }
  });
  await registrar('2. Login incorrecto: 401 y sin token', async () => {
    assert.equal(loginMalo.status, 401);
    assert.equal(Object.hasOwn(loginMalo.json, 'token'), false);
    assert.equal(loginMalo.json.mensaje, 'Correo o contraseña incorrectos.');
  });

  await registrar('3. Recurso privado sin token: 401 JSON', async () => {
    const respuesta = await pedir('/api/productos');
    assert.equal(respuesta.status, 401);
    assert.equal(typeof respuesta.json.mensaje, 'string');
  });

  await registrar('4. Recurso privado con firma alterada: 401', async () => {
    const partes = loginBueno.json.token.split('.');
    partes[2] = `${partes[2][0] === 'a' ? 'b' : 'a'}${partes[2].slice(1)}`;
    const respuesta = await pedir('/api/productos', { token: partes.join('.') });
    assert.equal(respuesta.status, 401);
  });

  const loginCorto = await pedir('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email: 'ana.prueba@example.test', contrasena: contrasenaA }
  });
  await esperar(2200);
  await registrar('5. Token realmente vencido (emitido con TTL de prueba de 2 s): 401', async () => {
    assert.equal(loginCorto.status, 200);
    const respuesta = await pedir('/api/productos', { token: loginCorto.json.token });
    assert.equal(respuesta.status, 401);
  });

  const loginAActual = await pedir('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email: 'ana.prueba@example.test', contrasena: contrasenaA }
  });
  const tokenA = loginAActual.json.token;
  await registrar('6. Token válido y usuario autorizado: 200', async () => {
    assert.equal(loginAActual.status, 200);
    const respuesta = await pedir('/api/productos', { token: tokenA });
    assert.equal(respuesta.status, 200);
    assert.ok(Array.isArray(respuesta.json.datos));
  });

  await registrar('Usuario autorizado actualiza su propio perfil: 200', async () => {
    const respuesta = await pedir(`/api/usuarios/${idA}`, {
      metodo: 'PUT', token: tokenA, cuerpo: { telefono: '4771234500' }
    });
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.json.datos.telefono, '4771234500');
    assert.equal(Object.hasOwn(respuesta.json.datos, 'hashContrasena'), false);
  });

  const productoA = await pedir('/api/productos', {
    metodo: 'POST', token: tokenA,
    cuerpo: { nombre: 'Producto de Ana', sku: 'NOV-TEST-A', categoria: 'Otros', existencia: 5, minimo: 1 }
  });
  assert.equal(productoA.status, 201);
  await registrar('Propietario actualiza y desactiva su producto sin borrarlo: 200', async () => {
    const actualizado = await pedir(`/api/productos/${productoA.json.datos.id}`, {
      metodo: 'PUT', token: tokenA, cuerpo: { existencia: 6 }
    });
    assert.equal(actualizado.status, 200);
    assert.equal(actualizado.json.datos.existencia, 6);
    const eliminado = await pedir(`/api/productos/${productoA.json.datos.id}`, { metodo: 'DELETE', token: tokenA });
    assert.equal(eliminado.status, 200);
    assert.equal(eliminado.json.datos.activo, false);
    assert.equal((await pedir(`/api/productos/${productoA.json.datos.id}`, { token: tokenA })).status, 404);
  });

  const loginB = await pedir('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email: 'bruno.prueba@example.test', contrasena: contrasenaB }
  });
  assert.equal(loginB.status, 200);
  const productoB = await pedir('/api/productos', {
    metodo: 'POST',
    token: loginB.json.token,
    cuerpo: { nombre: 'Producto de Bruno', sku: 'NOV-TEST-B', categoria: 'Otros', existencia: 7, minimo: 1, descripcion: 'Recurso de prueba ajeno' }
  });
  assert.equal(productoB.status, 201);
  const idProductoB = productoB.json.datos.id;
  const loginAReciente = await pedir('/api/auth/login', {
    metodo: 'POST', cuerpo: { email: 'ana.prueba@example.test', contrasena: contrasenaA }
  });
  assert.equal(loginAReciente.status, 200);

  await registrar('7. Modificación de producto ajeno: 403 y datos sin cambios', async () => {
    const antes = await pedir(`/api/productos/${idProductoB}`, { token: loginAReciente.json.token });
    assert.equal(antes.status, 200);
    const respuesta = await pedir(`/api/productos/${idProductoB}`, {
      metodo: 'PUT', token: loginAReciente.json.token, cuerpo: { nombre: 'Intento no autorizado' }
    });
    assert.equal(respuesta.status, 403);
    const despues = await pedir(`/api/productos/${idProductoB}`, { token: loginAReciente.json.token });
    assert.equal(despues.status, 200);
    assert.equal(despues.json.datos.nombre, 'Producto de Bruno');
  });

  await registrar('8. Campo de tipo incorrecto: 400 JSON y sin error interno', async () => {
    const loginReciente = await pedir('/api/auth/login', {
      metodo: 'POST', cuerpo: { email: 'ana.prueba@example.test', contrasena: contrasenaA }
    });
    assert.equal(loginReciente.status, 200);
    const respuesta = await pedir('/api/productos', {
      metodo: 'POST', token: loginReciente.json.token,
      cuerpo: { nombre: 123, sku: 'NOV-BAD', categoria: 'Otros', existencia: 2, minimo: 0 }
    });
    assert.equal(respuesta.status, 400);
    assert.equal(typeof respuesta.json.mensaje, 'string');
  });

  await registrar('Token firmado con issuer incorrecto: 401', async () => {
    const token = await tokenFirmado({ sub: idA, iss: 'emisor-ajeno' });
    assert.equal((await pedir('/api/productos', { token })).status, 401);
  });

  await registrar('Token firmado con audience incorrecta: 401', async () => {
    const token = await tokenFirmado({ sub: idA, aud: 'audiencia-ajena' });
    assert.equal((await pedir('/api/productos', { token })).status, 401);
  });

  await registrar('Token firmado con HS384 no admitido: 401', async () => {
    const token = await tokenFirmado({ sub: idA, alg: 'HS384' });
    assert.equal((await pedir('/api/productos', { token })).status, 401);
  });

  await registrar('Campos de privilegio en perfil no se aceptan: 400', async () => {
    const loginReciente = await pedir('/api/auth/login', {
      metodo: 'POST', cuerpo: { email: 'ana.prueba@example.test', contrasena: contrasenaA }
    });
    assert.equal(loginReciente.status, 200);
    const respuesta = await pedir(`/api/usuarios/${idA}`, {
      metodo: 'PUT', token: loginReciente.json.token, cuerpo: { nombre: 'Ana Prueba', rol: 'admin' }
    });
    assert.equal(respuesta.status, 400);
  });

  const loginBReciente = await pedir('/api/auth/login', {
    metodo: 'POST', cuerpo: { email: 'bruno.prueba@example.test', contrasena: contrasenaB }
  });
  const bajaB = await pedir(`/api/usuarios/${idB}`, { metodo: 'DELETE', token: loginBReciente.json.token });
  await registrar('Cuenta inactiva: login y token anterior se rechazan con 401', async () => {
    assert.equal(bajaB.status, 200);
    assert.equal(bajaB.json.datos.activo, false);
    const login = await pedir('/api/auth/login', {
      metodo: 'POST', cuerpo: { email: 'bruno.prueba@example.test', contrasena: contrasenaB }
    });
    assert.equal(login.status, 401);
    assert.equal((await pedir('/api/productos', { token: loginBReciente.json.token })).status, 401);
  });

  await registrar('Limitador de login: el sexto intento fallido en ventana devuelve 429', async () => {
    for (let intento = 0; intento < 3; intento += 1) {
      assert.equal((await pedir('/api/auth/login', {
        metodo: 'POST', cuerpo: { email: 'inexistente@example.test', contrasena: 'incorrecta' }
      })).status, 401);
    }
    const limite = await pedir('/api/auth/login', {
      metodo: 'POST', cuerpo: { email: 'inexistente@example.test', contrasena: 'incorrecta' }
    });
    assert.equal(limite.status, 429);
  });
}

try {
  await main();
} catch (error) {
  resultados.push({ nombre: 'Error no controlado del ejecutor', resultado: 'FAIL', detalle: error.message });
} finally {
  if (proceso.exitCode === null) {
    proceso.kill();
    await new Promise((resolve) => proceso.once('exit', resolve));
  }
}

for (const resultado of resultados) {
  console.log(`${resultado.resultado}\t${resultado.nombre}${resultado.detalle ? ` — ${resultado.detalle}` : ''}`);
}
const fallos = resultados.filter((resultado) => resultado.resultado === 'FAIL');
console.log(`\n${resultados.length - fallos.length}/${resultados.length} comprobaciones correctas.`);
if (fallos.length > 0) process.exitCode = 1;
