import { randomUUID } from 'node:crypto';

let sequelize;
try {
  await import('../config/cargar-env.js');
  const [{ inicializarBaseDatos, obtenerUsuarioDeDemostracion }, modelos] = await Promise.all([
    import('../db/inicializar.js'),
    import('../db/modelos.js')
  ]);
  const { Categoria, DetalleVenta, Producto, Venta } = modelos;
  sequelize = modelos.sequelize;
  await inicializarBaseDatos();

  const listaProductos = await Producto.findAll({
    where: {
      activo: true
    },
    include: [{
      model: Categoria,
      as: 'categoria',
      attributes: ['nombre']
    }],
    attributes: ['id', 'nombre', 'sku', 'existencia'],
    order: [['id', 'ASC']]
  });
  console.log(JSON.stringify(listaProductos.map((producto) => ({
    id: producto.id,
    nombre: producto.nombre,
    sku: producto.sku,
    existencia: producto.existencia,
    categoria: producto.categoria.nombre
  })), null, 2));

  const usuario = await obtenerUsuarioDeDemostracion();
  const productoDemostracion = await Producto.findOne({
    where: {
      sku: 'NOV-DEMO',
      activo: true
    }
  });
  const cantidad = 1;
  const venta = await sequelize.transaction(async (transaccion) => {
    const producto = await Producto.findByPk(productoDemostracion.id, {
      transaction: transaccion,
      lock: transaccion.LOCK.UPDATE
    });
    if (!producto || producto.existencia < cantidad) {
      throw new Error('No hay existencias suficientes para completar la venta de prueba.');
    }

    const importe = 10.00;
    const nuevaVenta = await Venta.create({
      folio: `D-${randomUUID()}`,
      usuarioId: usuario.id,
      total: (importe * cantidad).toFixed(2)
    }, {
      transaction: transaccion
    });

    await DetalleVenta.create({
      ventaId: nuevaVenta.id,
      productoId: producto.id,
      cantidad,
      precioUnitario: importe.toFixed(2)
    }, {
      transaction: transaccion
    });

    await producto.decrement('existencia', {
      by: cantidad,
      transaction: transaccion
    });
    return nuevaVenta;
  });

  const existenciaFinal = await Producto.findByPk(productoDemostracion.id, {
    attributes: ['existencia']
  });
  console.log(`TRANSACCION CONFIRMADA - venta ${venta.folio} - ${cantidad} unidad descontada - existencia final ${existenciaFinal.existencia}.`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (sequelize) await sequelize.close();
}
