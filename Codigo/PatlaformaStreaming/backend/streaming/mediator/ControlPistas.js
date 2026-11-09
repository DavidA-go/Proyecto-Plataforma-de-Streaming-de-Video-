import ComponenteReproductor from './ComponenteReproductor.js';

/** COLLEAGUE — pista de audio y subtítulos elegidos (los idiomas vienen del manifiesto). */
class ControlPistas extends ComponenteReproductor {
  constructor({ audios = ['es'], subtitulos = ['es'] } = {}) {
    super('ControlPistas');
    this.audiosDisponibles = audios;
    this.subtitulosDisponibles = subtitulos;
    this.audio = audios[0];
    this.subtitulo = null; // sin subtítulos
  }

  solicitarAudio(idioma) {
    if (!this.audiosDisponibles.includes(idioma)) {
      throw new Error(`Audio "${idioma}" no disponible. Disponibles: ${this.audiosDisponibles.join(', ')}`);
    }
    const anterior = this.audio;
    this.audio = idioma;
    this.emitir('PISTA_CAMBIO', { tipo: 'audio', de: anterior, a: idioma });
  }

  /** idioma = null o "ninguno" apaga los subtítulos. */
  solicitarSubtitulo(idioma) {
    const nuevo = idioma && idioma !== 'ninguno' ? idioma : null;
    if (nuevo && !this.subtitulosDisponibles.includes(nuevo)) {
      throw new Error(`Subtítulo "${nuevo}" no disponible. Disponibles: ${this.subtitulosDisponibles.join(', ')}`);
    }
    const anterior = this.subtitulo;
    this.subtitulo = nuevo;
    this.emitir('PISTA_CAMBIO', { tipo: 'subtitulo', de: anterior, a: nuevo });
  }
}

export default ControlPistas;
