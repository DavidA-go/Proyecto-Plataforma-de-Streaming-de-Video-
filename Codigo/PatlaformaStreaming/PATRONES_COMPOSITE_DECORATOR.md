# Patrones Composite y Decorator

## Composite — Gestión de contenido (`backend/catalog/`)

**Problema:** el catálogo es un árbol (colección → serie → temporada → episodio), pero el
resto del sistema debe poder tratar igual a una película suelta que a una serie completa.

| Rol | Clase |
|---|---|
| Component | `ElementoContenido` |
| Leaf | `Pelicula`, `Documental`, `Episodio` |
| Composite | `ContenidoCompuesto` (base) → `Temporada`, `Serie`, `Coleccion` |
| Punto de acceso | `CatalogoService` (raíz del árbol) |
| Datos de ejemplo | `catalogoDemo.js` (en memoria; con contenido real solo cambia este archivo) |

Operaciones comunes (misma firma en hojas y grupos): `getDuracion()`, `obtenerReproducibles()`,
`getGeneros()`, `buscar(id)`, `filtrar(generos)`, `toJSON()`.

**Dónde se usa**
- `GET /api/catalogo` — árbol completo. Filtros: `?generos=accion,thriller` o `?perfil=familiar`
  (usa los géneros de una plantilla del **Prototype**).
- `GET /api/catalogo/:id` — cualquier nodo.
- `POST /api/stream/entrega` (**Bridge**) — si el id es una serie, genera un manifiesto por cada episodio.
  Responde `manifest` (el primero) y `reproducibles` (todos).
- `POST /api/stream/autorizar` (**Abstract Factory**/**Adapter**) — valida que el contenido exista y devuelve su resumen.
- Frontend: botón *Explorar catálogo* del Dashboard → componente recursivo `CatalogNode`.

## Decorator — DRM (`backend/drm/LicenseDecorators.js`)

**Problema:** añadir reglas a la emisión de licencias sin tocar `LicenseManagerBasico`,
`LicenseManagerPremium` ni los Adapters de Widevine/PlayReady, y poder combinarlas.

| Clase | Hace |
|---|---|
| `LicenseManagerDecorator` | Base: implementa `LicenseManager`, envuelve a otro y delega |
| `RestriccionGeograficaDecorator` | ANTES: rechaza países sin derechos (`REGION_NO_PERMITIDA`) |
| `LimiteDispositivosDecorator` | ANTES: rechaza si se superan las pantallas del plan (`LIMITE_DISPOSITIVOS`); DESPUÉS: registra la sesión |
| `AuditoriaDecorator` | DESPUÉS: anota en la bitácora licencias emitidas y denegadas |

Cadena armada en `POST /api/stream/autorizar` (la llamada entra por la capa externa):

```
Auditoría → Límite de dispositivos → Región → gestor base (Familia Básica/Premium o Adapter)
```

El límite sale de `PlanFactory.crearPlan(plan).getPantallasSimultaneas()` (Básico=1, Premium=2, Familiar=4).
`emitirLicencia()` de los decorators es `async` para que el día que el gestor sea un servidor de licencias real
(Widevine/PlayReady por red) no haya que cambiar nada.

Archivos de apoyo: `SesionesRegistry.js` (pantallas en uso, en memoria, expiran a los 10 min) y `AuditoriaLog.js`.

**Endpoints nuevos:** `POST /api/stream/detener` (libera la pantalla) y `GET /api/stream/auditoria`.

## Cómo probarlo

**Sin base de datos (consola):**
```
cd backend
npm run demo:patrones
```

**Con la app:** `npm run dev`, inicia sesión y:
1. *Explorar catálogo* → despliega el árbol y pulsa ▶ sobre una serie, una temporada, un episodio o una película.
   La tarjeta de reproducción muestra el tipo, la duración y cuántos manifiestos se generaron.
2. Límite de pantallas: con un usuario **Básico** (1 pantalla) reproduce algo, y abre la misma cuenta en
   **otro navegador o ventana de incógnito** (otro `dispositivoId`) → la segunda reproducción es rechazada.
   Pulsa *Detener reproducción* en la primera y vuelve a intentarlo.
3. `GET http://localhost:5000/api/stream/auditoria` para ver las licencias EMITIDAS y DENEGADAS.

**Con curl** (cambia `dispositivoId` y `pais` para activar cada regla):
```
curl -X POST localhost:5000/api/stream/autorizar -H "content-type: application/json" \
  -d '{"usuarioId":1,"contenidoId":"horizonte-nocturno","dispositivoId":"A","pais":"CO"}'
```

> **Nota:** los datos de pantallas, auditoría y catálogo viven en memoria; se reinician al reiniciar el servidor.
