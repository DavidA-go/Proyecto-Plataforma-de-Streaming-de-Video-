# Patrones de comportamiento: Iterator, Mediator y Memento

Cada patrón se colocó en el **subservicio donde resuelve un problema que ya existía**, no donde "cabía":

| Patrón | Subservicio | Por qué ahí |
|---|---|---|
| **Iterator** | Gestión de contenido (`catalog/`) | El catálogo ya es un árbol Composite (colección → serie → temporada → episodio). Recorrerlo (paginar, "siguiente episodio", filtrar) obligaba a conocer su estructura. |
| **Mediator** | Streaming adaptativo (`streaming/mediator/`) | Un reproductor adaptativo tiene piezas que dependen unas de otras (red, calidad, buffer, play/pausa, pistas). Es el caso clásico de objetos que se coordinan entre sí. |
| **Memento** | Sistema de recomendación (`recommendation/memento/`) | El perfil de recomendación ya se clona desde plantillas (Prototype) y ahora el usuario lo edita; necesita deshacer/rehacer sin exponer su estado interno. |

Los tres cuelgan de la arquitectura existente: llegan por `ServiciosProxy` (Proxy de protección + roles Flyweight), así que **respetan los mismos permisos y quedan en el log de accesos**.

---

## 1. Iterator — recorrer el catálogo

| Rol | Clase |
|---|---|
| Iterator (interfaz + lógica común) | `IteradorContenido` |
| Iteradores concretos | `IteradorProfundidad`, `IteradorAnchura`, `IteradorReproducibles` |
| Aggregate | `ElementoContenido.crearIterador(orden, predicado)` (hojas y grupos) |
| Cliente | `CatalogoServicio.recorrer()` / `.siguiente()` y `StreamingServicio.crearSesion()` |

```js
const it = serie.crearIterador('profundidad', (n) => n.tipo() === 'episodio');
while (it.hasNext()) { const nodo = it.next(); /* it.nivel = profundidad en el árbol */ }
for (const nodo of serie.crearIterador('anchura')) { ... }   // también funciona con for...of
```

- **Perezoso**: no aplana el árbol; cada `next()` avanza lo justo (la página 1 no recorre todo el catálogo).
- **Pila/cola explícita** en vez de recursión: no se desborda con árboles hondos.
- `IteradorReproducibles` **reutiliza** el de profundidad y solo añade "es hoja" (`esReproducible()`).
- Cambios mínimos al Composite: `getHijos()`, `esReproducible()` y `crearIterador()`.

| Endpoint | Qué hace |
|---|---|
| `GET /api/catalogo/:id/recorrer?orden=profundidad\|anchura\|reproducibles&genero=&tipo=&desde=0&limite=20` | Recorrido paginado. `siguiente` en la respuesta es el `desde` de la página siguiente (`null` si no hay más). |
| `GET /api/catalogo/:id/siguiente` | Siguiente reproducible en el orden del catálogo (autoplay). Desde una serie, parte de su último episodio. |

---

## 2. Mediator — sesión de reproducción adaptativa

Sin mediador, 5 piezas se conocerían entre sí. Con él, **cada una solo conoce al mediador** (hay una prueba automática que lo verifica).

| Rol | Clase |
|---|---|
| Mediator (interfaz) | `MediadorReproduccion` |
| Mediator concreto | `SesionReproduccion` (todas las reglas en `notificar()`) |
| Colleague (base) | `ComponenteReproductor` |
| Colleagues | `MonitorRed`, `SelectorCalidad`, `BufferReproduccion`, `ControlReproduccion`, `ControlPistas` |

Reglas que coordina el mediador:

| Evento (quién avisa) | Qué decide el mediador |
|---|---|
| `RED_CAMBIO` (MonitorRed) | Baja de calidad al instante; **sube de a un escalón y solo con ≥ 10 s de buffer** (si no, anota `SUBIDA_POSPUESTA` y reintenta al avanzar el tiempo). |
| `BUFFER_BAJO` (Buffer < 5 s) | Baja un escalón de calidad. |
| `BUFFER_VACIO` (Buffer = 0) | Si se reproducía, pasa a `cargando`. |
| `BUFFER_RECUPERADO` (Buffer ≥ 8 s) | Si el usuario quería reproducir, **reanuda solo**. |
| `BUSCAR` (Control) | Mueve la posición, vacía el buffer y arranca en la calidad más baja (inicio rápido); la ABR vuelve a subir. |
| `PISTA_CAMBIO` (audio) | Descarta el audio ya descargado (recorta el buffer a 6 s). Los subtítulos no tocan el buffer. |
| `FIN_CONTENIDO` | Pasa a `detenido`. |

Colaboraciones con lo que ya existía:
- **Factory Method (planes)**: el techo de calidad sale del plan del usuario (Free 480p · Básico 720p · Premium/Familiar 1080p).
- **Flyweight**: `SelectorCalidad` usa `CalidadVideoFactory` (las calidades son las mismas instancias compartidas).
- **Iterator**: si `contenidoId` es una serie o colección, se reproduce su primer episodio.
- **Proxy**: el dueño de la sesión es siempre el usuario autenticado; la sesión de otro responde 404.

| Endpoint | Qué hace |
|---|---|
| `POST /api/stream/sesion` `{contenidoId, anchoBandaKbps?}` | Crea la sesión (201). |
| `POST /api/stream/sesion/:id/accion` `{accion, valor?}` | `reproducir`, `pausar`, `buscar` (seg), `red` (kbps), `avanzar` (seg simulados), `audio` (es/en), `subtitulo` (es/en/ninguno). Devuelve el estado **y los eventos que el mediador procesó en esa acción**. |
| `GET /api/stream/sesion/:id` | Estado actual y últimos eventos. |
| `DELETE /api/stream/sesion/:id` | Cierra la sesión. |

> `avanzar` simula el paso del tiempo (no hay reproductor real en el backend): la red descarga video y, si se está reproduciendo, se consume buffer. Las sesiones viven en memoria (tope de 500).

---

## 3. Memento — perfil de recomendación con historial

| Rol | Clase |
|---|---|
| Originator | `PerfilRecomendacion` (`crearMemento()`, `restaurar()`, `actualizar()`) |
| Memento | `PerfilMemento` (foto **inmutable**: copia profunda + `Object.freeze`) |
| Caretaker | `HistorialPerfil` (pilas deshacer/rehacer, tope de 20, volver a una versión) |
| Almacén | `PerfilesUsuarioStore` (perfil + historial por usuario, en memoria) |

- El cuidador **solo guarda y devuelve** mementos; el único que lee su contenido es el originador.
- Antes de cada edición se toma un memento; **si la edición falla, el perfil se restaura con ese mismo memento** (rollback). Un cambio que no cambia nada no ensucia el historial.
- Un cambio nuevo descarta lo que se podía "rehacer" (como un editor de texto).
- Con **Prototype**: el perfil se crea clonando una plantilla del registro y editarlo nunca contamina la plantilla (hay prueba).

| Endpoint | Qué hace |
|---|---|
| `GET /api/recomendaciones/mi-perfil` | Perfil actual + versiones guardadas (404 si aún no tiene). |
| `PUT /api/recomendaciones/mi-perfil` | Crea (`categoriaBase`, 201) o modifica: `categoriaBase` (reemplaza por la plantilla), `generosAdicionales`, `generosFavoritos`, `tipoContenidoPreferido` (pelicula/serie/mixto), `pesoHistorial` (0–1). |
| `POST .../mi-perfil/deshacer` · `.../rehacer` | Recorre el historial. |
| `POST .../mi-perfil/restaurar` `{version}` | Vuelve a la versión N de la lista `historial` (la restauración también se puede deshacer). |

Se añadió el permiso `recomendacion:personalizar` (roles `usuario` y `admin`); ver el perfil usa el `recomendacion:ver` de siempre.

---

## 4. Validación visible en el Dashboard

En el Dashboard, el botón **🧪 Validar patrones de comportamiento** abre un panel con una pestaña por patrón (**Iterator, Mediator, Memento, Chain y Command**). Cada pestaña tiene:

1. **Prueba interactiva** contra los endpoints reales: recorrer el catálogo por páginas y órdenes (Iterator), crear una sesión y mover red/buffer/pistas viendo los eventos que procesa el mediador (Mediator), editar el perfil con deshacer/rehacer/restaurar versión (Memento), validar un registro viendo por qué eslabón pasa o se corta (Chain) y cambiar/deshacer el plan con su historial (Command).
2. **Verificación automática** (`src/patronesChecks.js`): ejecuta un escenario completo y marca cada regla del patrón con ✔/✘ (Iterator 12 · Mediator 13 · Memento 8 · Chain 6 · Command 5). **▶ Verificar los 5 patrones** las corre todas y deja un resumen en las pestañas.

Las verificaciones de Memento y Command dejan los datos como estaban (restauran el peso del perfil y el plan del usuario).

Cambio de backend para el Chain: `POST /api/validar-registro` (público, igual que el registro) corre **la misma cadena** que `/api/register` pero **no crea ningún usuario**. Devuelve `{ valido, regla, message, status, eslabones: [{ regla, resultado: OK | RECHAZADA | OMITIDA }] }`. Para eso `ManejadorValidacion.manejar()` acepta una `traza` opcional y `CadenaRegistro.validar()` devuelve `eslabones`.

---

## Cómo probarlo (sin PostgreSQL)

```bash
cd backend
npm run test:comportamiento   # 57 comprobaciones: unitarias + HTTP de extremo a extremo
npm run demo:comportamiento   # salida de consola paso a paso de los 3 patrones
```

Las pruebas anteriores (`test:patrones`, `test:chain`, `test:command`) siguen pasando.

## Archivos nuevos / modificados

**Nuevos**: `backend/catalog/iterator/*` (5) · `backend/streaming/mediator/*` (9) · `backend/recommendation/memento/*` (3) · `backend/test-comportamiento.js` · `backend/demo-comportamiento.js` · este documento.

**Modificados**: `catalog/ElementoContenido.js`, `catalog/ContenidoCompuesto.js`, `recommendation/PerfilRecomendacion.js`, `services/{Catalogo,Streaming,Recomendacion}Servicio.js`, `proxy/{Catalogo,Streaming,Recomendacion}Proxy.js`, `flyweight/{Permisos,RolFlyweightFactory}.js`, `index.js` (rutas nuevas), `package.json` (raíz y backend: scripts).
