import { Router } from 'express';
import { Producto } from '../db/modelos.js';
import {
  actualizarProducto,
  consultarProducto,
  consultarProductos,
  eliminarProducto,
  registrarProducto
} from '../controllers/productosController.js';
import { verificarToken } from '../middleware/autenticacion.js';

const router = Router();

async function requerirPropietarioProducto(solicitud, respuesta, siguiente) {
  const id = Number(solicitud.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return respuesta.status(404).json({ mensaje: 'Producto no encontrado.' });
  }

  const producto = await Producto.findOne({
    where: {
      id,
      activo: true
    },
    include: [{
      association: 'categoria',
      attributes: ['nombre']
    }]
  });
  if (!producto) {
    return respuesta.status(404).json({ mensaje: 'Producto no encontrado.' });
  }
  if (producto.propietarioId !== solicitud.usuarioAutenticado.id) {
    return respuesta.status(403).json({ mensaje: 'No tienes permiso para modificar este producto.' });
  }
  solicitud.productoObjetivo = producto;
  return siguiente();
}

router.use(verificarToken);
router.get('/', consultarProductos);
router.get('/:id', consultarProducto);
router.post('/', registrarProducto);
router.put('/:id', requerirPropietarioProducto, actualizarProducto);
router.delete('/:id', requerirPropietarioProducto, eliminarProducto);

export default router;
