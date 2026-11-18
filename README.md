# Comercializadora Nova

Aplicación web para consultar y administrar el inventario de Comercializadora Nova. La interfaz se comunica con una API REST de Express, y Sequelize guarda los datos en una base compatible con PostgreSQL. Para trabajar en local sin instalar un servidor PostgreSQL, el proyecto inicia PGlite.

## Funciones

- Registro de cuentas e inicio de sesión.
- Consulta de productos activos y sus categorías.
- Alta, edición y desactivación lógica de productos.
- Rutas para consultar, actualizar y desactivar la cuenta propia.
- Autenticación con JWT para las rutas privadas.
- Datos iniciales de productos para probar el inventario.
- Modelos para usuarios, categorías, productos, ventas y detalles de venta.

## Cómo se conectan las partes

```mermaid
flowchart TD
    Persona([Persona]) --> Vista["Navegador<br/>index.html y app.js"]
    Vista -->|Solicitudes y respuestas JSON| Express["Express<br/>app-servidor.js"]

    Express --> Publicas["Rutas públicas<br/>POST /api/usuarios<br/>POST /api/auth/login"]
    Publicas --> Auth["controllers/authController.js"]
    Auth --> Credenciales["services/credenciales.js<br/>Hash scrypt y emisión de JWT"]
    Auth --> ORM["Sequelize<br/>db/modelos.js y db/sequelize.js"]

    Express --> Privadas["Rutas privadas<br/>usuariosRoutes.js y productosRoutes.js"]
    Privadas --> Middleware["middleware/autenticacion.js<br/>Verifica token y cuenta activa"]
    Middleware --> Controladores["Controladores de usuarios y productos"]
    Middleware -. "PUT/DELETE de productos" .-> Propietario["productosRoutes.js<br/>Comprueba propiedad"]
    Propietario --> Controladores
    Controladores --> ORM
    Credenciales --> Middleware
    ORM --> Local[("PGlite local<br/>data/postgres/")]
    ORM --> Externa[("PostgreSQL externo<br/>DATABASE_URL")]

    Inicio["npm start"] --> PGlite["scripts/servidor-local.js<br/>Inicia PGlite local"]
    PGlite --> Local
    PGlite --> Server["server.js"]
    Server --> Inicializar["db/inicializar.js<br/>Prepara tablas y productos iniciales"]
    Inicializar --> ORM
    Server --> Express

    Externo["npm run start:externa"] --> Server
```

En el modo local, `npm start` inicia PGlite y después prepara las tablas y los productos iniciales. Con `npm run start:externa`, el servidor usa la instancia indicada en `DATABASE_URL`. El navegador se comunica con Express. Las rutas públicas atienden el registro y el inicio de sesión; las privadas verifican el JWT antes de llegar a los controladores. Para editar o desactivar un producto, la ruta también comprueba que pertenezca a la cuenta autenticada.

## Herramientas

- Node.js y npm.
- Express 5 para el servidor web y la API.
- Sequelize 6 como ORM.
- PostgreSQL. En la ejecución local se usa PGlite, que ofrece PostgreSQL dentro del proceso de Node.js.
- JWT con la biblioteca `jose`.

## Requisitos

Instala Node.js y npm. No necesitas instalar PostgreSQL para iniciar la aplicación con PGlite.

## Preparar la aplicación local

Desde la carpeta del proyecto, instala las dependencias:

```bash
npm install
```

Crea el archivo `.env` a partir del ejemplo:

```powershell
Copy-Item .env.example .env
```

Genera una clave aleatoria de 32 bytes en Base64:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Copia el resultado en `JWT_SECRET_BASE64` dentro de `.env`. No compartas esa clave ni agregues `.env` al repositorio. El archivo está excluido por `.gitignore`.

Los demás valores del ejemplo sirven para iniciar localmente. El servidor requiere una clave JWT válida para arrancar.

## Iniciar y detener

Inicia el servidor con:

```bash
npm start
```

Abre [http://localhost:3000](http://localhost:3000). Al iniciar, el proyecto crea o abre la base local en `data/postgres/`, prepara las tablas con Sequelize y agrega los productos de ejemplo que todavía no existan.

Para detenerlo, presiona `Ctrl+C` en la terminal. La carpeta `data/postgres/` está excluida de Git y conserva los datos entre ejecuciones.

En la ejecución normal no hace falta correr `npm run db:init` antes de `npm start`, porque el servidor inicializa la base al arrancar. Ese comando también está disponible para preparar la base local por separado.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `JWT_SECRET_BASE64` | Clave aleatoria requerida para firmar y verificar los JWT. Debe representar al menos 32 bytes. |
| `JWT_ISSUER` | Identifica al servicio que emite los tokens. |
| `JWT_AUDIENCE` | Identifica al cliente al que se destinan los tokens. |
| `PORT` | Puerto HTTP de la aplicación. El ejemplo usa `3000`. |
| `PGLITE_PORT` | Puerto local de PostgreSQL que utiliza PGlite. El ejemplo usa `5432`. |
| `PGLITE_DATA_DIR` | Opcional. Cambia la carpeta donde PGlite guarda sus datos. |
| `DATABASE_URL` | URL de conexión cuando se usa una instancia PostgreSQL externa. |
| `PGSSL` | Usa `true` para habilitar SSL en la conexión PostgreSQL externa. |
| `SQL_LOG` | Usa `true` para mostrar las consultas SQL de Sequelize. |

## Usar PostgreSQL externo

Si ya cuentas con una instancia PostgreSQL, agrega su URL en `.env`:

```env
DATABASE_URL=postgres://usuario:contrasena@localhost:5432/comercializadora_nova
```

Prepara las tablas y los productos iniciales con:

```bash
npm run db:init:externa
```

Luego inicia la aplicación sin PGlite:

```bash
npm run start:externa
```

La consulta y la transacción de demostración también se pueden ejecutar contra esa base con:

```bash
npm run db:demo:externa
```

Configura SSL según las condiciones de tu servidor. Para publicar la aplicación en una red, usa HTTPS.

## Base de datos y operaciones

Sequelize define las entidades en `db/modelos.js` y sus relaciones en el mismo archivo:

| Entidad | Relaciones |
| --- | --- |
| Usuario | Tiene productos y ventas. |
| Categoría | Tiene varios productos. |
| Producto | Pertenece a una categoría y puede ser propiedad de un usuario. |
| Venta | Pertenece a un usuario y tiene detalles de venta. |
| DetalleVenta | Relaciona una venta con un producto, y guarda cantidad y precio unitario. |

Una venta se relaciona con varios productos y un producto puede aparecer en varias ventas. `DetalleVenta` representa esa relación muchos a muchos. Las altas y actualizaciones de productos guardan el producto y su categoría dentro de una transacción. El script `scripts/demostrar-base.js` consulta productos y realiza una venta de demostración que registra la venta, el detalle y el descuento de existencias dentro de una sola transacción.

Para preparar la base local de forma independiente:

```bash
npm run db:init
```

Para ejecutar la consulta y la transacción de demostración en la base local:

```bash
npm run db:demo
```

Este último comando descuenta una unidad del producto `NOV-DEMO` en la base seleccionada. Si quieres mantener intactos tus datos habituales, puedes indicar una carpeta de prueba temporal antes de ejecutarlo en PowerShell:

```powershell
$env:PGLITE_DATA_DIR = "$env:TEMP\nova-db-demo"
npm run db:demo
Remove-Item Env:PGLITE_DATA_DIR
```

La demostración es opcional y no se necesita para iniciar la aplicación ni para recorrer sus funciones desde el navegador. La carpeta indicada en `PGLITE_DATA_DIR` queda en `%TEMP%` después de la ejecución; quitar la variable de entorno no borra esa carpeta.

## API REST

La API recibe y devuelve JSON. Para las solicitudes `POST` y `PUT`, envía `Content-Type: application/json`. Las rutas privadas reciben el token en `Authorization: Bearer <token>`.

### Rutas públicas

| Método | Ruta | Función |
| --- | --- | --- |
| `POST` | `/api/usuarios` | Registra una cuenta y almacena un hash de la contraseña. |
| `POST` | `/api/auth/login` | Comprueba las credenciales y devuelve un JWT si la cuenta está activa. |

Ejemplo de registro:

```json
{
  "nombre": "Ana López",
  "email": "ana@ejemplo.com",
  "telefono": "4771234567",
  "contrasena": "Una-clave-de-ejemplo-123"
}
```

Ejemplo de inicio de sesión:

```json
{
  "email": "ana@ejemplo.com",
  "contrasena": "Una-clave-de-ejemplo-123"
}
```

### Rutas privadas

| Método | Ruta | Permiso y función |
| --- | --- | --- |
| `GET` | `/api/usuarios` | Devuelve el perfil de la cuenta autenticada. |
| `GET` | `/api/usuarios/:id` | Consulta el perfil propio. |
| `PUT` | `/api/usuarios/:id` | Actualiza nombre, correo o teléfono del perfil propio. |
| `DELETE` | `/api/usuarios/:id` | Desactiva la cuenta propia; no borra la fila. |
| `GET` | `/api/productos` | Consulta los productos activos. |
| `GET` | `/api/productos/:id` | Consulta un producto activo por identificador. |
| `POST` | `/api/productos` | Registra un producto y su categoría. |
| `PUT` | `/api/productos/:id` | Actualiza un producto creado por la cuenta autenticada. |
| `DELETE` | `/api/productos/:id` | Desactiva un producto propio; no borra la fila. |

Ejemplo para registrar un producto:

```json
{
  "nombre": "Café molido 500 g",
  "sku": "NOV-001",
  "categoria": "Abarrotes",
  "existencia": 24,
  "minimo": 5,
  "descripcion": "Café molido para venta"
}
```

El servidor valida los campos y rechaza propiedades que no forman parte de cada operación. Las respuestas incluyen un mensaje en JSON. Entre los códigos usados están `200` para consultas y cambios correctos, `201` al crear, `400` para datos inválidos, `401` cuando falta un token válido y `404` si no se encuentra el recurso. Si una cuenta intenta cambiar un recurso que pertenece a otra cuenta, recibe `403`.

## Sesión y seguridad

El inicio de sesión emite un JWT firmado con HS256, con vigencia de 15 minutos, identificador de usuario en `sub`, emisor y audiencia. El token no contiene contraseñas, hashes ni correo. Un JWT firmado no cifra su contenido, así que no se deben incluir datos privados en él.

El navegador conserva el token en memoria y lo agrega a las solicitudes privadas. No lo guarda en `localStorage`; al recargar la página se debe iniciar sesión otra vez. El middleware verifica la firma y los datos del token, y consulta que la cuenta exista y siga activa. Las contraseñas se guardan con scrypt. El login acepta hasta cinco intentos fallidos en una ventana de 15 minutos y después devuelve `429`.

La conexión HTTP de `localhost` sirve para las pruebas locales. Para desplegar el sistema en una red, configura HTTPS.

## Pruebas disponibles

La suite de seguridad crea una base temporal y usa cuentas ficticias. Ejecútala con:

```bash
npm run test:security
```

El script comprueba el registro y login, tokens inválidos o vencidos, permisos, validación de datos y límites de intentos. Al terminar elimina la base temporal de la prueba.

## Estructura del proyecto

```text
assets/                 Imágenes de la interfaz
config/                 Lectura de variables desde .env
controllers/            Lógica de usuarios, autenticación y productos
db/                     Modelos Sequelize e inicialización de datos
middleware/             Verificación de JWT y permisos
routes/                 Rutas REST
scripts/                Arranque local, pruebas y demostración de BD
services/               Validación y manejo de credenciales
postman/                Colección para probar la API
app-servidor.js          Configuración de Express y archivos estáticos
server.js               Inicialización de la API con PostgreSQL
index.html, app.js       Interfaz web
styles.css              Estilos de la interfaz
validacion.js            Validaciones del formulario
```
