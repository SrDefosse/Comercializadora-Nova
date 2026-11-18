import { Usuario } from '../db/modelos.js';
import { soloCampos, validarPerfil, vistaUsuario } from '../services/validaciones.js';

export async function consultarUsuarios(solicitud, respuesta) {
  return respuesta.status(200).json({
    datos: [vistaUsuario(solicitud.usuarioAutenticado)]
  });
}

export async function consultarUsuario(solicitud, respuesta) {
  return respuesta.status(200).json({
    datos: vistaUsuario(solicitud.usuarioObjetivo)
  });
}

export async function actualizarUsuario(solicitud, respuesta) {
  const cambios = solicitud.body;
  if (!soloCampos(cambios, ['nombre', 'email', 'telefono']) || Object.keys(cambios).length === 0) {
    return respuesta.status(400).json({ mensaje: 'Envía uno o más campos de perfil permitidos.' });
  }

  const actualizado = {
    nombre: cambios.nombre ?? solicitud.usuarioObjetivo.nombre,
    email: cambios.email ?? solicitud.usuarioObjetivo.email,
    telefono: cambios.telefono ?? solicitud.usuarioObjetivo.telefono
  };
  const error = validarPerfil(actualizado);
  if (error) {
    return respuesta.status(400).json({ mensaje: error });
  }

  try {
    await solicitud.usuarioObjetivo.update({
      nombre: actualizado.nombre.trim(),
      email: actualizado.email.trim().toLowerCase(),
      telefono: actualizado.telefono.trim()
    });
    return respuesta.status(200).json({
      mensaje: 'Perfil actualizado correctamente.',
      datos: vistaUsuario(solicitud.usuarioObjetivo)
    });
  } catch (errorBase) {
    if (errorBase.name === 'SequelizeUniqueConstraintError') {
      return respuesta.status(400).json({ mensaje: 'No fue posible actualizar el perfil con esos datos.' });
    }
    throw errorBase;
  }
}

export async function eliminarUsuario(solicitud, respuesta) {
  await solicitud.usuarioObjetivo.update({ activo: false });
  return respuesta.status(200).json({
    mensaje: 'Cuenta desactivada correctamente.',
    datos: vistaUsuario(solicitud.usuarioObjetivo)
  });
}
