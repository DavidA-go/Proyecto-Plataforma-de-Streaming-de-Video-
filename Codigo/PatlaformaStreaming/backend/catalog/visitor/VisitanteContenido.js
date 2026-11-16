/**
 * VisitanteContenido.js
 * ------------------------------------------------------------------
 * VISITOR (interfaz + comportamiento común) — subservicio de GESTIÓN DE
 * CONTENIDO.
 *
 * El catálogo es un árbol Composite (colección → serie → temporada →
 * episodio, más películas y documentales). Ya tiene operaciones propias
 * (duración, filtrar, toJSON, iteradores...). Cada reporte nuevo
 * (estadísticas, espacio en disco, exportar a CSV, auditoría de derechos...)
 * obligaría a abrir las 6 clases de nodos y añadirles un método más.
 *
 * Con Visitor, la operación vive FUERA de los nodos, en una clase aparte.
 * Cada nodo solo sabe "aceptar" un visitante y llamar al método que le
 * corresponde a su tipo (DOBLE DESPACHO):
 *
 *     nodo.aceptar(visitante)  ->  visitante.visitarSerie(nodo)
 *
 * Agregar una operación nueva = crear una clase visitante. Los nodos no se tocan.
 *
 * Los métodos visitarX() tienen una implementación por defecto: los grupos
 * recorren sus hijos y las hojas no hacen nada. Cada visitante concreto
 * sobrescribe solo los tipos que le interesan.
 * ------------------------------------------------------------------
 */
class VisitanteContenido {
  /** Profundidad del nodo que se está visitando (0 = el nodo desde el que se empezó). */
  nivel = 0;
  /** Cuántos nodos se visitaron en total (lo usan las pruebas para comparar contra el Composite). */
  nodosVisitados = 0;

  constructor() {
    if (new.target === VisitanteContenido) {
      throw new Error('VisitanteContenido es abstracta: usa VisitanteEstadisticas, VisitanteAlmacenamiento o VisitanteExportadorCSV.');
    }
  }

  // --- Hojas ---
  visitarPelicula(nodo) { return this.visitarHoja(nodo); }
  visitarDocumental(nodo) { return this.visitarHoja(nodo); }
  visitarEpisodio(nodo) { return this.visitarHoja(nodo); }

  // --- Grupos ---
  visitarTemporada(nodo) { return this.visitarGrupo(nodo); }
  visitarSerie(nodo) { return this.visitarGrupo(nodo); }
  visitarColeccion(nodo) { return this.visitarGrupo(nodo); }

  /** Por defecto una hoja solo se cuenta. */
  visitarHoja() {
    this.nodosVisitados++;
  }

  /** Por defecto un grupo se cuenta y le pide a cada hijo que acepte a este visitante. */
  visitarGrupo(nodo) {
    this.nodosVisitados++;
    this.descender(nodo);
  }

  /** Recorre los hijos directos llevando la cuenta del nivel. El visitante decide cuándo (antes/después de lo suyo). */
  descender(nodo) {
    this.nivel++;
    for (const hijo of nodo.getHijos()) hijo.aceptar(this);
    this.nivel--;
  }

  /** (subclase) lo que devuelve el visitante al terminar el recorrido. */
  resultado() {
    throw new Error('resultado() debe ser implementado por el visitante concreto.');
  }
}

export default VisitanteContenido;
