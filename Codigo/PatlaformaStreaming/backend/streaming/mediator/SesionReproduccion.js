import MediadorReproduccion from './MediadorReproduccion.js';
import MonitorRed from './MonitorRed.js';
import SelectorCalidad from './SelectorCalidad.js';
import BufferReproduccion from './BufferReproduccion.js';
import ControlReproduccion from './ControlReproduccion.js';
import ControlPistas from './ControlPistas.js';

const BUFFER_MINIMO_PARA_SUBIR = 10; // segundos: no se sube de calidad con el buffer justo
const BUFFER_TRAS_CAMBIO_AUDIO = 6; // al cambiar de audio se descarta lo descargado salvo esto
const MAX_BITACORA = 200;

/**
 * SesionReproduccion.js
 * ------------------------------------------------------------------
 * MEDIATOR CONCRETO. Crea los 5 colegas, se los presenta a sí mismo y
 * contiene TODAS las reglas de coordinación en un solo lugar (notificar).
 * Ningún colega referencia a otro: si mañana hay que cambiar una regla
 * ("no subir de calidad con menos de 15 s de buffer") se toca solo este archivo.
 *
 * Reglas:
 *  RED_CAMBIO          -> adaptar calidad (baja de inmediato; sube solo con buffer >= 10 s;
 *                         si la subida se pospone, se reintenta sola al avanzar el tiempo)
 *  BUFFER_BAJO         -> bajar un escalón de calidad (red de seguridad si la medición de red no avisó)
 *  BUFFER_VACIO        -> si estaba reproduciendo, pasar a "cargando"
 *  BUFFER_RECUPERADO   -> si el usuario quería reproducir, reanudar; re-evaluar calidad
 *  REPRODUCIR          -> reproduce si hay buffer suficiente; si no, "cargando"
 *  PAUSA               -> pausado (el buffer sigue llenándose)
 *  BUSCAR              -> mover posición, vaciar buffer y arrancar en la calidad más baja (inicio rápido)
 *  PISTA_CAMBIO        -> un cambio de audio descarta el audio ya descargado (recorta el buffer)
 *  FIN_CONTENIDO       -> detener
 * ------------------------------------------------------------------
 */
class SesionReproduccion extends MediadorReproduccion {
  #bitacora = [];
  #secuencia = 0;
  #subidaPospuesta = false; // ya se anotó que una subida quedó esperando buffer
  #subidaPendiente = false; // la red sostiene más calidad que la actual

  /**
   * @param {{id:string,titulo:string,duracionMin:number}} contenido  reproducible elegido
   * @param {string} techoCalidad   calidad máxima que permite el plan ('360p'...'1080p')
   * @param {number} anchoBandaKbps medición inicial de red
   */
  constructor({ contenido, techoCalidad = '1080p', anchoBandaKbps = 3000, audios = ['es', 'en'], subtitulos = ['es', 'en'] }) {
    super();
    this.contenido = contenido;

    this.red = new MonitorRed(anchoBandaKbps);
    this.calidad = new SelectorCalidad(techoCalidad);
    this.buffer = new BufferReproduccion();
    this.control = new ControlReproduccion(contenido.duracionMin * 60);
    this.pistas = new ControlPistas({ audios, subtitulos });
    // Presentación de colegas: cada uno recibe SOLO al mediador.
    [this.red, this.calidad, this.buffer, this.control, this.pistas].forEach((c) => c.setMediador(this));

    // Calidad inicial según la red medida al abrir la sesión.
    this.calidad.aplicar(this.calidad.candidatoPara(anchoBandaKbps), 'calidad inicial');
  }

  // ================================================================
  // El corazón del patrón: todas las reglas de coordinación
  // ================================================================
  notificar(emisor, evento, datos) {
    this.#registrar(emisor.nombre, evento, datos);

    switch (evento) {
      case 'RED_CAMBIO':
        this.#adaptarCalidad('cambió la red');
        break;

      case 'BUFFER_BAJO':
        this.calidad.bajarUnNivel('buffer bajo');
        break;

      case 'BUFFER_VACIO':
        if (this.control.estado === 'reproduciendo') this.control.establecerEstado('cargando');
        break;

      case 'BUFFER_RECUPERADO':
        if (this.control.quiereReproducir && this.control.estado === 'cargando') this.control.establecerEstado('reproduciendo');
        this.#adaptarCalidad('buffer recuperado');
        break;

      case 'REPRODUCIR':
        this.control.quiereReproducir = true;
        this.control.establecerEstado(this.buffer.segundos >= this.buffer.umbralRecuperado ? 'reproduciendo' : 'cargando');
        break;

      case 'PAUSA':
        this.control.quiereReproducir = false;
        this.control.establecerEstado('pausado');
        break;

      case 'BUSCAR':
        this.control.moverA(datos.segundo);
        this.buffer.vaciar(); // lo descargado ya no sirve en otra posición
        this.calidad.aplicar(SelectorCalidad.ESCALERA[0], 'inicio rápido tras saltar'); // la ABR vuelve a subir sola
        break;

      case 'PISTA_CAMBIO':
        if (datos.tipo === 'audio') this.buffer.recortarA(BUFFER_TRAS_CAMBIO_AUDIO);
        break;

      case 'FIN_CONTENIDO':
        this.control.quiereReproducir = false;
        this.control.establecerEstado('detenido');
        break;

      default:
        break; // CALIDAD_CAMBIO y demás: solo quedan en la bitácora
    }
  }

  /**
   * Decide si conviene cambiar de calidad mirando la red Y el buffer (por eso vive en el mediador).
   * Bajar es inmediato; subir es de a un escalón y solo con buffer suficiente.
   * Mientras la red sostenga más calidad que la actual queda una "subida pendiente"
   * que se reintenta en cada avance de tiempo (ver avanzar()).
   */
  #adaptarCalidad(motivo) {
    const candidata = this.calidad.candidatoPara(this.red.anchoBandaKbps);
    const idxCandidata = SelectorCalidad.indice(candidata);
    const idxActual = SelectorCalidad.indice(this.calidad.actual);

    if (idxCandidata < idxActual) {
      this.#subidaPendiente = false;
      this.#subidaPospuesta = false;
      this.calidad.aplicar(candidata, `${motivo}: la red ya no sostiene ${this.calidad.actual}`);
    } else if (idxCandidata > idxActual) {
      this.#subidaPendiente = true;
      if (this.buffer.segundos >= BUFFER_MINIMO_PARA_SUBIR) {
        this.#subidaPospuesta = false;
        this.calidad.aplicar(SelectorCalidad.ESCALERA[idxActual + 1], `${motivo}: la red sostiene más calidad`);
        this.#subidaPendiente = idxActual + 1 < idxCandidata; // ¿faltan escalones?
      } else if (!this.#subidaPospuesta) {
        this.#subidaPospuesta = true; // se anota una sola vez, no en cada tick
        this.#registrar('SesionReproduccion', 'SUBIDA_POSPUESTA', { candidata, bufferSeg: Math.round(this.buffer.segundos * 10) / 10, minimo: BUFFER_MINIMO_PARA_SUBIR });
      }
    } else {
      this.#subidaPendiente = false;
      this.#subidaPospuesta = false;
    }
  }

  // ================================================================
  // Operaciones que usa el servicio (delegan en los colegas)
  // ================================================================
  reproducir() { this.control.solicitarReproducir(); }
  pausar() { this.control.solicitarPausa(); }
  buscar(segundo) { this.control.solicitarBuscar(segundo); }
  reportarRed(kbps) { this.red.medir(kbps); }
  cambiarAudio(idioma) { this.pistas.solicitarAudio(idioma); }
  cambiarSubtitulo(idioma) { this.pistas.solicitarSubtitulo(idioma); }

  /**
   * Simula el paso de `segundos` de tiempo real: la red descarga video
   * (siempre, incluso en pausa, hasta llenar el buffer) y, si se está
   * reproduciendo, el reproductor consume buffer y avanza la posición.
   */
  avanzar(segundos) {
    if (!Number.isFinite(segundos) || segundos <= 0 || segundos > 600) throw new Error('"valor" debe ser un número de segundos entre 1 y 600.');
    // Se simula segundo a segundo para que los umbrales se crucen en el momento justo.
    for (let i = 0; i < Math.ceil(segundos); i++) {
      const paso = Math.min(1, segundos - i);
      this.buffer.llenar((paso * this.red.anchoBandaKbps) / this.calidad.bitrateKbps);
      if (this.control.estado === 'reproduciendo') {
        const consumido = Math.min(paso, this.buffer.segundos);
        this.buffer.consumir(consumido);
        this.control.avanzar(consumido);
      }
      if (this.#subidaPendiente) this.#adaptarCalidad('buffer suficiente'); // reintenta una subida que quedó pendiente
    }
  }

  // ================================================================
  // Lectura
  // ================================================================
  #registrar(origen, evento, datos = {}) {
    this.#bitacora.push({ n: ++this.#secuencia, origen, evento, datos });
    if (this.#bitacora.length > MAX_BITACORA) this.#bitacora.shift();
  }

  /** Eventos (más antiguo primero). `desdeN` devuelve solo los posteriores a esa secuencia. */
  bitacora({ desdeN = 0, ultimos = 50 } = {}) {
    return this.#bitacora.filter((e) => e.n > desdeN).slice(-ultimos);
  }

  get ultimaSecuencia() {
    return this.#secuencia;
  }

  estado() {
    return {
      contenido: this.contenido,
      reproduccion: { estado: this.control.estado, posicionSeg: Math.round(this.control.posicionSeg * 10) / 10, duracionSeg: this.control.duracionSeg },
      calidad: { actual: this.calidad.actual, techoPlan: this.calidad.techo, bitrateKbps: this.calidad.bitrateKbps },
      red: { anchoBandaKbps: this.red.anchoBandaKbps },
      buffer: { segundos: Math.round(this.buffer.segundos * 10) / 10, nivel: this.buffer.nivel },
      pistas: { audio: this.pistas.audio, subtitulo: this.pistas.subtitulo, audiosDisponibles: this.pistas.audiosDisponibles, subtitulosDisponibles: this.pistas.subtitulosDisponibles },
    };
  }
}

export default SesionReproduccion;
