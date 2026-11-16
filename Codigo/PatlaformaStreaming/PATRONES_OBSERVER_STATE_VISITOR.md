# Patrones de comportamiento: Observer, State y Visitor

Complementan a Iterator, Mediator, Memento, Chain y Command (ver `PATRONES_COMPORTAMIENTO.md`).
Cada patrón está en el subservicio donde resuelve un problema que **ya existía**:

| Patrón | Subservicio | Problema que resuelve |
|---|---|---|
| **Observer** | Suscripciones (+ reacciones en DRM y Streaming) | Al cambiar de plan, el usuario conservaba sus pantallas DRM y la calidad del plan anterior hasta que expiraban. |
| **State** | Streaming adaptativo (`streaming/state/`) | El estado del reproductor era un string con `if`s repartidos en el mediador y nada impedía transiciones absurdas (pausar un video detenido). |
| **Visitor** | Gestión de contenido (`catalog/visitor/`) | El catálogo es un Composite; cada reporte nuevo obligaba a añadir métodos a las 6 clases de nodos. |

---

## 1. Observer — un cambio de plan avisa a quien le interese

| Rol | Clase |
|---|---|
| Subject | `SujetoPlan` (lo usa `SuscripcionServicio.cambiarPlan()`) |
| Observer (interfaz) | `Observador` |
| Observadores concretos | `ObservadorPlanDRM` (`drm/`), `ObservadorPlanStreaming` (`streaming/`), `ObservadorNotificacion` |
| Cableado | `subscription/observer/registrarObservadores.js`, invocado desde `ServiciosProxy.js` |

- La suscripción **no importa ni conoce** a ningún observador; para que otro subservicio reaccione basta una línea en `registrarObservadores.js`.
- **DRM**: libera las sesiones más antiguas que excedan las pantallas del plan nuevo y deja `REVOCADA / CAMBIO_DE_PLAN` en la auditoría.
- **Streaming**: cada sesión abierta recibe el techo nuevo. Si baja, la calidad baja al instante; si sube, la calidad **no salta**: sube de a un escalón con buffer suficiente (reglas del Mediator).
- **Aislamiento**: si un observador falla, los demás se enteran y el cambio de plan no se revierte (queda `ERROR` en la traza).
- El evento llega congelado (`Object.freeze`): un observador no puede alterar lo que verán los demás.
- Solo se notifica si el plan realmente cambió. Como el *deshacer* del Command pasa por el mismo método, **deshacer también notifica**.

| Endpoint | Qué hace |
|---|---|
| `GET /api/usuarios/:id/plan/eventos` | Observadores suscritos y últimas notificaciones con la traza de lo que hizo cada uno (mismos permisos que ver el plan). |

## 2. State — el estado del reproductor como objetos

| Rol | Clase |
|---|---|
| Context | `ControlReproduccion` |
| State (interfaz) | `EstadoReproduccion` |
| Estados concretos | `EstadoDetenido`, `EstadoCargando`, `EstadoReproduciendo`, `EstadoPausado` |

Colabora con el **Mediator**: el mediador decide *cuándo* ocurre algo; el estado actual decide *qué significa* y a cuál pasa. Los estados no guardan datos, así que hay una sola instancia compartida.

| Estado | reproducir | pausar | buffer vacío | buffer recuperado | fin |
|---|---|---|---|---|---|
| detenido | → cargando / reproduciendo | *ignorada* | – | – | – |
| cargando | *ignorada* | → pausado | – | → reproduciendo | – |
| reproduciendo | *ignorada* | → pausado | → cargando | – | → detenido |
| pausado | → cargando / reproduciendo | *ignorada* | – | – (no reanuda solo) | – |

- Las acciones del usuario que el estado no admite se **ignoran y quedan anotadas** (`TRANSICION_IGNORADA`); cada cambio queda como `ESTADO_CAMBIO {de, a, motivo}`.
- `GET /api/stream/sesion/:id` y las acciones devuelven ahora `reproduccion.accionesPermitidas`.
- Dar PLAY a un video terminado lo reinicia: es un salto al segundo 0, con la misma regla del mediador que `buscar` (buffer vacío, calidad más baja).

## 3. Visitor — reportes sobre el catálogo

| Rol | Clase |
|---|---|
| Visitor | `VisitanteContenido` |
| Visitantes concretos | `VisitanteEstadisticas`, `VisitanteAlmacenamiento` (usa los bitrates del Flyweight), `VisitanteExportadorCSV` |
| Element | `ElementoContenido.aceptar(visitante)` — implementado en cada nodo (doble despacho) |

Los nodos solo añadieron `aceptar()`. Agregar un reporte nuevo = una clase visitante registrada en `catalog/visitor/crearVisitante.js`.

| Endpoint | Qué hace |
|---|---|
| `GET /api/catalogo/:id/reporte?visitante=estadisticas\|almacenamiento\|csv&calidades=720p,1080p` | Reporte sobre el nodo `:id` (`catalogo` = todo). `calidades` solo aplica a `almacenamiento`. |

---

## Cómo ver que funcionan (sin PostgreSQL)

```bash
cd backend
npm run test:observer-state-visitor   # 76 comprobaciones (unitarias + HTTP extremo a extremo)
npm run test:observer                 # o :state / :visitor por separado
npm run demo:observer-state-visitor   # consola paso a paso + cuadro de validación ✔/✘
VERBOSE=1 npm run test:observer       # además, los logs internos de los patrones
```

- **Consola**: los patrones imprimen `👁️ [Observer]`, `🚦 [State]` y `🧳 [Visitor]` también cuando corre el servidor.
- **Dashboard**: botón **🧪 Validar patrones de comportamiento** → pestañas **Observer, State y Visitor**, cada una con prueba interactiva y **▶ Ejecutar verificación automática** (Observer 8 · State 10 · Visitor 12 comprobaciones). **▶ Verificar los 8 patrones** corre todas. La verificación de Observer cambia tu plan y lo deja como estaba.

## Archivos

**Nuevos**: `backend/subscription/observer/*` (5) · `backend/drm/ObservadorPlanDRM.js` · `backend/streaming/ObservadorPlanStreaming.js` · `backend/streaming/state/*` (6) · `backend/catalog/visitor/*` (5) · `backend/test-observer-state-visitor.js` · `backend/demo-observer-state-visitor.js` · este documento.

**Modificados**: `services/{Suscripcion,Catalogo}Servicio.js`, `proxy/{Suscripcion,Catalogo}Proxy.js`, `proxy/ServiciosProxy.js`, `drm/SesionesRegistry.js`, `streaming/mediator/{ControlReproduccion,SesionReproduccion,SelectorCalidad,RegistroSesiones}.js`, `catalog/{ElementoContenido,Pelicula,Documental,Episodio,Serie,Temporada,Coleccion}.js`, `index.js` (2 rutas), `package.json` (raíz y backend), `src/patronesChecks.js`, `src/components/PatronesComportamiento.jsx`, `src/components/Dashboard.jsx`, `src/index.css`.
