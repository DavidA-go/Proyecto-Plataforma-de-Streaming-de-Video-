import ContenidoCompuesto from './ContenidoCompuesto.js';

/**
 * Serie (COMPOSITE concreto del patrón Composite)
 * Agrupa temporadas. Es un composite de composites.
 */
class Serie extends ContenidoCompuesto {
  tipo() {
    return 'serie';
  }

  aceptar(visitante) {
    return visitante.visitarSerie(this); // Visitor
  }

  /** Una serie "tiene video real" si alguno de sus episodios lo tiene (así sale en Inicio → «Con video real»). */
  toJSON() {
    const base = super.toJSON();
    const real = this.obtenerReproducibles().find((e) => e.fuente?.esReal());
    return real ? { ...base, contenidoReal: true, creditos: real.fuente.creditos() } : base;
  }
}

export default Serie;
