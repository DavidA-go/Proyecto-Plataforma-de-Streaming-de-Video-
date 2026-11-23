# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Contenido real (video)

Los títulos con video de verdad viven en `backend/media/<id>/` (un `meta.json` + los `.mp4`). Se cargan al arrancar el backend y aparecen en **Catálogo → Contenido abierto**. Incluye *Spring* (© Blender Foundation, CC-BY 4.0).

Para agregar otro título, la explicación de cada patrón y el flujo completo, ver [`PATRONES_CONTENIDO_REAL.md`](./PATRONES_CONTENIDO_REAL.md). Variables opcionales en `backend/.env`: `MEDIA_BASE_URL`, `MEDIA_DIR`, `MEDIA_TICKET_MIN`, `PAIS_POR_DEFECTO` y `GEO_CABECERA_PAIS` (descritas en ese documento, junto con qué partes del DRM son reales y cuáles siguen simuladas).

Para agregar una película: `cd backend` y `npm run agregar:video -- "ruta\pelicula.mp4" --titulo "Mi película" --generos accion,drama` (ver `PATRONES_CONTENIDO_REAL.md`).
