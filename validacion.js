// conecta la validación en tiempo real al formulario recibido.
export function configurarValidacion(formulario) {
  const camposContacto = ['#contactoNombre', '#contactoEmail', '#contactoTelefono']
    .map((selector) => formulario.querySelector(selector));

  function validarCampo(campo) {
    if (campo.id === 'contactoNombre') {
      campo.setCustomValidity(campo.value.trim().length >= 2 ? '' : 'Nombre incompleto');
    }

    campo.classList.toggle('is-valid', campo.value.length > 0 && campo.checkValidity());
    campo.classList.toggle('is-invalid', campo.value.length > 0 && !campo.checkValidity());
  }

  camposContacto.forEach((campo) => {
    campo.addEventListener('input', () => validarCampo(campo));
    campo.addEventListener('blur', () => validarCampo(campo));
  });

  function validarCamposContacto() {
    camposContacto.forEach(validarCampo);
  }

  formulario.addEventListener('reset', () => {
    window.setTimeout(() => {
      formulario.classList.remove('was-validated');
      formulario.querySelectorAll('.is-valid, .is-invalid').forEach((campo) => {
        campo.classList.remove('is-valid', 'is-invalid');
        campo.setCustomValidity('');
      });
    }, 0);
  });

  return validarCamposContacto;
}
