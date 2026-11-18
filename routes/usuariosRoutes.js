import { Router } from 'express';
import {
  actualizarUsuario,
  consultarUsuario,
  consultarUsuarios,
  eliminarUsuario
} from '../controllers/usuariosController.js';
import { requerirPropietarioUsuario, verificarToken } from '../middleware/autenticacion.js';

const router = Router();

router.use(verificarToken);
router.get('/', consultarUsuarios);
router.get('/:id', requerirPropietarioUsuario, consultarUsuario);
router.put('/:id', requerirPropietarioUsuario, actualizarUsuario);
router.delete('/:id', requerirPropietarioUsuario, eliminarUsuario);

export default router;
