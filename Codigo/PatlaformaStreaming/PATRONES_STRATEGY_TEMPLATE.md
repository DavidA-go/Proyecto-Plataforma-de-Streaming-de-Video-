# Patrones Strategy y Template Method — Sistema de recomendación

## ¿Por qué en Recomendación?

Se evaluaron los seis subservicios (usuarios, suscripción, catálogo, streaming, DRM, recomendación) y los dos patrones encajan **juntos** en **Recomendación**, por tres razones:

1. **Es donde hay un problema real sin resolver.** Hasta ahora el subservicio solo creaba y editaba perfiles (Prototype + Memento): *nunca recomendaba nada* y el campo `pesoHistorial` del perfil no lo usaba nadie. Recomendar es justo un algoritmo con **variantes intercambiables** (Strategy) dentro de un **proceso con pasos fijos** (Template Method).
2. **Los demás subservicios ya tienen su patrón natural** y forzar estos dos ahí habría sido artificial: el catálogo ya usa Composite + Iterator + Visitor, el streaming Bridge + Builder + Mediator + State, el DRM Facade + Decorator + Adapter + Abstract Factory, y la suscripción Factory Method + Observer + Command. El protocolo HLS/DASH, por ejemplo, ya es un Bridge: convertirlo en Strategy sería repetir un patrón con otro nombre.
3. **Reutiliza lo que existe**: el perfil (`pesoHistorial`, géneros, tipo preferido), el Iterator del catálogo, el Proxy de protección con roles Flyweight y el log de accesos.

| Patrón | Dónde | Qué resuelve |
|---|---|---|
| **Strategy** | `recommendation/strategy/` | *Cómo se puntúa* un título para el usuario: por géneros, por historial o mezcla. Se elige en tiempo de ejecución. |
| **Template Method** | `recommendation/template/` | *Qué pasos sigue* toda recomendación (siempre los mismos, en el mismo orden) y qué pasos cambia cada tipo: para ti, similares, descubrir. |

Strategy usa **composición** (le pasas otro objeto) y Template Method usa **herencia** (sobrescribes pasos). Aquí colaboran: el paso fijo `puntuar()` del esqueleto delega en la estrategia elegida.

---

## 1. Strategy — algoritmos de puntuación

| Rol | Clase |
|---|---|
| Strategy (interfaz) | `EstrategiaPuntuacion` (`id()`, `descripcion()`, `puntuar(nodo, ctx)`) |
| Estrategias concretas | `PuntuacionPorGeneros`, `PuntuacionPorHistorial`, `PuntuacionHibrida` |
| Context | `GeneradorRecomendaciones` (paso `puntuar`; recibe la estrategia en `ctx.estrategia`) |
| Registro | `crearEstrategia(id)` — agregar un algoritmo = una clase + una línea |

| Estrategia | Puntaje (0..1) |
|---|---|
| `generos` | Fracción de los géneros del título que están entre los géneros de interés. |
| `historial` | Promedio de la afinidad con cada género del título, según lo que ya viste (el género más visto vale 1). Sin historial → 0. |
| `hibrida` *(por defecto)* | `(1 − peso)·generos + peso·historial`, con `peso = pesoHistorial` del perfil. **Sin historial el peso efectivo es 0.** |

`PuntuacionHibrida` recibe las otras dos por constructor: mismo contrato, otra mezcla.

## 2. Template Method — esqueleto de la recomendación

`GeneradorRecomendaciones.generar(ctx)` es el **método plantilla**. Es "final": el constructor lanza error si una subclase intenta sobrescribirlo (JavaScript no tiene `final`).

| # | Paso | Tipo | Qué hace |
|---|---|---|---|
| 1 | `prepararContexto` | fijo | Vistos, afinidad por género e historial vacío. |
| 1a | `definirGenerosInteres` | **gancho** | Géneros que importan (por defecto, los favoritos). |
| 2 | `obtenerCandidatos` | **abstracto** | De dónde salen los títulos. |
| 3 | `filtrar` | **gancho** | Por defecto quita lo ya visto. |
| 4 | `puntuar` | fijo | Delega en la **estrategia** (Strategy). |
| 5 | `puntajeMinimo` | **gancho** | Por defecto descarta puntaje 0 (sin relación). |
| 6 | `ordenar` · `limitar` | fijo | Mayor puntaje primero; empate por título. |
| 7 | `explicar` | **gancho** | El motivo de cada recomendación. |
| 8 | `alFinalizar` | **gancho** | Vacío por defecto (log, métricas…). |

| Subclase (`tipo`) | Qué redefine |
|---|---|
| `RecomendacionParaTi` (`para-ti`) | `obtenerCandidatos`: todo el catálogo (Iterator). `filtrar`: además de lo visto, respeta `tipoContenidoPreferido` (pelicula / serie / mixto). |
| `RecomendacionSimilares` (`similares`) | `definirGenerosInteres`: los géneros del título de referencia. `filtrar`: **permite** lo ya visto. `explicar`: "Parecido a X". |
| `RecomendacionDescubrir` (`descubrir`) | `definirGenerosInteres`: géneros que ya viste pero no son favoritos. `filtrar`: solo títulos con algún género fuera de los favoritos. |

Solo se recomiendan **títulos** (película, documental, serie), nunca episodios, temporadas ni colecciones.

---

## 3. Endpoints (todos requieren sesión y un perfil creado)

| Endpoint | Qué hace |
|---|---|
| `GET /api/recomendaciones?tipo=para-ti\|similares\|descubrir&estrategia=hibrida\|generos\|historial&contenidoId=&limite=5` | Genera la recomendación. `contenidoId` es obligatorio solo en `similares`. Devuelve `plantilla`, `estrategia`, los **`pasos`** del esqueleto con cuántos elementos quedaron en cada uno, y `recomendaciones` (`puntaje` + `motivo`). Límite 1–20. |
| `GET /api/recomendaciones/opciones` | Tipos y estrategias disponibles. |
| `GET · POST · DELETE /api/recomendaciones/historial` | Ver / marcar como visto (`{contenidoId}`) / borrar lo que **tú** viste. Solo títulos completos. |

Errores: 401 sin sesión · 404 sin perfil o contenido inexistente · 400 tipo/estrategia/límite inválido o `similares` sin `contenidoId`.

Pasan por `ServiciosProxy` (Proxy de protección + roles Flyweight) con los permisos que ya existían: ver/recomendar usa `recomendacion:ver`; marcar o borrar historial usa `recomendacion:personalizar`. Todo queda en el log de accesos, y el usuario es siempre el autenticado.

## 4. Archivos nuevos y modificados

```
backend/recommendation/strategy/        EstrategiaPuntuacion, PuntuacionPorGeneros, PuntuacionPorHistorial, PuntuacionHibrida, crearEstrategia
backend/recommendation/template/        GeneradorRecomendaciones, RecomendacionParaTi, RecomendacionSimilares, RecomendacionDescubrir, crearGenerador
backend/recommendation/HistorialVisualizacionStore.js   (nuevo: lo visto por usuario, en memoria)
backend/services/RecomendacionServicio.js  + recomendar(), opciones(), registrarVisto(), miHistorial(), limpiarMiHistorial()
backend/proxy/RecomendacionProxy.js        + los mismos métodos con sus permisos
backend/index.js                           + 4 rutas
backend/test-strategy-template.js · demo-strategy-template.js · package.json (scripts)
src/components/PatronesComportamiento.jsx  + pestañas Strategy y Template Method
src/patronesChecks.js                      + verificarStrategy (9) y verificarTemplate (13)
src/index.css                              + estilo de la lista de pasos
```

## 5. Cómo probarlo (sin PostgreSQL)

```bash
cd backend
npm run test:strategy-template     # 30 comprobaciones (también: test:strategy · test:template)
npm run demo:strategy-template     # ver cómo cambia el ranking por estrategia y por tipo
```

En el Dashboard, **🧪 Validar patrones de comportamiento** ahora tiene las pestañas **Strategy** y **Template Method**: la primera deja elegir la estrategia (y "Probar las 3"), la segunda el tipo y muestra los **pasos del esqueleto**. Ambas tienen **▶ Ejecutar verificación automática**, que deja tu historial como estaba. Hace falta tener un perfil (si no, la verificación crea uno desde la plantilla "accionAventura").
