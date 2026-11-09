import ComponenteReproductor from './ComponenteReproductor.js';
import CalidadVideoFactory from '../../flyweight/CalidadVideoFactory.js';

const ESCALERA = ['360p', '480p', '720p', '1080p']; // de menor a mayor
const MARGEN = 1.25; // la red debe superar el bitrate en un 25 % para sostener esa calidad

/**
 * COLLEAGUE — guarda la calidad actual y el techo que permite el plan.
 * Las calidades son Flyweights (CalidadVideoFactory): compartidas con el resto del sistema.
 * Decide QUÉ calidad le conviene a una red (candidatoPara) pero NO decide CUÁNDO
 * cambiar: eso lo decide el mediador, que también mira el buffer.
 */
class SelectorCalidad extends ComponenteReproductor {
  static ESCALERA = ESCALERA;

  constructor(techo = '1080p') {
    super('SelectorCalidad');
    if (!ESCALERA.includes(techo)) throw new Error(`Techo de calidad inválido: "${techo}".`);
    this.techo = techo;
    this.actual = ESCALERA[0];
  }

  static indice(resolucion) {
    return ESCALERA.indexOf(resolucion);
  }

  get bitrateKbps() {
    return CalidadVideoFactory.obtener(this.actual).bitrateKbps;
  }

  /** La mejor calidad que la red sostiene sin pasarse del techo del plan (mínimo 360p). */
  candidatoPara(kbps) {
    const maximo = SelectorCalidad.indice(this.techo);
    let elegido = ESCALERA[0];
    for (let i = 0; i <= maximo; i++) {
      if (CalidadVideoFactory.obtener(ESCALERA[i]).bitrateKbps * MARGEN <= kbps) elegido = ESCALERA[i];
    }
    return elegido;
  }

  /** Cambia la calidad (respetando el techo) y avisa. Devuelve true si realmente cambió. */
  aplicar(resolucion, motivo = '') {
    if (!ESCALERA.includes(resolucion)) throw new Error(`Calidad inválida: "${resolucion}".`);
    const destino = SelectorCalidad.indice(resolucion) > SelectorCalidad.indice(this.techo) ? this.techo : resolucion;
    if (destino === this.actual) return false;
    const de = this.actual;
    this.actual = destino;
    this.emitir('CALIDAD_CAMBIO', { de, a: destino, motivo });
    return true;
  }

  /** Baja un escalón (si puede). */
  bajarUnNivel(motivo) {
    const i = SelectorCalidad.indice(this.actual);
    return i > 0 ? this.aplicar(ESCALERA[i - 1], motivo) : false;
  }

  esLaMasBaja() {
    return this.actual === ESCALERA[0];
  }
}

export default SelectorCalidad;
