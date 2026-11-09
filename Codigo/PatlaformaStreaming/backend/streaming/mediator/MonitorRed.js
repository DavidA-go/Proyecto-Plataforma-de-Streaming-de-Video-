import ComponenteReproductor from './ComponenteReproductor.js';

/** COLLEAGUE — mide el ancho de banda disponible. No sabe qué se hace con la medición. */
class MonitorRed extends ComponenteReproductor {
  constructor(anchoBandaKbps) {
    super('MonitorRed');
    this.anchoBandaKbps = anchoBandaKbps;
  }

  /** Registra una nueva medición y avisa al mediador. */
  medir(kbps) {
    if (!Number.isFinite(kbps) || kbps <= 0) throw new Error('El ancho de banda debe ser un número de kbps mayor que 0.');
    const anterior = this.anchoBandaKbps;
    this.anchoBandaKbps = Math.round(kbps);
    this.emitir('RED_CAMBIO', { anteriorKbps: anterior, kbps: this.anchoBandaKbps });
  }
}

export default MonitorRed;
