import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { SignJWT, jwtVerify } from 'jose';

try {
  const contenidoEnv = readFileSync(new URL('./.env', import.meta.url), 'utf8');
  for (const linea of contenidoEnv.split(/\r?\n/)) {
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

const scrypt = promisify(scryptCallback);
const app = express();
const directorio = path.dirname(fileURLToPath(import.meta.url));
const puerto = Number(process.env.PORT ?? 3000);
const emisor = process.env.JWT_ISSUER ?? 'comercializadora-nova-api';
const audiencia = process.env.JWT_AUDIENCE ?? 'comercializadora-nova-client';
const duracionAcceso = process.env.NODE_ENV === 'test'
  ? Number(process.env.JWT_TEST_ACCESS_TTL_SECONDS ?? 900)
  : 900;
const claveConfigurada = process.env.JWT_SECRET_BASE64;

function cargarClave() {
  if (!claveConfigurada) {
    throw new Error('Falta JWT_SECRET_BASE64. Configura una clave aleatoria de al menos 32 bytes antes de iniciar.');
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(claveConfigurada)) {
    throw new Error('JWT_SECRET_BASE64 debe ser una cadena Base64 válida.');
  }
  const clave = Buffer.from(claveConfigurada, 'base64');
  if (clave.length < 32 || clave.toString('base64') !== claveConfigurada) {
    throw new Error('JWT_SECRET_BASE64 debe representar al menos 32 bytes aleatorios.');
  }
  return new Uint8Array(clave);
}

if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
  throw new Error('PORT debe ser un puerto válido entre 1 y 65535.');
}
if (!emisor.trim() || !audiencia.trim()) {
  throw new Error('JWT_ISSUER y JWT_AUDIENCE no pueden estar vacíos.');
}
if (!Number.isInteger(duracionAcceso) || duracionAcceso < 1
  || (process.env.NODE_ENV === 'test' && process.env.JWT_TEST_ACCESS_TTL_SECONDS !== undefined && duracionAcceso > 60)) {
  throw new Error('La duración de prueba debe ser un entero entre 1 y 60 segundos.');
}
const claveJwt = cargarClave();

let productos = [
  { id: 1, nombre: 'Café molido 500 g', sku: 'NOV-001', categoria: 'Abarrotes', existencia: 24, minimo: 5, descripcion: 'Café molido para venta', activo: true, propietarioId: null },
  { id: 2, nombre: 'Agua mineral 1 L', sku: 'NOV-002', categoria: 'Bebidas', existencia: 12, minimo: 5, descripcion: 'Agua mineral de 1 litro', activo: true, propietarioId: null },
  { id: 3, nombre: 'Detergente líquido', sku: 'NOV-003', categoria: 'Limpieza', existencia: 8, minimo: 5, descripcion: 'Detergente líquido para ropa', activo: true, propietarioId: null }
];
const usuarios = [];
let siguienteIdProducto = 4;
let siguienteIdUsuario = 1;


async function crearHash(contrasena) {
  const salt = randomBytes(16);
  const hash = await scrypt(contrasena, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}


async function comprobarHash(contrasena, almacenado) {
  const [algoritmo, costo, bloque, paralelismo, saltBase64, hashBase64] = almacenado.split('$');
  if (algoritmo !== 'scrypt' || costo !== '16384' || bloque !== '8' || paralelismo !== '1') return false;
  const hashEsperado = Buffer.from(hashBase64, 'base64');
  const hashRecibido = await scrypt(contrasena, Buffer.from(saltBase64, 'base64'), hashEsperado.length, {
    N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024
  });
  return hashEsperado.length === hashRecibido.length && timingSafeEqual(hashEsperado, hashRecibido);
}


const hashSenal = await crearHash(randomBytes(32).toString('hex'));

function soloCampos(objeto, permitidos) {
  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) return false;
  return Object.keys(objeto).every((campo) => permitidos.includes(campo));
}


function validarPerfil(datos, requiereContrasena = false) {
  const campos = requiereContrasena
    ? ['nombre', 'email', 'telefono', 'contrasena']
    : ['nombre', 'email', 'telefono'];
  if (!soloCampos(datos, campos)) return 'El cuerpo contiene campos no admitidos o no es un objeto JSON.';
  if (typeof datos.nombre !== 'string' || datos.nombre.trim().length < 2 || datos.nombre.trim().length > 80) return 'El nombre debe tener entre 2 y 80 caracteres.';
  if (typeof datos.email !== 'string' || datos.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) return 'Se requiere un correo electrónico válido (máximo 254 caracteres).';
  if (typeof datos.telefono !== 'string' || !/^\+?[0-9\s()\-]{7,20}$/.test(datos.telefono.trim())) return 'El teléfono debe tener entre 7 y 20 caracteres numéricos o separadores válidos.';
  if (requiereContrasena && (typeof datos.contrasena !== 'string' || datos.contrasena.length < 12 || datos.contrasena.length > 128)) return 'La contraseña debe tener entre 12 y 128 caracteres.';
  return null;
}


function validarProducto(datos) {
  const campos = ['nombre', 'sku', 'categoria', 'existencia', 'minimo', 'descripcion'];
  if (!soloCampos(datos, campos)) return 'El cuerpo contiene campos no admitidos o no es un objeto JSON.';
  if (typeof datos.nombre !== 'string' || datos.nombre.trim().length < 1 || datos.nombre.trim().length > 120) return 'El nombre debe tener entre 1 y 120 caracteres.';
  if (typeof datos.sku !== 'string' || !/^[A-Za-z0-9-]{4,32}$/.test(datos.sku.trim())) return 'El SKU debe contener entre 4 y 32 letras, números o guiones.';
  if (typeof datos.categoria !== 'string' || datos.categoria.trim().length < 1 || datos.categoria.trim().length > 50) return 'La categoría debe tener entre 1 y 50 caracteres.';
  if (!Number.isSafeInteger(datos.existencia) || datos.existencia < 0) return 'La existencia debe ser un entero no negativo.';
  if (!Number.isSafeInteger(datos.minimo) || datos.minimo < 0) return 'El mínimo debe ser un entero no negativo.';
  if (datos.descripcion !== undefined && (typeof datos.descripcion !== 'string' || datos.descripcion.length > 500)) return 'La descripción debe ser texto de hasta 500 caracteres.';
  return null;
}


function buscarPorId(arreglo, id) {
  if (!/^\d+$/.test(id)) return null;
  return arreglo.find((elemento) => elemento.id === Number(id)) ?? null;
}


function vistaUsuario(usuario) {
  const { id, nombre, email, telefono, activo } = usuario;
  return { id, nombre, email, telefono, activo };
}


function vistaProducto(producto) {
  const { id, nombre, sku, categoria, existencia, minimo, descripcion, activo } = producto;
  return { id, nombre, sku, categoria, existencia, minimo, descripcion, activo };
}

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", 'https://cdn.jsdelivr.net']
    }
  }
}));


app.use(express.json({ limit: '16kb', strict: true }));
app.use(express.static(directorio, { dotfiles: 'deny' }));

app.use('/api', (solicitud, respuesta, siguiente) => {
  if (['POST', 'PUT'].includes(solicitud.method) && !solicitud.is('application/json')) {
    return respuesta.status(400).json({ mensaje: 'Envía el cuerpo con Content-Type: application/json.' });
  }
  siguiente();
});



app.post('/api/usuarios', async (solicitud, respuesta, siguiente) => {
  const error = validarPerfil(solicitud.body, true);
  if (error) return respuesta.status(400).json({ mensaje: error });
  const emailNormalizado = solicitud.body.email.trim().toLowerCase();
  if (usuarios.some((usuario) => usuario.email.toLowerCase() === emailNormalizado)) {
    return respuesta.status(400).json({ mensaje: 'No fue posible registrar el usuario con esos datos.' });
  }
  try {
    const usuario = {
      id: siguienteIdUsuario++,
      nombre: solicitud.body.nombre.trim(),
      email: solicitud.body.email.trim(),
      telefono: solicitud.body.telefono.trim(),
      hashContrasena: await crearHash(solicitud.body.contrasena),
      activo: true
    };
    usuarios.push(usuario);
    return respuesta.status(201).json({ mensaje: 'Usuario registrado correctamente.', datos: vistaUsuario(usuario) });
  } catch (errorInterno) {
    return siguiente(errorInterno);
  }
});


const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_solicitud, respuesta) => respuesta.status(429).json({ mensaje: 'Demasiados intentos. Intenta de nuevo más tarde.' })
});

app.post('/api/auth/login', limitadorLogin, async (solicitud, respuesta, siguiente) => {
  if (!soloCampos(solicitud.body, ['email', 'contrasena'])
    || typeof solicitud.body.email !== 'string'
    || solicitud.body.email.length > 254
    || typeof solicitud.body.contrasena !== 'string'
    || solicitud.body.contrasena.length > 128) {
    return respuesta.status(400).json({ mensaje: 'Proporciona un correo y una contraseña válidos.' });
  }
  try {
    const emailNormalizado = solicitud.body.email.trim().toLowerCase();
    const usuario = usuarios.find((elemento) => elemento.email.toLowerCase() === emailNormalizado);
    const coincide = await comprobarHash(solicitud.body.contrasena, usuario?.hashContrasena ?? hashSenal);
    if (!usuario || !usuario.activo || !coincide) {
      return respuesta.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
    }

    const ahora = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(String(usuario.id))
      .setIssuer(emisor)
      .setAudience(audiencia)
      .setIssuedAt(ahora)
      .setExpirationTime(ahora + duracionAcceso)
      .sign(claveJwt);
    return respuesta.status(200).json({ mensaje: 'Inicio de sesión correcto.', token, tipo: 'Bearer', expiraEnSegundos: duracionAcceso });
  } catch (errorInterno) {
    return siguiente(errorInterno);
  }
});



async function verificarToken(solicitud, respuesta, siguiente) {
  const autorizacion = solicitud.get('authorization') ?? '';
  const coincidencia = autorizacion.match(/^Bearer ([^\s]+)$/i);
  if (!coincidencia) return respuesta.status(401).json({ mensaje: 'Se requiere un token Bearer válido.' });

  try {
    const { payload } = await jwtVerify(coincidencia[1], claveJwt, {
      algorithms: ['HS256'],
      issuer: emisor,
      audience: audiencia,
      requiredClaims: ['sub', 'exp']
    });
    if (typeof payload.sub !== 'string' || !/^\d+$/.test(payload.sub)
      || !Number.isSafeInteger(Number(payload.sub))
      || !Number.isSafeInteger(payload.exp)) {
      return respuesta.status(401).json({ mensaje: 'Token inválido o vencido.' });
    }
    const usuario = buscarPorId(usuarios, payload.sub);
    if (!usuario || !usuario.activo) return respuesta.status(401).json({ mensaje: 'Token inválido o vencido.' });
    solicitud.usuarioAutenticado = vistaUsuario(usuario);
    return siguiente();
  } catch {
    return respuesta.status(401).json({ mensaje: 'Token inválido o vencido.' });
  }
}


function requerirPropietarioUsuario(solicitud, respuesta, siguiente) {
  const usuario = buscarPorId(usuarios, solicitud.params.id);
  if (!usuario) return respuesta.status(404).json({ mensaje: 'Usuario no encontrado.' });
  if (usuario.id !== solicitud.usuarioAutenticado.id) return respuesta.status(403).json({ mensaje: 'No tienes permiso para modificar este usuario.' });
  solicitud.usuarioObjetivo = usuario;
  return siguiente();
}


function requerirPropietarioProducto(solicitud, respuesta, siguiente) {
  const producto = buscarPorId(productos, solicitud.params.id);
  if (!producto || !producto.activo) return respuesta.status(404).json({ mensaje: 'Producto no encontrado.' });
  if (producto.propietarioId !== solicitud.usuarioAutenticado.id) return respuesta.status(403).json({ mensaje: 'No tienes permiso para modificar este producto.' });
  solicitud.productoObjetivo = producto;
  return siguiente();
}


app.get('/api/usuarios', verificarToken, (solicitud, respuesta) => {
  const usuario = usuarios.find((elemento) => elemento.id === solicitud.usuarioAutenticado.id);
  return respuesta.status(200).json({ datos: usuario?.activo ? [vistaUsuario(usuario)] : [] });
});


app.get('/api/usuarios/:id', verificarToken, requerirPropietarioUsuario, (solicitud, respuesta) => {
  respuesta.status(200).json({ datos: vistaUsuario(solicitud.usuarioObjetivo) });
});


app.put('/api/usuarios/:id', verificarToken, requerirPropietarioUsuario, (solicitud, respuesta) => {
  const cambios = solicitud.body;
  if (!soloCampos(cambios, ['nombre', 'email', 'telefono']) || Object.keys(cambios).length === 0) {
    return respuesta.status(400).json({ mensaje: 'Envía uno o más campos de perfil permitidos.' });
  }
  const actualizado = { ...vistaUsuario(solicitud.usuarioObjetivo), ...cambios };
  const error = validarPerfil({ nombre: actualizado.nombre, email: actualizado.email, telefono: actualizado.telefono });
  if (error) return respuesta.status(400).json({ mensaje: error });
  const emailNormalizado = actualizado.email.trim().toLowerCase();
  if (usuarios.some((usuario) => usuario.id !== solicitud.usuarioObjetivo.id && usuario.email.toLowerCase() === emailNormalizado)) {
    return respuesta.status(400).json({ mensaje: 'No fue posible actualizar el perfil con esos datos.' });
  }
  solicitud.usuarioObjetivo.nombre = actualizado.nombre.trim();
  solicitud.usuarioObjetivo.email = actualizado.email.trim();
  solicitud.usuarioObjetivo.telefono = actualizado.telefono.trim();
  return respuesta.status(200).json({ mensaje: 'Perfil actualizado correctamente.', datos: vistaUsuario(solicitud.usuarioObjetivo) });
});

app.delete('/api/usuarios/:id', verificarToken, requerirPropietarioUsuario, (solicitud, respuesta) => {
  solicitud.usuarioObjetivo.activo = false;
  return respuesta.status(200).json({ mensaje: 'Cuenta desactivada correctamente.', datos: vistaUsuario(solicitud.usuarioObjetivo) });
});

app.get('/api/productos', verificarToken, (_solicitud, respuesta) => {
  respuesta.status(200).json({ datos: productos.filter((producto) => producto.activo).map(vistaProducto) });
});

app.get('/api/productos/:id', verificarToken, (solicitud, respuesta) => {
  const producto = buscarPorId(productos, solicitud.params.id);
  if (!producto || !producto.activo) return respuesta.status(404).json({ mensaje: 'Producto no encontrado.' });
  return respuesta.status(200).json({ datos: vistaProducto(producto) });
});

app.post('/api/productos', verificarToken, (solicitud, respuesta) => {
  const error = validarProducto(solicitud.body);
  if (error) return respuesta.status(400).json({ mensaje: error });
  const sku = solicitud.body.sku.trim().toUpperCase();
  if (productos.some((producto) => producto.sku.toUpperCase() === sku)) {
    return respuesta.status(400).json({ mensaje: 'Ya existe un producto con ese SKU.' });
  }
  const producto = {
    id: siguienteIdProducto++,
    nombre: solicitud.body.nombre.trim(),
    sku: solicitud.body.sku.trim(),
    categoria: solicitud.body.categoria.trim(),
    existencia: solicitud.body.existencia,
    minimo: solicitud.body.minimo,
    descripcion: (solicitud.body.descripcion ?? '').trim(),
    activo: true,
    propietarioId: solicitud.usuarioAutenticado.id
  };
  productos.push(producto);
  return respuesta.status(201).json({ mensaje: 'Producto registrado correctamente.', datos: vistaProducto(producto) });
});


app.put('/api/productos/:id', verificarToken, requerirPropietarioProducto, (solicitud, respuesta) => {
  if (!soloCampos(solicitud.body, ['nombre', 'sku', 'categoria', 'existencia', 'minimo', 'descripcion'])
    || Object.keys(solicitud.body).length === 0) {
    return respuesta.status(400).json({ mensaje: 'Envía uno o más campos de producto permitidos.' });
  }
  const actualizado = { ...vistaProducto(solicitud.productoObjetivo), ...solicitud.body };
  const error = validarProducto({
    nombre: actualizado.nombre,
    sku: actualizado.sku,
    categoria: actualizado.categoria,
    existencia: actualizado.existencia,
    minimo: actualizado.minimo,
    descripcion: actualizado.descripcion
  });
  if (error) return respuesta.status(400).json({ mensaje: error });
  const sku = actualizado.sku.trim().toUpperCase();
  if (productos.some((producto) => producto.id !== solicitud.productoObjetivo.id && producto.sku.toUpperCase() === sku)) {
    return respuesta.status(400).json({ mensaje: 'Ya existe un producto con ese SKU.' });
  }
  solicitud.productoObjetivo.nombre = actualizado.nombre.trim();
  solicitud.productoObjetivo.sku = actualizado.sku.trim();
  solicitud.productoObjetivo.categoria = actualizado.categoria.trim();
  solicitud.productoObjetivo.existencia = actualizado.existencia;
  solicitud.productoObjetivo.minimo = actualizado.minimo;
  solicitud.productoObjetivo.descripcion = (actualizado.descripcion ?? '').trim();
  return respuesta.status(200).json({ mensaje: 'Producto actualizado correctamente.', datos: vistaProducto(solicitud.productoObjetivo) });
});


app.delete('/api/productos/:id', verificarToken, requerirPropietarioProducto, (solicitud, respuesta) => {
  solicitud.productoObjetivo.activo = false;
  return respuesta.status(200).json({ mensaje: 'Producto desactivado correctamente.', datos: vistaProducto(solicitud.productoObjetivo) });
});


app.use('/api', (_solicitud, respuesta) => respuesta.status(404).json({ mensaje: 'Ruta de API no encontrada.' }));
app.use((error, _solicitud, respuesta, _siguiente) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return respuesta.status(400).json({ mensaje: 'El JSON enviado no tiene un formato válido.' });
  }
  if (error?.type === 'entity.too.large') return respuesta.status(413).json({ mensaje: 'El cuerpo excede el límite permitido.' });
  return respuesta.status(500).json({ mensaje: 'Error interno del servidor.' });
});

app.listen(puerto, '127.0.0.1', () => {
  console.log(`Comercializadora Nova disponible en http://localhost:${puerto}`);
});
