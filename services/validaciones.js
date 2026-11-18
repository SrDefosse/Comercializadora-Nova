export function soloCampos(objeto, permitidos) {
  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) {
    return false;
  }
  return Object.keys(objeto).every((campo) => permitidos.includes(campo));
}

export function validarPerfil(datos, { requiereContrasena = false } = {}) {
  const campos = requiereContrasena
    ? ['nombre', 'email', 'telefono', 'contrasena']
    : ['nombre', 'email', 'telefono'];
  if (!soloCampos(datos, campos)) {
    return 'El cuerpo contiene campos no admitidos o no es un objeto JSON.';
  }
  if (typeof datos.nombre !== 'string' || datos.nombre.trim().length < 2 || datos.nombre.trim().length > 80) {
    return 'El nombre debe tener entre 2 y 80 caracteres.';
  }
  if (typeof datos.email !== 'string' || datos.email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) {
    return 'Se requiere un correo electrónico válido (máximo 254 caracteres).';
  }
  if (typeof datos.telefono !== 'string' || !/^\+?[0-9\s()\-]{7,20}$/.test(datos.telefono.trim())) {
    return 'El teléfono debe tener entre 7 y 20 caracteres numéricos o separadores válidos.';
  }
  if (requiereContrasena && (typeof datos.contrasena !== 'string'
    || datos.contrasena.length < 12 || datos.contrasena.length > 128)) {
    return 'La contraseña debe tener entre 12 y 128 caracteres.';
  }
  return null;
}

export function validarProducto(datos, { parcial = false } = {}) {
  const campos = ['nombre', 'sku', 'categoria', 'existencia', 'minimo', 'descripcion'];
  if (!soloCampos(datos, campos) || (parcial && Object.keys(datos).length === 0)) {
    return 'El cuerpo contiene campos no admitidos o no incluye datos para guardar.';
  }
  if (!parcial || datos.nombre !== undefined) {
    if (typeof datos.nombre !== 'string' || datos.nombre.trim().length < 1 || datos.nombre.trim().length > 120) {
      return 'El nombre debe tener entre 1 y 120 caracteres.';
    }
  }
  if (!parcial || datos.sku !== undefined) {
    if (typeof datos.sku !== 'string' || !/^[A-Za-z0-9-]{4,32}$/.test(datos.sku.trim())) {
      return 'El SKU debe contener entre 4 y 32 letras, números o guiones.';
    }
  }
  if (!parcial || datos.categoria !== undefined) {
    if (typeof datos.categoria !== 'string' || datos.categoria.trim().length < 1 || datos.categoria.trim().length > 50) {
      return 'La categoría debe tener entre 1 y 50 caracteres.';
    }
  }
  if ((!parcial || datos.existencia !== undefined)
    && (!Number.isSafeInteger(datos.existencia) || datos.existencia < 0)) {
    return 'La existencia debe ser un entero no negativo.';
  }
  if ((!parcial || datos.minimo !== undefined)
    && (!Number.isSafeInteger(datos.minimo) || datos.minimo < 0)) {
    return 'El mínimo debe ser un entero no negativo.';
  }
  if (datos.descripcion !== undefined
    && (typeof datos.descripcion !== 'string' || datos.descripcion.length > 500)) {
    return 'La descripción debe ser texto de hasta 500 caracteres.';
  }
  return null;
}

export function vistaUsuario(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    telefono: usuario.telefono,
    activo: usuario.activo
  };
}

export function vistaProducto(producto) {
  return {
    id: producto.id,
    nombre: producto.nombre,
    sku: producto.sku,
    categoria: producto.categoria?.nombre ?? '',
    existencia: producto.existencia,
    minimo: producto.minimo,
    descripcion: producto.descripcion,
    activo: producto.activo,
    propietarioId: producto.propietarioId
  };
}
