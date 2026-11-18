import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { iniciarSesion, registrarUsuario } from '../controllers/authController.js';

const router = Router();
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_solicitud, respuesta) => respuesta.status(429).json({
    mensaje: 'Demasiados intentos. Intenta de nuevo más tarde.'
  })
});

router.post('/usuarios', registrarUsuario);
router.post('/auth/login', limitadorLogin, iniciarSesion);

export default router;
