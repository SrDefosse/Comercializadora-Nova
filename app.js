import { configurarValidacion } from './validacion.js';

const formulario = document.querySelector('#formularioProducto');
const mensajeExito = document.querySelector('#mensajeExito');
const listaProductos = document.querySelector('#listaProductos');
const listaVacia = document.querySelector('#listaVacia');
const estadoCarga = document.querySelector('#estadoCarga');
const productos = [];
let siguienteId = 1;
const validarCamposContacto = configurarValidacion(formulario);

// crea y agrega a la lista un producto con su botón para eliminarlo.
function agregarProducto(producto) {
  productos.push(producto);

  const elemento = document.createElement('li');
  elemento.className = 'list-group-item d-flex justify-content-between align-items-center gap-3';

  const texto = document.createElement('span');
  texto.textContent = `${producto.nombre} · ${producto.sku} · ${producto.existencia} unidades`;

  const botonEliminar = document.createElement('button');
  botonEliminar.type = 'button';
  botonEliminar.className = 'btn btn-sm btn-outline-danger';
  botonEliminar.textContent = 'Eliminar';
  botonEliminar.setAttribute('aria-label', `Eliminar ${producto.nombre}`);
  botonEliminar.addEventListener('click', () => {
    const indice = productos.findIndex((elementoLista) => elementoLista.id === producto.id);
    if (indice !== -1) productos.splice(indice, 1);
    elemento.remove();
    listaVacia.classList.toggle('d-none', productos.length > 0);
  });

  elemento.append(texto, botonEliminar);
  listaProductos.append(elemento);
  listaVacia.classList.add('d-none');
}

// obtiene los productos de ejemplo desde el archivo JSON local.
async function cargarProductos() {
  estadoCarga.textContent = 'Cargando productos…';

  try {
    const respuesta = await fetch('productos.json');
    if (!respuesta.ok) throw new Error('No se pudieron cargar los productos.');

    const productosApi = await respuesta.json();
    productosApi.forEach((producto) => {
      const yaExiste = productos.some((productoActual) => productoActual.id === producto.id);
      if (!yaExiste) agregarProducto(producto);
    });

    estadoCarga.textContent = `${productosApi.length} productos de ejemplo cargados.`;
  } catch (error) {
    estadoCarga.textContent = `Error: ${error.message}`;
  }
}

document.querySelector('#cargarProductos').addEventListener('click', cargarProductos);

formulario.addEventListener('submit', (evento) => {
  evento.preventDefault();
  validarCamposContacto();

  if (!formulario.checkValidity()) {
    evento.stopPropagation();
    formulario.classList.add('was-validated');
    return;
  }

  formulario.classList.add('was-validated');
  agregarProducto({
    id: `local-${siguienteId++}`,
    nombre: document.querySelector('#nombre').value.trim(),
    sku: document.querySelector('#sku').value.trim(),
    existencia: document.querySelector('#existencia').value
  });
  mensajeExito.classList.remove('d-none');
  mensajeExito.focus();
});

formulario.addEventListener('reset', () => {
  window.setTimeout(() => mensajeExito.classList.add('d-none'), 0);
});
