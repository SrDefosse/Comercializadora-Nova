let sequelize;
try {
  await import('../config/cargar-env.js');
  const [{ inicializarBaseDatos }, conexion] = await Promise.all([
    import('../db/inicializar.js'),
    import('../db/sequelize.js')
  ]);
  sequelize = conexion.sequelize;
  await inicializarBaseDatos();
  console.log('PostgreSQL conectado y modelos sincronizados.');
  console.log('Datos iniciales de Comercializadora Nova disponibles.');
} catch (error) {
  console.error(`No se pudo inicializar PostgreSQL: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (sequelize) await sequelize.close();
}
