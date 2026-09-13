# Plataforma de Streaming de Video

Proyecto académico de una plataforma de streaming de video (Node.js/Express + PostgreSQL en el backend, React + Vite en el frontend).

**Autores:** Juan Martínez · Cristian Rueda

---

## Requisitos previos

Instalar antes de clonar el proyecto:

- **Node.js** y **npm**
- **PostgreSQL**
- **Git**
- **pgAdmin** (opcional, para administrar la base de datos gráficamente)

Verificar que quedaron instalados correctamente:

```bash
node --version
npm --version
psql --version
git --version
```

Si cada comando devuelve un número de versión, todo está listo para continuar.

---

## 1. Clonar el proyecto

```bash
git clone -b Codigo_Parcial1 https://github.com/DavidA-go/Proyecto-Plataforma-de-Streaming-de-Video-.git
cd Proyecto-Plataforma-de-Streaming-de-Video-
```

Verificar que quedó en la rama correcta:

```bash
git branch --show-current
```

Debe mostrar `Codigo_Parcial1`.

---

## 2. Crear la base de datos en PostgreSQL

Con PostgreSQL instalado y corriendo, crear una base de datos llamada `login_solid`.

**Opción A — con pgAdmin:** Databases → clic derecho → Create → Database → nombre `login_solid` → Save.

**Opción B — con SQL:**
```sql
CREATE DATABASE login_solid;
```

Luego ejecutar los scripts de la carpeta `backend/db/` (por ejemplo `migration_add_plan.sql`) sobre esa base de datos, ya sea desde el **Query Tool** de pgAdmin o con `psql`:

```bash
psql -U postgres -d login_solid -f backend/db/migration_add_plan.sql
```

---

## 3. Crear el archivo `.env` del backend

El archivo `backend/.env` no viene en GitHub (contiene datos privados de conexión). Crearlo manualmente en:

```
backend/.env
```

Con este contenido, reemplazando `SU_CONTRASEÑA` por la contraseña real del usuario `postgres`:

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=login_solid
DB_PASSWORD=SU_CONTRASEÑA
DB_PORT=5432
```

> No subir este archivo a GitHub.

---

## 4. Instalar dependencias y ejecutar el Backend

En una terminal, desde la carpeta principal del proyecto:

```bash
cd backend
npm install
node index.js
```

Dejar esta terminal abierta mientras se usa la aplicación.

---

## 5. Instalar dependencias y ejecutar el Frontend

Abrir una **segunda terminal**, desde la carpeta principal del proyecto:

```bash
npm install
npm run dev
```

---

## 6. Abrir la aplicación

Abrir en el navegador la dirección que muestra la terminal del frontend:

```
http://localhost:5173
```

---

## Notas

- Las carpetas `node_modules/`, `dist/`, y los archivos `.env` no están incluidos en el repositorio (por seguridad y tamaño); por eso es necesario correr `npm install` y crear el `.env` manualmente después de clonar.
- El backend debe quedar corriendo en `http://localhost:5000` y el frontend en `http://localhost:5173`; ambas terminales deben permanecer abiertas al mismo tiempo para que la aplicación funcione.
