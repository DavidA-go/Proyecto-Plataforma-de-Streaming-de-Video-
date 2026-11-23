# Contenido real (video de verdad) y los patrones que lo hacen posible

Hasta ahora el catálogo era una maqueta: los manifiestos apuntaban a un CDN inventado y no había nada que reproducir. Ahora un título puede tener **archivos MP4 reales** y el Dashboard los reproduce con un `<video>`. Lo importante es que **no se reescribió nada de lo que ya existía**: cada pieza nueva se enchufa en un patrón ya presente.

## Cómo se agrega una película (sin tocar código)

### Forma fácil: un comando

```
cd backend
npm run agregar:video -- "C:\Descargas\Big_Buck_Bunny.mp4" --titulo "Big Buck Bunny" --generos animacion,comedia,familiar --autor "Blender Foundation" --licencia "CC-BY 3.0" --url https://peach.blender.org
```

El comando lee el MP4 (duración, resolución y códec), crea `backend/media/<id>/`, copia el video con el nombre de su resolución, escribe el `meta.json` y, **si tienes ffmpeg instalado**, crea la versión 360p (para los planes Free y Básico) y deja el índice del MP4 al inicio (para poder adelantar). Luego reinicia el backend. Opciones: `--id`, `--tipo pelicula|documental`, `--sin-360`, `--reemplazar`. Avisa si el video usa un códec que muchos navegadores no reproducen (HEVC/H.265, AV1…): en ese caso conviértelo con `ffmpeg -i entrada.mkv -c:v libx264 -c:a aac -movflags +faststart salida.mp4`. Solo se aceptan archivos `.mp4`.

Úsalo solo con videos que tengas derecho a usar (propios, Creative Commons o dominio público).

### A mano

```
backend/media/<id>/meta.json      datos, créditos y lista de archivos
backend/media/<id>/720p.mp4       los archivos que declare el meta.json
backend/media/<id>/360p.mp4
```

```json
{
  "id": "spring", "tipo": "pelicula", "titulo": "Spring", "duracionMin": 8,
  "generos": ["animacion", "fantasia", "aventura"],
  "archivos": [ { "resolucion": "360p", "archivo": "360p.mp4" }, { "resolucion": "720p", "archivo": "720p.mp4" } ],
  "creditos": { "autor": "Blender Studio", "licencia": "CC-BY 4.0", "url": "https://studio.blender.org/films/spring/" }
}
```

Reglas: la duración REAL se lee de la cabecera del MP4 al arrancar (`Mp4Info.js`, sin ffmpeg); `duracionMin` del `meta.json` solo es el respaldo si el archivo no se puede leer. El `id` debe ser igual al nombre de la carpeta; `tipo` es `pelicula` o `documental`; las resoluciones válidas son `360p`, `480p`, `720p`, `1080p`. Reinicia el backend y aparece en **Catálogo → Contenido abierto**. Si falta un archivo o el `meta.json` está mal, ese título se omite con una advertencia y todo lo demás arranca igual.

## Dónde entra cada patrón

| Patrón | Dónde | Qué resuelve |
|---|---|---|
| **Factory Method** | `catalog/media/ContenidoFactory.js` | Al leer datos de disco ya no se sabe qué clase instanciar: el campo `tipo` decide. Es el único `new` de las hojas leídas de `media/` (igual que `PlanFactory` con los planes). |
| **Null Object** | `catalog/media/FuenteSimulada.js` | Los títulos de ejemplo (sin archivo) usan una fuente "vacía" con el comportamiento de siempre. Así el catálogo nunca pregunta `if (tieneVideo)`. |
| **Template Method** | `FuenteMedia.calidades(techo)` | El esqueleto (ordenar y recortar al techo del plan) es fijo; cada fuente solo aporta `todasLasCalidades()`. |
| **Bridge** | `streaming/MP4Protocol.js` | Un implementor nuevo: descarga progresiva de MP4. **No se modificó** `StreamDelivery`, `VODDelivery`, `LiveDelivery`, `HLSProtocol` ni `DASHProtocol`. |
| **Registro de protocolos** | `streaming/crearProtocolo.js` | Mismo estilo que `crearVisitante`/`crearEstrategia`: agregar un protocolo = una clase + una línea. `elegirProtocolo()` decide por título (`auto`). |
| **Composite** | `ElementoContenido.asignarFuente()/getFuente()` | Un título real es una hoja más; su único rasgo propio es la fuente. La colección "Contenido abierto" es un `Coleccion` normal. |
| **Proxy de protección** | `proxy/MediaProxy.js` + `services/MediaServicio.js` | Protege `GET /media/...`. Verifica el ticket firmado **y que su sesión DRM siga vigente**, registra en `AccesoLog` y solo entonces ejecuta el servicio real. |
| **Facade (DRM)** | `DRMFacade.sesionVigente()` / `latido()` | Ahora la fachada también responde "¿sigue viva esta licencia?". La entrega y el MediaProxy hablan solo con ella, nunca con `SesionesRegistry`. |
| **Decorator + Observer (DRM)** | `LimiteDispositivosDecorator`, `ObservadorPlanDRM` | Dejan de ser decorativos: la pantalla que abre el límite de dispositivos es la que **mantiene vivo** el video, y si el Observer la libera al bajar de plan, el video se corta. |
| **Flyweight** | `CalidadVideoFactory` | Las calidades de los manifiestos reales (360p, 720p) son las mismas instancias compartidas que usa todo el sistema. |
| **Builder** | `StreamManifestBuilder` | Sigue armando el manifiesto; ahora con las calidades reales y `adaptativo = true` cuando hay más de una. |

## Flujo al pulsar ▶ en un título real

1. **Facade (DRM)**: `POST /api/stream/autorizar` valida plan, región y pantallas, y abre una **sesión DRM** (la "pantalla en uso"). Devuelve la licencia con su `sesionId`.
2. **Bridge**: `POST /api/stream/entrega` con `protocolo: "auto"` y ese `sesionId`. Para cada título se elige el protocolo que su fuente soporta: `mp4` si es real, `hls` si es de demostración.
3. **Licencia obligatoria**: para un video real la entrega exige que la sesión siga vigente, sea del mismo usuario y cubra ese título. Si no, responde `403` con un código (`SIN_LICENCIA`, `SESION_EXPIRADA`, `LICENCIA_OTRO_CONTENIDO`) y **no emite ticket**. Los títulos de demostración no lo exigen.
4. **Plan → calidades**: el plan del usuario recorta las calidades *reales* (Free 480p → solo 360p; Básico 720p y Premium → 360p y 720p). Los títulos simulados no cambian.
5. **Ticket**: cada URL de video real lleva `?ticket=…`, una firma HMAC de *(usuario, título, sesión DRM, vencimiento)*. Dura 4 h como máximo (`MEDIA_TICKET_MIN`), pero solo sirve mientras su sesión viva.
6. El navegador pide `GET /media/spring/720p.mp4?ticket=…`; el **MediaProxy** valida el ticket y la sesión y `res.sendFile` responde con soporte `Range` (adelantar/retroceder sin bajar todo). Cada petición válida renueva la sesión.
7. Mientras el video avanza, el reproductor manda un **latido** (`POST /api/stream/latido`) cada 60 s. Si la respuesta es `{ vigente: false }`, pausa el video y avisa.
8. Al arrancar el video se registra el título en el **historial de visualización**, que alimenta la estrategia de recomendación por historial (Strategy + Template Method).

### Qué corta el video

| Evento | Efecto |
|---|---|
| Que **venza la licencia** (1440 min Premium/Familiar, según el proveedor y el plan) | La sesión muere aunque haya actividad; el ticket nunca dura más que la licencia. |
| Pulsar **■ Detener** (o cerrar sesión) | La sesión se libera: el ticket deja de servir **al instante**. |
| Bajar de plan con menos pantallas (Observer) | Se liberan las sesiones más antiguas: ese video se corta en la siguiente petición o latido. |
| Cerrar la pestaña / perder la conexión | Sin latidos, la sesión vence a los 10 min y libera la pantalla. |
| Abrir otro título en el mismo dispositivo | La sesión anterior se reemplaza (un dispositivo = una pantalla). |

## Por qué un ticket y no el token de sesión

El `<video>` del navegador **no puede enviar** la cabecera `Authorization`. Poner el token de sesión (12 h, da acceso a toda la cuenta) en una URL lo dejaría en historiales y logs. El ticket es mucho menos peligroso: sirve solo para *ese* título, está ligado a *una* sesión DRM que se puede liberar, y está firmado con otra clave, así que **no vale como sesión** ni una sesión vale como ticket (ver `TokenService`). Estar logueado tampoco basta: sin ticket (es decir, sin licencia) `/media` responde 403.

## Seguridad de los archivos

- **Lista blanca**: solo se sirven los archivos declarados en el `meta.json` (`FuenteLocal.rutaAbsoluta`). `meta.json`, `../…` o cualquier otro nombre responde 404.
- Los nombres de archivo se validan (`^[\w.-]+\.mp4$`) al cargar.
- Cada acceso **denegado** queda en `AccesoLog`; de los permitidos solo se registra el primer tramo de cada reproducción (los cientos de peticiones `Range` no inundan la bitácora).

## Qué es real y qué sigue simulado en el panel del Dashboard

| Línea del panel | Estado | Detalle |
|---|---|---|
| Calidades, protocolo MP4, duración del título | **Real** | Archivos en disco; la duración sale de la cabecera del MP4 (7m 44s). |
| Pantallas en uso | **Real** | Una sesión DRM por dispositivo; si se libera, el video se corta. |
| Duración de la licencia | **Real** | La sesión y el ticket vencen con ella (el panel muestra a qué hora). |
| Descarga offline | **Real** | = lo que permita la licencia **y** el plan (Free no, Premium sí). Habilita `GET /media/…?descargar=1` (`Content-Disposition: attachment`); sin permiso responde 403. |
| Id de licencia | **Real como llave** | La entrega comprueba que el id corresponda a la sesión; el texto en sí lo genera el servidor, no un servidor de licencias externo. |
| Región | **Real, decidida por el servidor** | Ya no se manda desde el navegador: se toma de una cabecera del CDN (`GEO_CABECERA_PAIS`) o de `PAIS_POR_DEFECTO`. Sin cabecera configurada ni país válido → `XX` (denegado). |
| Auditoría (AUD-n) | **Real, en memoria** | Se pierde al reiniciar. |
| Proveedor DRM (Widevine / PlayReady) | **Simulado** | Clases de demostración (Adapter) con respuestas fijas; no hay cifrado. |

### Variables de entorno (`backend/.env`, todas opcionales)

| Variable | Por defecto | Para qué |
|---|---|---|
| `MEDIA_BASE_URL` | `http://localhost:5000` | Origen público del backend (va dentro de las URLs del manifiesto). |
| `MEDIA_DIR` | `backend/media` | Carpeta de los videos. |
| `MEDIA_TICKET_MIN` | 240 | Vigencia del ticket **solo** si la sesión no tiene vencimiento de licencia. |
| `PAIS_POR_DEFECTO` | `CO` | País del servidor (en local la IP es 127.0.0.1 y no tiene país). |
| `GEO_CABECERA_PAIS` | (vacío) | Cabecera que pone tu CDN/proxy de confianza: `cf-ipcountry` (Cloudflare), `x-vercel-ip-country`, `cloudfront-viewer-country`. Solo actívala si de verdad estás detrás de ese proxy: si no, un cliente podría falsificarla. |

## Limitaciones conocidas

- **El video no está cifrado.** Lo que es real es el *control de acceso* (licencia vigente, vencimiento, plan, pantallas, región, descarga), no el cifrado del archivo. Cualquier video que un navegador reproduce, el navegador lo recibe completo, y sin cifrado puede guardarse (la herramienta de red del navegador, una extensión, grabar la pantalla…): el permiso de "descarga offline" controla el botón y el endpoint, **no puede impedir** que alguien guarde lo que ya está viendo. Un DRM de verdad exige contenido cifrado (CENC) empaquetado con Shaka Packager/Bento4, un reproductor con EME (Shaka Player) y un servidor de licencias (Widevine/PlayReady vía un proveedor como EZDRM, BuyDRM o Axinom). Ver "Siguiente paso" abajo.
- **La región depende de quien envíe el país**: en local es solo una configuración (no hay IP pública que geolocalizar); en producción solo es confiable detrás de un CDN que ponga la cabecera. Una geolocalización por IP propia requiere una base de datos como MaxMind GeoLite2 (requiere cuenta/licencia).
- Solo hay descarga progresiva MP4 (una o varias calidades que el usuario elige). No hay cambio automático de calidad por red: eso requeriría HLS/DASH reales (segmentos `.ts`/`.m4s` y un reproductor como hls.js). Por eso el manifiesto marca `adaptativo: false` para MP4.
- Las sesiones y la bitácora viven en memoria: al reiniciar el backend se pierden y hay que volver a pulsar ▶.
- Los ejemplos de series y temporadas siguen siendo simulados; `ContenidoFactory` solo crea películas y documentales sueltos.

## Pruebas

```
cd backend
npm run test:contenido     # 51 comprobaciones (Factory, MP4, comando agregar:video, Bridge, ticket, licencia, vencimiento, offline, región, latido, Proxy y HTTP con Range)
npm run test:front         # (desde la raíz) 16 comprobaciones de las utilidades del Dashboard: catálogo → tarjetas, filtros, Mi lista y plan/perfil
```

Los tests anteriores siguen pasando; dos de ellos (`test:comportamiento`, `test:observer-state-visitor`) contaban exactamente los títulos del catálogo y se ajustaron para sumar Spring cuando está presente.

## Siguiente paso si quieres cifrado de verdad

Sin comprar nada se puede probar el mecanismo real de EME con **Clear Key** (lo soportan Chrome y Firefox): el MP4 se cifra con CENC (`ffmpeg -encryption_scheme cenc-aes-ctr …`), se empaqueta como MP4 fragmentado, y el reproductor (Shaka Player) pide la clave a un endpoint del backend que solo la entrega si el ticket y la sesión DRM siguen vigentes. Es una demostración legítima del flujo, aunque Clear Key entrega la clave "en claro" al navegador (no es resistente a un usuario decidido). La protección fuerte (Widevine L1/L3, PlayReady) exige un proveedor de licencias comercial.

## Dashboard: menú, Mi lista y perfil

- **Inicio, Series, Películas y Mi lista** (menú superior) funcionan: las tarjetas salen del catálogo real (`GET /api/catalogo`, aplanado por `src/titulos.js`), ya no de una lista fija. Inicio muestra «Con video real», «Continuar viendo» (historial), «Recomendado para ti» (`GET /api/recomendaciones`: Template Method + Strategy) y las filas de series, películas y documentales. Series y Películas tienen filtro por género.
- **Mi lista**: el botón **+** de cada tarjeta agrega o quita el título. Se guarda en el navegador (`localStorage`), una lista por usuario: sobrevive a recargar y a reiniciar el backend, pero no viaja a otros equipos.
- **Plan y perfil son cosas distintas.** El *plan* (Free, Básico, Premium, Familiar) es la suscripción. El *perfil de recomendación* son los gustos (géneros, tipo de contenido, peso del historial). Lo único que los une: la primera vez, el plan *sugiere* la plantilla con la que se clona el perfil (Prototype) y queda guardado (Memento). Después el perfil es de la persona y **no cambia si cambia de plan**. La tarjeta «Tu perfil de recomendación» del Dashboard y la pestaña Memento muestran ahora el mismo perfil.
