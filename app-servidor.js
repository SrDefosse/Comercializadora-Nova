import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/authRoutes.js';
import usuariosRoutes from './routes/usuariosRoutes.js';
import productosRoutes from './routes/productosRoutes.js';

const app = express();
const directorio = path.dirname(fileURLToPath(import.meta.url));

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
app.use(express.json({
  limit: '16kb',
  strict: true
}));
app.use((solicitud, respuesta, siguiente) => {
  if (solicitud.path.startsWith('/api/')
    && ['POST', 'PUT'].includes(solicitud.method)
    && !solicitud.is('application/json')) {
    return respuesta.status(400).json({
      mensaje: 'Envía el cuerpo con Content-Type: application/json.'
    });
  }
  return siguiente();
});

app.use('/api', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api', (_solicitud, respuesta) => respuesta.status(404).json({
  mensaje: 'Ruta de API no encontrada.'
}));
app.use(express.static(directorio, { dotfiles: 'deny' }));

app.use((error, _solicitud, respuesta, _siguiente) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return respuesta.status(400).json({
      mensaje: 'El JSON enviado no tiene un formato válido.'
    });
  }
  if (error?.type === 'entity.too.large') {
    return respuesta.status(413).json({
      mensaje: 'El cuerpo excede el límite permitido.'
    });
  }
  if (error.name === 'SequelizeValidationError') {
    return respuesta.status(400).json({
      mensaje: 'Los datos no cumplen las validaciones del modelo.'
    });
  }
  console.error('Error interno controlado en la aplicación.');
  return respuesta.status(500).json({
    mensaje: 'Error interno del servidor.'
  });
});

export default app;
