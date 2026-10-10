# Patrón Facade — Subsistema de DRM (`backend/drm/DRMFacade.js`)

## Problema

Autorizar una reproducción exige coordinar **cinco patrones y varios registros** en un orden concreto.
Hasta ahora ese trabajo vivía dentro del endpoint `POST /api/stream/autorizar` de `index.js`, que debía conocer:

| Pieza | Patrón | Para qué la usaba el endpoint |
|---|---|---|
| `CatalogoService` | Composite | comprobar que el contenido existe y resumirlo |
| `DRMFactoryProvider` + fábrica | Abstract Factory | validador de token, gestor de licencias y watermarker de la familia |
| `WidevineLicenseAdapter` / `PlayReadyLicenseAdapter` | Adapter | sustituir el gestor propio por un proveedor comercial |
| `PlanFactory` | Factory Method | pantallas simultáneas del plan |
| `RestriccionGeografica` → `LimiteDispositivos` → `Auditoria` | Decorator | reglas apiladas **en un orden que importa** |
| `SesionesRegistry`, `AuditoriaLog` | (estado en memoria) | `detener` y `auditoria` |

Síntomas de que faltaba una fachada:
- `index.js` importaba 5 módulos internos de DRM solo para este flujo.
- `demo-patrones.js` volvía a armar a mano la misma cadena de decorators (lógica duplicada).
- La regla "Premium/Familiar → Widevine, el resto → PlayReady" estaba en el **frontend** (`Dashboard.jsx`).

## Solución

`DRMFacade` expone una interfaz mínima y oculta todo lo anterior.

| Rol | Clase |
|---|---|
| Facade | `DRMFacade` (`backend/drm/DRMFacade.js`) |
| Subsistema | `DRMFactoryProvider`, Adapters, Decorators, `PlanFactory`, `CatalogoService`, `SesionesRegistry`, `AuditoriaLog` |
| Clientes | `index.js` (endpoints) y `demo-patrones.js` |

```js
// Una sola llamada. La fachada devuelve { validacion, licencia, marcaDeAgua, contenido }
const r = await DRMFacade.autorizarReproduccion({
  usuario,                       // { id, planTipo, activo }  (ya resuelto, la fachada NO toca la BD)
  contenidoId,                   // cualquier nodo del catálogo
  proveedorExterno: 'auto',      // 'widevine' | 'playready' | 'auto' | omitido (gestor propio)
  dispositivoId, pais,
});

DRMFacade.detener(usuarioId, sesionId);   // -> { liberada, pantallasEnUso }
DRMFacade.auditoria(50);                  // -> últimos eventos EMITIDA / DENEGADA
```

### Errores de negocio tipados

La fachada lanza errores; **el cliente decide cómo traducirlos** (el endpoint los convierte en HTTP):

| Error | Cuándo | HTTP |
|---|---|---|
| `ContenidoNoEncontradoError` | el id no existe en el catálogo | 404 |
| `AccesoDenegadoError` | el validador de token rechaza al usuario | 403 |
| `LicenciaDenegadaError` (ya existía) | `LIMITE_DISPOSITIVOS` o `REGION_NO_PERMITIDA` | 403 |

### Decisiones de diseño

- **La fachada no reemplaza los patrones: los oculta y los coordina.** Abstract Factory, Adapter, Decorator, etc.
  siguen intactos y se pueden seguir usando por separado.
- **No accede a la base de datos.** Recibe el `usuario` ya resuelto, así que se puede usar y probar sin PostgreSQL.
- **`proveedorExterno: 'auto'`** mueve la decisión Widevine/PlayReady del frontend al backend. Los valores
  `'widevine'`, `'playready'` y "omitido" siguen funcionando igual que antes (compatibilidad con curl y con
  clientes existentes).
- **El orden de los decorators vive en un solo lugar** (`#decorar`): Auditoría → Límite → Región → gestor base.
- `CatalogoService.resumir(nodo)` reemplaza a la función `resumirContenido` que estaba solo en `index.js`, para
  que la fachada y los endpoints compartan el mismo resumen.

## Resultado (medido sobre el código)

| | Antes | Después |
|---|---|---|
| Líneas de código del handler `/autorizar` (sin comentarios ni vacías) | 47 | 37 |
| Colaboradores que el handler conoce | ~11 | 2 (`db` y `DRMFacade`, más sus errores) |
| Módulos internos de DRM importados por `index.js` | 5 | 2 (`DRMFacade` y la clase de error `LicenciaDenegadaError`) |
| Cadena de decorators armada en | `index.js` **y** `demo-patrones.js` | solo `DRMFacade` |

La reducción de líneas es modesta a propósito: la traducción de errores a HTTP se queda en el endpoint (es
responsabilidad de la capa web). La ganancia real es el desacoplamiento.

Se comprobó que el comportamiento HTTP **no cambió**: se ejecutaron 12 peticiones (autorización correcta,
límite de pantallas, región, contenido/usuario inexistente, usuario sin plan, detener, auditoría, Bridge y
catálogo) contra el `index.js` original y el refactorizado, con la BD simulada, y las respuestas fueron idénticas.

## Cómo probarlo

**Sin base de datos (consola):**
```
cd backend
npm run demo:patrones
```
Muestra: límite de pantallas, región, `detener()`, `proveedorExterno: 'auto'` (Widevine vs PlayReady según el
plan), errores tipados y la bitácora.

**Con la app:** `npm run dev`, inicia sesión y pulsa ▶ en cualquier contenido. El frontend ahora envía
`proveedorExterno: 'auto'`; en la tarjeta de reproducción el campo *Proveedor DRM (Adapter)* mostrará Widevine
para Premium/Familiar y PlayReady para Free/Básico, igual que antes.

**Con curl:**
```
curl -X POST localhost:5000/api/stream/autorizar -H "content-type: application/json" \
  -d '{"usuarioId":1,"contenidoId":"ambar","proveedorExterno":"auto","dispositivoId":"A","pais":"CO"}'
```

## Posible extensión (no incluida)

Una `ReproduccionFacade` que combine `DRMFacade` + la entrega de streaming (Bridge/Builder) en un único endpoint
(`/api/stream/reproducir`) eliminaría la segunda llamada del frontend, que hoy reenvía
`licencia.licenciaId` como `tokenDRM` a `/api/stream/entrega`.
