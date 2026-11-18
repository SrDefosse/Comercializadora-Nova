import { jwtVerify } from 'jose';
import { Usuario } from '../db/modelos.js';
import { configuracionJwt } from '../services/credenciales.js';

export async function verificarToken(solicitud, respuesta, siguiente) {
  const autorizacion = solicitud.get('authorization') ?? '';
  const coincidencia = autorizacion.match(/^Bearer ([^\s]+)$/i);
  if (!coincidencia) {
    return respuesta.status(401).json({ mensaje: 'Se requiere un token Bearer válido.' });
  }

  try {
    const { payload } = await jwtVerify(coincidencia[1], configuracionJwt.claveJwt, {
      algorithms: ['HS256'],
      issuer: configuracionJwt.emisor,
      audience: configuracionJwt.audiencia,
      requiredClaims: ['sub', 'exp']
    });
    if (typeof payload.sub !== 'string' || !/^\d+$/.test(payload.sub)
      || !Number.isSafeInteger(Number(payload.sub))
      || !Number.isSafeInteger(payload.exp)) {
      return respuesta.status(401).json({ mensaje: 'Token inválido o vencido.' });
    }

    const usuario = await Usuario.findByPk(Number(payload.sub));
    if (!usuario || !usuario.activo) {
      return respuesta.status(401).json({ mensaje: 'Token inválido o vencido.' });
    }

    solicitud.usuarioAutenticado = usuario;
    return siguiente();
  } catch {
    return respuesta.status(401).json({ mensaje: 'Token inválido o vencido.' });
  }
}

export function requerirPropietarioUsuario(solicitud, respuesta, siguiente) {
  const idSolicitado = Number(solicitud.params.id);
  if (!Number.isSafeInteger(idSolicitado) || idSolicitado < 1) {
    return respuesta.status(404).json({ mensaje: 'Usuario no encontrado.' });
  }
  if (idSolicitado !== solicitud.usuarioAutenticado.id) {
    return respuesta.status(403).json({ mensaje: 'No tienes permiso para modificar este usuario.' });
  }
  solicitud.usuarioObjetivo = solicitud.usuarioAutenticado;
  return siguiente();
}
