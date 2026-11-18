await import('./config/cargar-env.js');

const puerto = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
  throw new Error('PORT debe ser un puerto válido entre 1 y 65535.');
}

let conexion;
let servidorHttp;

try {
  const [{ default: app }, inicializador, modelos] = await Promise.all([
    import('./app-servidor.js'),
    import('./db/inicializar.js'),
    import('./db/modelos.js')
  ]);
  conexion = modelos.sequelize;
  await inicializador.inicializarBaseDatos();
  servidorHttp = app.listen(puerto, '127.0.0.1', () => {
    console.log(`Comercializadora Nova disponible en http://localhost:${puerto}`);
  });
} catch (error) {
  if (conexion) {
    await conexion.close();
  }
  console.error(`No se pudo iniciar Comercializadora Nova: ${error.message}`);
  throw error;
}

export async function detenerServidor() {
  if (servidorHttp) {
    await new Promise((resolve, reject) => {
      servidorHttp.close((error) => error ? reject(error) : resolve());
    });
    servidorHttp = null;
  }
  if (conexion) {
    await conexion.close();
    conexion = null;
  }
}
