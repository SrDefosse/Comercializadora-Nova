const formularioRegistro = document.querySelector('#formularioRegistro');
const formularioLogin = document.querySelector('#formularioLogin');
const formularioProducto = document.querySelector('#formularioProducto');
const formulariosAcceso = document.querySelector('#formulariosAcceso');
const sesionActiva = document.querySelector('#sesionActiva');
const usuarioActual = document.querySelector('#usuarioActual');
const mensajeCuenta = document.querySelector('#mensajeCuenta');
const mensajeProducto = document.querySelector('#mensajeProducto');
const listaProductos = document.querySelector('#listaProductos');
const listaVacia = document.querySelector('#listaVacia');
const estadoCarga = document.querySelector('#estadoCarga');
const botonActualizarInventario = document.querySelector('#cargarProductos');
const botonGuardarProducto = document.querySelector('#guardarProducto');
const botonCancelarEdicion = document.querySelector('#cancelarEdicion');

let tokenAcceso = null;
let usuarioSesion = null;
let productoEnEdicion = null;

async function solicitarApi(ruta, { metodo = 'GET', datos } = {}) {
  const encabezados = {};
  if (tokenAcceso) {
    encabezados.Authorization = `Bearer ${tokenAcceso}`;
  }
  if (datos !== undefined) {
    encabezados['Content-Type'] = 'application/json';
  }

  const respuesta = await fetch(ruta, {
    method: metodo,
    headers: encabezados,
    body: datos === undefined ? undefined : JSON.stringify(datos)
  });
  let contenido;
  try {
    contenido = await respuesta.json();
  } catch {
    contenido = null;
  }
  if (!respuesta.ok) {
    if (respuesta.status === 401 && tokenAcceso) {
      cerrarSesion('La sesión terminó. Inicia sesión otra vez.');
    }
    throw new Error(contenido?.mensaje ?? `La solicitud falló (${respuesta.status}).`);
  }
  return contenido;
}

function mostrarMensaje(elemento, texto, tipo = 'secondary') {
  elemento.textContent = texto;
  elemento.className = `mt-3 mb-0 text-${tipo}`;
}

async function abrirSesion(datos) {
  tokenAcceso = datos.token;
  usuarioSesion = datos.datos;
  usuarioActual.textContent = `Sesión iniciada: ${usuarioSesion.nombre} (${usuarioSesion.email})`;
  formulariosAcceso.classList.add('d-none');
  sesionActiva.classList.remove('d-none');
  botonActualizarInventario.disabled = false;
  botonGuardarProducto.disabled = false;
  estadoCarga.textContent = 'Consultando productos guardados en la base de datos…';
  await cargarProductos();
}

function cerrarSesion(mensaje = 'Sesión cerrada.') {
  tokenAcceso = null;
  usuarioSesion = null;
  formulariosAcceso.classList.remove('d-none');
  sesionActiva.classList.add('d-none');
  botonActualizarInventario.disabled = true;
  botonGuardarProducto.disabled = true;
  listaProductos.replaceChildren();
  listaVacia.classList.add('d-none');
  estadoCarga.textContent = 'Inicia sesión para consultar el inventario.';
  cancelarEdicion();
  mostrarMensaje(mensajeCuenta, mensaje, 'secondary');
}

function crearElemento(tag, clase, texto) {
  const elemento = document.createElement(tag);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function crearTarjetaProducto(producto) {
  const columna = crearElemento('div', 'col-md-6 col-xl-4');
  const tarjeta = crearElemento('article', 'card h-100 border-0 shadow-sm');
  const contenido = crearElemento('div', 'card-body d-flex flex-column');
  const titulo = crearElemento('h3', 'h5 card-title', producto.nombre);
  const detalles = crearElemento('p', 'mb-1', `SKU: ${producto.sku}`);
  const categoria = crearElemento('p', 'mb-1 text-secondary', `Categoría: ${producto.categoria}`);
  const existencia = crearElemento('p', 'mb-1', `Existencia: ${producto.existencia} · Mínimo: ${producto.minimo}`);
  const descripcion = crearElemento('p', 'small text-secondary flex-grow-1', producto.descripcion || 'Sin descripción');
  contenido.append(titulo, detalles, categoria, existencia, descripcion);

  if (producto.propietarioId === usuarioSesion.id) {
    const acciones = crearElemento('div', 'd-flex gap-2 mt-3');
    const botonEditar = crearElemento('button', 'btn btn-sm btn-outline-primary', 'Editar');
    botonEditar.type = 'button';
    botonEditar.addEventListener('click', () => editarProducto(producto));
    const botonEliminar = crearElemento('button', 'btn btn-sm btn-outline-danger', 'Desactivar');
    botonEliminar.type = 'button';
    botonEliminar.addEventListener('click', () => desactivarProducto(producto));
    acciones.append(botonEditar, botonEliminar);
    contenido.append(acciones);
  } else {
    contenido.append(crearElemento('p', 'small text-secondary mb-0', 'Producto de ejemplo o de otra cuenta.'));
  }

  tarjeta.append(contenido);
  columna.append(tarjeta);
  return columna;
}

async function cargarProductos() {
  if (!tokenAcceso) return;
  botonActualizarInventario.disabled = true;
  estadoCarga.textContent = 'Cargando productos desde la base de datos…';
  try {
    const respuesta = await solicitarApi('/api/productos');
    listaProductos.replaceChildren(...respuesta.datos.map(crearTarjetaProducto));
    listaVacia.classList.toggle('d-none', respuesta.datos.length > 0);
    estadoCarga.textContent = `${respuesta.datos.length} productos consultados desde PostgreSQL.`;
  } catch (error) {
    estadoCarga.textContent = error.message;
  } finally {
    botonActualizarInventario.disabled = !tokenAcceso;
  }
}

function leerFormularioProducto() {
  return {
    nombre: document.querySelector('#nombre').value.trim(),
    sku: document.querySelector('#sku').value.trim(),
    categoria: document.querySelector('#categoria').value.trim(),
    existencia: Number(document.querySelector('#existencia').value),
    minimo: Number(document.querySelector('#minimo').value),
    descripcion: document.querySelector('#descripcion').value.trim()
  };
}

function editarProducto(producto) {
  productoEnEdicion = producto;
  document.querySelector('#nombre').value = producto.nombre;
  document.querySelector('#sku').value = producto.sku;
  document.querySelector('#categoria').value = producto.categoria;
  document.querySelector('#existencia').value = producto.existencia;
  document.querySelector('#minimo').value = producto.minimo;
  document.querySelector('#descripcion').value = producto.descripcion;
  botonGuardarProducto.textContent = 'Guardar cambios';
  botonCancelarEdicion.classList.remove('d-none');
  mostrarMensaje(mensajeProducto, `Editando ${producto.nombre}.`, 'primary');
  document.querySelector('#captura').scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicion() {
  productoEnEdicion = null;
  formularioProducto.reset();
  formularioProducto.classList.remove('was-validated');
  if (botonGuardarProducto) botonGuardarProducto.textContent = 'Guardar producto';
  if (botonCancelarEdicion) botonCancelarEdicion.classList.add('d-none');
}

async function desactivarProducto(producto) {
  if (!window.confirm(`¿Desactivar el producto «${producto.nombre}»?`)) return;
  try {
    const respuesta = await solicitarApi(`/api/productos/${producto.id}`, {
      metodo: 'DELETE'
    });
    mostrarMensaje(mensajeProducto, respuesta.mensaje, 'success');
    await cargarProductos();
  } catch (error) {
    mostrarMensaje(mensajeProducto, error.message, 'danger');
  }
}

async function iniciarSesion(email, contrasena) {
  const respuesta = await solicitarApi('/api/auth/login', {
    metodo: 'POST',
    datos: {
      email,
      contrasena
    }
  });
  await abrirSesion(respuesta);
}

formularioRegistro.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (!formularioRegistro.reportValidity()) return;
  const datos = Object.fromEntries(new FormData(formularioRegistro));
  try {
    await solicitarApi('/api/usuarios', {
      metodo: 'POST',
      datos
    });
    formularioRegistro.reset();
    await iniciarSesion(datos.email, datos.contrasena);
    mostrarMensaje(mensajeCuenta, 'Cuenta creada y sesión iniciada. Los datos ya están guardados.', 'success');
  } catch (error) {
    mostrarMensaje(mensajeCuenta, error.message, 'danger');
  }
});

formularioLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (!formularioLogin.reportValidity()) return;
  const datos = Object.fromEntries(new FormData(formularioLogin));
  try {
    await iniciarSesion(datos.email, datos.contrasena);
    formularioLogin.reset();
    mostrarMensaje(mensajeCuenta, 'Sesión iniciada correctamente.', 'success');
  } catch (error) {
    mostrarMensaje(mensajeCuenta, error.message, 'danger');
  }
});

formularioProducto.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (!tokenAcceso || !formularioProducto.reportValidity()) return;
  const datos = leerFormularioProducto();
  try {
    const respuesta = await solicitarApi(
      productoEnEdicion ? `/api/productos/${productoEnEdicion.id}` : '/api/productos',
      {
        metodo: productoEnEdicion ? 'PUT' : 'POST',
        datos
      }
    );
    cancelarEdicion();
    mostrarMensaje(mensajeProducto, respuesta.mensaje, 'success');
    await cargarProductos();
  } catch (error) {
    mostrarMensaje(mensajeProducto, error.message, 'danger');
  }
});

botonActualizarInventario.addEventListener('click', cargarProductos);
botonCancelarEdicion.addEventListener('click', cancelarEdicion);
document.querySelector('#cerrarSesion').addEventListener('click', () => cerrarSesion());
