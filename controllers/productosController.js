import { Op } from 'sequelize';
import { Categoria, Producto, sequelize } from '../db/modelos.js';
import { validarProducto, vistaProducto } from '../services/validaciones.js';

function opcionesProducto() {
  return {
    include: [{
      model: Categoria,
      as: 'categoria',
      attributes: ['nombre']
    }]
  };
}

export async function consultarProductos(_solicitud, respuesta) {
  const productos = await Producto.findAll({
    where: {
      activo: true
    },
    ...opcionesProducto(),
    order: [['id', 'ASC']]
  });
  return respuesta.status(200).json({
    datos: productos.map(vistaProducto)
  });
}

export async function consultarProducto(solicitud, respuesta) {
  const id = Number(solicitud.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return respuesta.status(404).json({ mensaje: 'Producto no encontrado.' });
  }
  const producto = await Producto.findOne({
    where: {
      id,
      activo: true
    },
    ...opcionesProducto()
  });
  if (!producto) {
    return respuesta.status(404).json({ mensaje: 'Producto no encontrado.' });
  }
  return respuesta.status(200).json({ datos: vistaProducto(producto) });
}

export async function registrarProducto(solicitud, respuesta) {
  const error = validarProducto(solicitud.body);
  if (error) {
    return respuesta.status(400).json({ mensaje: error });
  }

  const sku = solicitud.body.sku.trim().toUpperCase();
  const existente = await Producto.findOne({ where: { sku } });
  if (existente) {
    return respuesta.status(400).json({ mensaje: 'Ya existe un producto con ese SKU.' });
  }

  try {
    const producto = await sequelize.transaction(async (transaccion) => {
      const [categoria] = await Categoria.findOrCreate({
        where: {
          nombre: solicitud.body.categoria.trim()
        },
        transaction: transaccion
      });
      return Producto.create({
        nombre: solicitud.body.nombre.trim(),
        sku,
        categoriaId: categoria.id,
        existencia: solicitud.body.existencia,
        minimo: solicitud.body.minimo,
        descripcion: (solicitud.body.descripcion ?? '').trim(),
        activo: true,
        propietarioId: solicitud.usuarioAutenticado.id
      }, { transaction: transaccion });
    });
    const productoConCategoria = await Producto.findByPk(producto.id, opcionesProducto());
    return respuesta.status(201).json({
      mensaje: 'Producto registrado correctamente.',
      datos: vistaProducto(productoConCategoria)
    });
  } catch (errorBase) {
    if (errorBase.name === 'SequelizeUniqueConstraintError') {
      return respuesta.status(400).json({ mensaje: 'Ya existe un producto con ese SKU.' });
    }
    throw errorBase;
  }
}

export async function actualizarProducto(solicitud, respuesta) {
  const producto = solicitud.productoObjetivo;
  const cambios = solicitud.body;
  const errorParcial = validarProducto(cambios, { parcial: true });
  if (errorParcial) {
    return respuesta.status(400).json({ mensaje: errorParcial });
  }
  const datosActualizados = {
    nombre: cambios.nombre ?? producto.nombre,
    sku: cambios.sku ?? producto.sku,
    categoria: cambios.categoria ?? producto.categoria.nombre,
    existencia: cambios.existencia ?? producto.existencia,
    minimo: cambios.minimo ?? producto.minimo,
    descripcion: cambios.descripcion ?? producto.descripcion
  };
  const error = validarProducto(datosActualizados);
  if (error) {
    return respuesta.status(400).json({ mensaje: error });
  }

  const sku = datosActualizados.sku.trim().toUpperCase();
  const skuDuplicado = await Producto.findOne({
    where: {
      sku,
      id: {
        [Op.ne]: producto.id
      }
    }
  });
  if (skuDuplicado) {
    return respuesta.status(400).json({ mensaje: 'Ya existe un producto con ese SKU.' });
  }

  try {
    await sequelize.transaction(async (transaccion) => {
      const [categoria] = await Categoria.findOrCreate({
        where: {
          nombre: datosActualizados.categoria.trim()
        },
        transaction: transaccion
      });
      await producto.update({
        nombre: datosActualizados.nombre.trim(),
        sku,
        categoriaId: categoria.id,
        existencia: datosActualizados.existencia,
        minimo: datosActualizados.minimo,
        descripcion: datosActualizados.descripcion.trim()
      }, { transaction: transaccion });
    });
    const productoConCategoria = await Producto.findByPk(producto.id, opcionesProducto());
    return respuesta.status(200).json({
      mensaje: 'Producto actualizado correctamente.',
      datos: vistaProducto(productoConCategoria)
    });
  } catch (errorBase) {
    if (errorBase.name === 'SequelizeUniqueConstraintError') {
      return respuesta.status(400).json({ mensaje: 'Ya existe un producto con ese SKU.' });
    }
    throw errorBase;
  }
}

export async function eliminarProducto(solicitud, respuesta) {
  await solicitud.productoObjetivo.update({ activo: false });
  return respuesta.status(200).json({
    mensaje: 'Producto desactivado correctamente.',
    datos: vistaProducto(solicitud.productoObjetivo)
  });
}
