import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { Categoria, Producto, sequelize } from './modelos.js';

const scrypt = promisify(scryptCallback);

const productosIniciales = [
  {
    nombre: 'Café molido 500 g',
    sku: 'NOV-001',
    categoria: 'Abarrotes',
    existencia: 24,
    minimo: 5,
    descripcion: 'Café molido para venta'
  },
  {
    nombre: 'Agua mineral 1 L',
    sku: 'NOV-002',
    categoria: 'Bebidas',
    existencia: 12,
    minimo: 5,
    descripcion: 'Agua mineral de 1 litro'
  },
  {
    nombre: 'Detergente líquido',
    sku: 'NOV-003',
    categoria: 'Limpieza',
    existencia: 8,
    minimo: 5,
    descripcion: 'Detergente líquido para ropa'
  },
  {
    nombre: 'Producto para prueba transaccional',
    sku: 'NOV-DEMO',
    categoria: 'Abarrotes',
    existencia: 100,
    minimo: 1,
    descripcion: 'Artículo de demostración para la operación con transacción'
  }
];

async function hashNoUtilizableParaInicioDeSesion() {
  const salt = randomBytes(16);
  const derivado = await scrypt(randomBytes(32).toString('hex'), salt, 64);
  return `scrypt$16384$8$1$${salt.toString('base64')}$${derivado.toString('base64')}`;
}

export async function inicializarBaseDatos({ datosIniciales = true } = {}) {
  await sequelize.authenticate();
  await sequelize.sync();

  if (datosIniciales) {
    for (const producto of productosIniciales) {
      const [categoria] = await Categoria.findOrCreate({ where: { nombre: producto.categoria } });
      await Producto.findOrCreate({
        where: { sku: producto.sku },
        defaults: {
          nombre: producto.nombre,
          sku: producto.sku,
          categoriaId: categoria.id,
          existencia: producto.existencia,
          minimo: producto.minimo,
          descripcion: producto.descripcion
        }
      });
    }
  }
}

export async function obtenerUsuarioDeDemostracion() {
  const [usuario] = await sequelize.models.Usuario.findOrCreate({
    where: { email: 'prueba.transaccion@nova.invalid' },
    defaults: {
      nombre: 'Cuenta de demostración',
      email: 'prueba.transaccion@nova.invalid',
      telefono: '0000000000',
      hashContrasena: await hashNoUtilizableParaInicioDeSesion(),
      activo: false
    }
  });
  return usuario;
}
