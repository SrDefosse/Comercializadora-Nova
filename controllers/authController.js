import { Usuario } from '../db/modelos.js';
import {
  comprobarHashConSenal,
  configuracionJwt,
  crearHash,
  emitirToken
} from '../services/credenciales.js';
import { soloCampos, validarPerfil, vistaUsuario } from '../services/validaciones.js';

export async function registrarUsuario(solicitud, respuesta) {
  const error = validarPerfil(solicitud.body, { requiereContrasena: true });
  if (error) {
    return respuesta.status(400).json({ mensaje: error });
  }

  try {
    const usuario = await Usuario.create({
      nombre: solicitud.body.nombre.trim(),
      email: solicitud.body.email.trim().toLowerCase(),
      telefono: solicitud.body.telefono.trim(),
      hashContrasena: await crearHash(solicitud.body.contrasena),
      activo: true
    });
    return respuesta.status(201).json({
      mensaje: 'Usuario registrado correctamente.',
      datos: vistaUsuario(usuario)
    });
  } catch (errorBase) {
    if (errorBase.name === 'SequelizeUniqueConstraintError') {
      return respuesta.status(400).json({ mensaje: 'No fue posible registrar el usuario con esos datos.' });
    }
    throw errorBase;
  }
}

export async function iniciarSesion(solicitud, respuesta) {
  if (!soloCampos(solicitud.body, ['email', 'contrasena'])
    || typeof solicitud.body.email !== 'string'
    || solicitud.body.email.length > 254
    || typeof solicitud.body.contrasena !== 'string'
    || solicitud.body.contrasena.length > 128) {
    return respuesta.status(400).json({ mensaje: 'Proporciona un correo y una contraseña válidos.' });
  }

  const usuario = await Usuario.findOne({
    where: {
      email: solicitud.body.email.trim().toLowerCase()
    }
  });
  const coincide = await comprobarHashConSenal(solicitud.body.contrasena, usuario?.hashContrasena);
  if (!usuario || !usuario.activo || !coincide) {
    return respuesta.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
  }

  return respuesta.status(200).json({
    mensaje: 'Inicio de sesión correcto.',
    token: await emitirToken(usuario.id),
    tipo: 'Bearer',
    expiraEnSegundos: configuracionJwt.duracionAcceso,
    datos: vistaUsuario(usuario)
  });
}
