import { useEffect, useRef, useState } from 'react';

const INTERVALO_LATIDO_MS = 60 * 1000; // la sesión DRM vence a los 10 min sin actividad

// Reproductor de video REAL. Recibe el manifiesto que armó el backend (Bridge + Builder + Flyweight):
// cada entrada de manifest.calidades trae la URL del MP4 con su ticket firmado, y el plan del
// usuario ya recortó las calidades que puede ver. El navegador pide el archivo por tramos
// ("Range"), por eso se puede adelantar sin bajarlo completo.
export default function Reproductor({ manifest, titulo, onPrimeraReproduccion, onLatido }) {
  const videoRef = useRef(null);
  const retomar = useRef(null); // { tiempo, enPausa } al cambiar de calidad
  const yaReprodujo = useRef(false);

  // De menor a mayor bitrate: se empieza por la mejor que permite el plan.
  const calidades = [...manifest.calidades].sort((a, b) => a.bitrateKbps - b.bitrateKbps);
  const [resolucion, setResolucion] = useState(calidades.at(-1).resolucion);
  const [error, setError] = useState('');
  const [viendo, setViendo] = useState(false); // true mientras el video avanza (no en pausa ni terminado)
  const latidoRef = useRef(onLatido);
  useEffect(() => { latidoRef.current = onLatido; });

  // Latido: mientras se ve, se avisa al backend cada minuto para mantener viva la sesión DRM (pantalla en
  // uso). Si responde que ya no existe (Detener en otra pestaña, cambio de plan...), se pausa el video.
  useEffect(() => {
    if (!viendo) return undefined;
    const id = setInterval(async () => {
      try {
        const vigente = await latidoRef.current?.();
        if (vigente === false) {
          videoRef.current?.pause();
          setViendo(false);
          setError('Tu sesión de reproducción terminó (se liberó la pantalla o cambió tu plan). Pulsa ▶ de nuevo para continuar.');
        }
      } catch {
        // sin red: se reintenta en el siguiente latido
      }
    }, INTERVALO_LATIDO_MS);
    return () => clearInterval(id);
  }, [viendo]);

  const actual = calidades.find((c) => c.resolucion === resolucion) || calidades.at(-1);

  const cambiarCalidad = (nueva) => {
    const v = videoRef.current;
    if (v) retomar.current = { tiempo: v.currentTime, enPausa: v.paused };
    setError('');
    setResolucion(nueva);
  };

  // Al terminar de cargar la nueva calidad se retoma justo donde estaba.
  const alCargarMetadatos = () => {
    const v = videoRef.current;
    if (!v || !retomar.current) return;
    v.currentTime = retomar.current.tiempo;
    if (retomar.current.enPausa) v.pause(); // autoPlay arranca solo: si estaba en pausa, se respeta
    else v.play().catch(() => {});
    retomar.current = null;
  };

  const alReproducir = () => {
    setViendo(true);
    if (yaReprodujo.current) return;
    yaReprodujo.current = true;
    onPrimeraReproduccion?.();
  };

  return (
    <div className="player-box">
      <video
        ref={videoRef}
        key={actual.url}
        className="player-video"
        src={actual.url}
        controls
        autoPlay
        playsInline
        preload="metadata"
        onLoadedMetadata={alCargarMetadatos}
        onPlay={alReproducir}
        onPause={() => setViendo(false)}
        onEnded={() => setViendo(false)}
        onError={() => setError('No se pudo cargar el video. Tu sesión de reproducción pudo terminar (Detener, cambio de plan o inactividad): pulsa ▶ de nuevo.')}
      >
        Tu navegador no soporta video HTML5.
      </video>

      {error && <div className="alert-error">{error}</div>}

      <div className="player-bar">
        <label className="player-quality">
          Calidad{' '}
          <select value={actual.resolucion} onChange={(e) => cambiarCalidad(e.target.value)} disabled={calidades.length < 2}>
            {calidades.map((c) => (
              <option key={c.resolucion} value={c.resolucion}>
                {c.resolucion}
              </option>
            ))}
          </select>
          {calidades.length < 2 && <span className="player-hint"> (tu plan solo incluye esta)</span>}
        </label>
        {manifest.permiteDescarga ? (
          <a className="player-download" href={`${actual.url}&descargar=1`} download>
            ⬇ Descargar {actual.resolucion}
          </a>
        ) : (
          <span className="player-hint">Descarga offline: no incluida en tu plan</span>
        )}
        {manifest.creditos && (
          <span className="player-credits">
            «{titulo}» · © {manifest.creditos.autor} ·{' '}
            <a href={manifest.creditos.url} target="_blank" rel="noreferrer">
              {manifest.creditos.licencia}
            </a>
          </span>
        )}
      </div>
    </div>
  );
}
