# LocalPanelELP

Panel web de gestión de archivos local, inspirado en Pelican Panel, diseñado para ejecutarse en Windows.

## Características

- **Interfaz web moderna** con tema oscuro estilo panel de servidores
- **Gestión completa de archivos**: subir, descargar, renombrar, eliminar, mover
- **Editor de archivos integrado** con resaltado de sintaxis y guardado con Ctrl+S
- **Drag & Drop**: arrastra y suelta archivos directamente al panel
- **Navegación de carpetas** con breadcrumbs
- **Búsqueda de archivos** integrada
- **Directorios vinculados**: monta cualquier carpeta de tu sistema Windows
- **Detección automática de servidores Minecraft**: escanea y configura `server.properties`
- **Editor visual de server.properties** con campos agrupados (Red, Mundo, Seguridad, etc.)
- **Aceptación de EULA** con un clic
- **Gestión de bots de Discord** (Node.js, Python, Java, C#, Go, Ruby)
- **Control de procesos**: inicia, detén y reinicia bots desde el panel
- **Logs en tiempo real** de cada bot
- **Detección automática de bots** escaneando dependencias
- **Soporta todo tipo de archivos**: imágenes, videos, música, documentos, código, ejecutables, etc.
- **Autenticación** con usuario y contraseña
- **Dashboard** con estadísticas de almacenamiento y accesos rápidos
- **Cola de subidas** con progreso en tiempo real
- **Almacenamiento local** en la carpeta `storage/`

## Novedades (Actualización reciente)

### Cambios principales

- **Extracción de archivos comprimidos desde el panel** (`.zip`, `.tar`, `.tar.gz`, `.tgz`, `.gz`, `.rar`, `.7z`, `.bz2`)
- **Botón “Extraer”** en el explorador de archivos para lanzar la extracción con 1 clic
- **Selección de versión de Python por bot de Discord** (elige el ejecutable/versión para iniciar ese bot)
- **Instalación de dependencias de bots** desde panel (incluyendo Python con versión seleccionada)
- **Pestaña de red en Minecraft** con estado TCP y optimización rápida para tunnel
- **Optimización de arranque Minecraft** con flags JVM orientados a reducir picos de latencia
- **Correcciones de estabilidad UI** para evitar pantallas en negro por errores de render

### Aviso para usuarios que ya descargaron el repo

Actualiza tu copia local y reinicia el panel:

```bash
git pull
npm install
npm run build
npm start
```

Si usas desarrollo:

```bash
git pull
npm install
npm run dev
```

## Requisitos

- [Node.js](https://nodejs.org) v18 o superior (incluye npm)

## Tutorial: cómo iniciar el panel

Esta guía está pensada para Windows y para arrancar el panel en pocos minutos.

### 1) Requisitos

- Tener instalado [Node.js](https://nodejs.org) v18 o superior
- Verificar instalación en una terminal:

```bash
node -v
npm -v
```

### 2) Primer inicio (rápido, recomendado)

1. En la carpeta del proyecto, haz doble clic en `start.bat`.
2. El script hará automáticamente:
   - instalación de dependencias (si faltan)
   - build del frontend (si falta `dist`)
   - arranque del servidor
3. Abre en el navegador: `http://localhost:5173`

### 3) Inicio manual (producción)

Si prefieres hacerlo por comandos:

```bash
npm install
npm run build
npm start
```

Después abre: `http://localhost:5173`

### 4) Inicio en modo desarrollo

Usa este modo si vas a editar el panel y quieres recarga en caliente.

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5174`
- Backend/API: `http://localhost:5173`

También puedes iniciar desarrollo con doble clic en `dev.bat`.

### 5) Credenciales por defecto

- **Usuario:** `admin`
- **Contraseña:** `admin`

Recomendado: cambiarla al entrar en **Ajustes**.

### 6) Cómo detener el panel

- Si lo abriste en terminal: presiona `Ctrl + C`.
- Si lo abriste con `.bat`: cierra la ventana de consola.

### 7) Solución rápida de problemas

- Si no abre la web, confirma que estás entrando a `http://localhost:5173` (o `5174` en dev).
- Si falla dependencias, ejecuta de nuevo `npm install`.
- Si falla el frontend en producción, reconstruye con `npm run build`.
- Si el puerto está ocupado, cierra procesos `node` abiertos y vuelve a iniciar.

## Guía de uso

### Gestor de archivos
1. Ve a **Archivos** en el sidebar
2. Usa el desplegable de la derecha para cambiar entre almacenamiento interno y directorios vinculados
3. Arrastra archivos para subirlos, o usa el botón **Nuevo Archivo** / **Nueva Carpeta**
4. Haz **doble clic** en un archivo de texto para abrirlo en el editor
5. También puedes usar el menú contextual (icono ⋮) para descargar, editar, renombrar o eliminar

### Directorios vinculados
1. Ve a **Directorios** en el sidebar
2. Haz clic en **Vincular Directorio**
3. Introduce un nombre y la ruta completa (ej. `C:\Users\miusuario\Desktop\server`)
4. El directorio aparecerá en el gestor de archivos y podrá usarse para detectar servidores y bots

### Minecraft
1. Ve a **Minecraft** en el sidebar
2. Selecciona un directorio vinculado en el desplegable
3. Haz clic en **Escanear** para detectar servidores automáticamente
4. Selecciona un servidor para ver y editar `server.properties`
5. Las propiedades están agrupadas por categorías (Red, Mundo, Seguridad, Rendimiento, etc.)
6. Usa el botón **Aceptar EULA** si es necesario
7. Haz clic en **Guardar** para guardar los cambios

### Bots de Discord
1. Ve a **Bots Discord** en el sidebar
2. Para detectar bots automáticamente: selecciona un directorio vinculado y haz clic en **Escanear**
3. Para añadir manualmente: haz clic en **Añadir Bot**, introduce nombre, directorio, lenguaje y archivo principal
4. Usa los botones **Iniciar** / **Detener** / **Reiniciar** para controlar el proceso
5. Haz clic en el icono de terminal para ver los logs en tiempo real
6. Puedes configurar variables de entorno (ej. `DISCORD_TOKEN=tu_token`)

## Estructura del proyecto

```
LocalPanelELP/
├── server/                      # Backend (Express + Node.js)
│   ├── index.js                 # Servidor principal
│   ├── processes.js             # Gestión de procesos de bots
│   ├── routes/
│   │   ├── auth.js              # Autenticación
│   │   ├── files.js             # API de archivos (listar, leer, guardar...)
│   │   ├── minecraft.js         # Detección y config de Minecraft
│   │   ├── bots.js              # Gestión de bots de Discord
│   │   └── linked.js            # Directorios vinculados
│   ├── middleware/
│   │   └── auth.js              # Middleware de autenticación
│   └── config/
│       └── stores.js            # Persistencia de config (bots, dirs)
├── src/                         # Frontend (React + Tailwind)
│   ├── App.jsx
│   ├── api.js
│   ├── main.jsx
│   ├── index.css
│   └── components/
│       ├── Login.jsx
│       ├── Layout.jsx
│       ├── Dashboard.jsx
│       ├── FileBrowser.jsx
│       ├── FileEditor.jsx       # Editor de archivos
│       ├── FileIcon.jsx
│       ├── UploadZone.jsx
│       ├── Settings.jsx
│       ├── MinecraftPanel.jsx   # Panel de configuración Minecraft
│       ├── BotManager.jsx       # Gestor de bots de Discord
│       └── LinkedDirs.jsx       # Directorios vinculados
├── storage/                     # Archivos almacenados
├── config/                      # Configuración (auth.json, bots.json, linked-dirs.json)
├── public/                      # Archivos estáticos
├── start.bat                    # Script de inicio para Windows
├── dev.bat                      # Script de desarrollo
├── package.json
├── vite.config.js
├── tailwind.config.js
└── index.html
```

## API Endpoints

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET | `/api/auth/check` | Verificar sesión |
| POST | `/api/auth/change-password` | Cambiar contraseña |

### Archivos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/files/list?path=&mount=` | Listar archivos |
| GET | `/api/files/read?path=&mount=` | Leer contenido de archivo |
| POST | `/api/files/save` | Guardar contenido de archivo |
| POST | `/api/files/create-file` | Crear archivo nuevo |
| POST | `/api/files/upload` | Subir archivos |
| GET | `/api/files/download?path=&mount=` | Descargar archivo |
| POST | `/api/files/mkdir` | Crear carpeta |
| POST | `/api/files/rename` | Renombrar |
| POST | `/api/files/delete` | Eliminar |
| POST | `/api/files/move` | Mover |
| GET | `/api/files/stats` | Estadísticas |
| GET | `/api/files/search?q=&mount=` | Buscar |
| POST | `/api/files/extract` | Extraer archivo comprimido |

### Directorios vinculados
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/linked` | Listar directorios |
| POST | `/api/linked` | Vincular directorio |
| DELETE | `/api/linked/:id` | Desvincular |

### Minecraft
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/minecraft/detect?mount=` | Detectar servidores |
| GET | `/api/minecraft/server-properties?path=` | Obtener properties |
| POST | `/api/minecraft/server-properties` | Guardar properties |
| POST | `/api/minecraft/accept-eula` | Aceptar EULA |
| GET | `/api/minecraft/property-meta` | Metadatos de properties |
| GET | `/api/minecraft/network-status?path=` | Estado de red/TCP |
| POST | `/api/minecraft/network-optimize` | Optimizar red para tunnel |

### Bots de Discord
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/bots` | Listar bots |
| POST | `/api/bots` | Crear bot |
| PUT | `/api/bots/:id` | Actualizar bot |
| DELETE | `/api/bots/:id` | Eliminar bot |
| POST | `/api/bots/:id/start` | Iniciar bot |
| POST | `/api/bots/:id/stop` | Detener bot |
| POST | `/api/bots/:id/restart` | Reiniciar bot |
| POST | `/api/bots/:id/install` | Instalar dependencias |
| GET | `/api/bots/:id/logs?lines=` | Ver logs |
| GET | `/api/bots/:id/status` | Estado del bot |
| GET | `/api/bots/detect?mount=` | Detectar bots |
| GET | `/api/bots/languages` | Lenguajes soportados |
| GET | `/api/bots/python-versions` | Detectar versiones de Python |

## Puertos

- **Producción:** `http://localhost:5173` (servidor único)
- **Desarrollo frontend:** `http://localhost:5174`
- **Desarrollo backend:** `http://localhost:5173`

## Contribuidores

- **ELP-Studios**

---

*LocalPanelELP © ELP Studios 2026*
