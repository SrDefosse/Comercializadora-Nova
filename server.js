import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const puerto = 3000;
const directorio = path.dirname(fileURLToPath(import.meta.url));

let productos = [
  { id: 1, nombre: 'Café molido 500 g', sku: 'NOV-001', categoria: 'Abarrotes', existencia: 24, minimo: 5, descripcion: 'Café molido para venta', activo: true },
  { id: 2, nombre: 'Agua mineral 1 L', sku: 'NOV-002', categoria: 'Bebidas', existencia: 12, minimo: 5, descripcion: 'Agua mineral de 1 litro', activo: true },
  { id: 3, nombre: 'Detergente líquido', sku: 'NOV-003', categoria: 'Limpieza', existencia: 8, minimo: 5, descripcion: 'Detergente líquido para ropa', activo: true }
];
let usuarios = [];
let siguienteIdProducto = 4;
let siguienteIdUsuario = 1;

app.use(express.json());
app.use(express.static(directorio));

// las solicitudes envían un cuerpo json.
app.use('/api', (solicitud, respuesta, siguiente) => {
  if (['POST', 'PUT'].includes(solicitud.method) && !solicitud.is('application/json')) {
    return respuesta.status(400).json({ mensaje: 'El cuerpo debe enviarse con Content-Type: application/json.' });
  }
  siguiente();
});

function validarUsuario(datos) {
  if (typeof datos.nombre !== 'string' || datos.nombre.trim().length < 2) return 'El nombre es obligatorio y debe tener al menos 2 caracteres.';
  if (typeof datos.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) return 'Se requiere un correo electrónico válido.';
  if (typeof datos.telefono !== 'string' || !datos.telefono.trim()) return 'El teléfono es obligatorio.';
  return null;
}

function validarProducto(datos) {
  if (typeof datos.nombre !== 'string' || !datos.nombre.trim()) return 'El nombre del producto es obligatorio.';
  if (typeof datos.sku !== 'string' || !datos.sku.trim()) return 'El SKU es obligatorio.';
  if (typeof datos.categoria !== 'string' || !datos.categoria.trim()) return 'La categoría es obligatoria.';
  if (!Number.isInteger(datos.existencia) || datos.existencia < 0) return 'La existencia debe ser un entero igual o mayor a cero.';
  if (!Number.isInteger(datos.minimo) || datos.minimo < 0) return 'El mínimo debe ser un entero igual o mayor a cero.';
  if (datos.descripcion !== undefined && typeof datos.descripcion !== 'string') return 'La descripción debe ser texto.';
  return null;
}

function buscarPorId(arreglo, id) {
  if (!/^\d+$/.test(id)) return null;
  return arreglo.find((elemento) => elemento.id === Number(id)) ?? null;
}

app.post('/api/usuarios', (solicitud, respuesta) => {
  const error = validarUsuario(solicitud.body ?? {});
  if (error) return respuesta.status(400).json({ mensaje: error });

  const usuario = {
    id: siguienteIdUsuario++,
    nombre: solicitud.body.nombre.trim(),
    email: solicitud.body.email.trim(),
    telefono: solicitud.body.telefono.trim(),
    activo: true
  };
  usuarios.push(usuario);
  return respuesta.status(201).json({ mensaje: 'Usuario registrado correctamente.', datos: usuario });
});

app.get('/api/usuarios', (_solicitud, respuesta) => {
  respuesta.status(200).json({ datos: usuarios });
});

app.get('/api/usuarios/:id', (solicitud, respuesta) => {
  const usuario = buscarPorId(usuarios, solicitud.params.id);
  if (!usuario) return respuesta.status(404).json({ mensaje: 'Usuario no encontrado.' });
  return respuesta.status(200).json({ datos: usuario });
});

app.put('/api/usuarios/:id', (solicitud, respuesta) => {
  const usuario = buscarPorId(usuarios, solicitud.params.id);
  if (!usuario) return respuesta.status(404).json({ mensaje: 'Usuario no encontrado.' });
  const actualizado = { ...usuario, ...(solicitud.body ?? {}) };
  const error = validarUsuario(actualizado);
  if (error) return respuesta.status(400).json({ mensaje: error });
  usuario.nombre = actualizado.nombre.trim();
  usuario.email = actualizado.email.trim();
  usuario.telefono = actualizado.telefono.trim();
  return respuesta.status(200).json({ mensaje: 'Perfil actualizado correctamente.', datos: usuario });
});

app.delete('/api/usuarios/:id', (solicitud, respuesta) => {
  const usuario = buscarPorId(usuarios, solicitud.params.id);
  if (!usuario) return respuesta.status(404).json({ mensaje: 'Usuario no encontrado.' });
  usuario.activo = false;
  return respuesta.status(200).json({ mensaje: 'Usuario desactivado correctamente.', datos: usuario });
});

app.post('/api/productos', (solicitud, respuesta) => {
  const error = validarProducto(solicitud.body ?? {});
  if (error) return respuesta.status(400).json({ mensaje: error });
  const producto = {
    id: siguienteIdProducto++,
    nombre: solicitud.body.nombre.trim(),
    sku: solicitud.body.sku.trim(),
    categoria: solicitud.body.categoria.trim(),
    existencia: solicitud.body.existencia,
    minimo: solicitud.body.minimo,
    descripcion: (solicitud.body.descripcion ?? '').trim(),
    activo: true
  };
  productos.push(producto);
  return respuesta.status(201).json({ mensaje: 'Producto registrado correctamente.', datos: producto });
});

app.get('/api/productos', (_solicitud, respuesta) => {
  respuesta.status(200).json({ datos: productos });
});

app.get('/api/productos/:id', (solicitud, respuesta) => {
  const producto = buscarPorId(productos, solicitud.params.id);
  if (!producto) return respuesta.status(404).json({ mensaje: 'Producto no encontrado.' });
  return respuesta.status(200).json({ datos: producto });
});

app.put('/api/productos/:id', (solicitud, respuesta) => {
  const producto = buscarPorId(productos, solicitud.params.id);
  if (!producto) return respuesta.status(404).json({ mensaje: 'Producto no encontrado.' });
  const actualizado = { ...producto, ...(solicitud.body ?? {}) };
  const error = validarProducto(actualizado);
  if (error) return respuesta.status(400).json({ mensaje: error });
  producto.nombre = actualizado.nombre.trim();
  producto.sku = actualizado.sku.trim();
  producto.categoria = actualizado.categoria.trim();
  producto.existencia = actualizado.existencia;
  producto.minimo = actualizado.minimo;
  producto.descripcion = actualizado.descripcion.trim();
  return respuesta.status(200).json({ mensaje: 'Producto actualizado correctamente.', datos: producto });
});

app.delete('/api/productos/:id', (solicitud, respuesta) => {
  const producto = buscarPorId(productos, solicitud.params.id);
  if (!producto) return respuesta.status(404).json({ mensaje: 'Producto no encontrado.' });
  producto.activo = false;
  return respuesta.status(200).json({ mensaje: 'Producto desactivado correctamente.', datos: producto });
});

app.use('/api', (_solicitud, respuesta) => {
  respuesta.status(404).json({ mensaje: 'Ruta de API no encontrada.' });
});

// devuelve errores de JSON mal formado como JSON, igual que el resto de la API.
app.use((error, _solicitud, respuesta, _siguiente) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return respuesta.status(400).json({ mensaje: 'El JSON enviado no tiene un formato válido.' });
  }
  return respuesta.status(500).json({ mensaje: 'Error interno del servidor.' });
});

app.listen(puerto, () => {
  console.log(`Comercializadora Nova disponible en http://localhost:${puerto}`);
});
