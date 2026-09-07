import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const ROWS = [
  {
    title: 'Continuar viendo',
    items: [
      { title: 'Horizonte Nocturno', meta: 'Temporada 2 · Ep. 4', gradient: 'linear-gradient(160deg, #9a2e58, #2a0f1e)' },
      { title: 'El Último Vuelo', meta: 'Película · 2h 06m', gradient: 'linear-gradient(160deg, #3a3550, #16141f)' },
      { title: 'Códigos del Silencio', meta: 'Temporada 1 · Ep. 9', gradient: 'linear-gradient(160deg, #8a5a12, #2a1c06)' },
      { title: 'Raíces de Cobre', meta: 'Documental · 48m', gradient: 'linear-gradient(160deg, #2f4f4a, #10201d)' },
    ],
  },
  {
    title: 'Tendencias esta semana',
    items: [
      { title: 'Faro Escarlata', meta: 'Nueva temporada', gradient: 'linear-gradient(160deg, #6c1b3b, #1c0a13)' },
      { title: 'Ciudad de Vidrio', meta: 'Película · 1h 52m', gradient: 'linear-gradient(160deg, #4a3860, #16111f)' },
      { title: 'Bajo Cero', meta: 'Miniserie · 6 episodios', gradient: 'linear-gradient(160deg, #375a7f, #101c26)' },
      { title: 'La Otra Orilla', meta: 'Temporada 3', gradient: 'linear-gradient(160deg, #8a3a1c, #241108)' },
      { title: 'Ámbar', meta: 'Película · 2h 14m', gradient: 'linear-gradient(160deg, #b3862a, #2b1f06)' },
    ],
  },
  {
    title: 'Recomendado para ti',
    items: [
      { title: 'Reino de Papel', meta: 'Temporada 1', gradient: 'linear-gradient(160deg, #5a2a6c, #180a1f)' },
      { title: 'Selva Digital', meta: 'Documental · 55m', gradient: 'linear-gradient(160deg, #2a6c4a, #0a1f14)' },
      { title: 'Marea Alta', meta: 'Película · 1h 47m', gradient: 'linear-gradient(160deg, #2a4a6c, #0a1420)' },
      { title: 'Vestigios', meta: 'Temporada 2', gradient: 'linear-gradient(160deg, #6c4a2a, #1f130a)' },
    ],
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('cineverse_user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('cineverse_user');
    navigate('/login');
  };

  const displayName = user?.nombre || 'Invitado';
  const firstName = displayName.split(' ')[0];
  const initial = displayName.charAt(0).toUpperCase();

  // Etiquetas legibles para el tipo de plan (creado en el backend vía Factory Method)
  const PLAN_LABELS = {
    free: 'Free',
    basico: 'Básico',
    premium: 'Premium',
    familiar: 'Familiar',
  };
  const planLabel = PLAN_LABELS[user?.planTipo] || 'Free';
  const precio = user?.precioMensual ?? 0;
  const precioFormateado =
    precio > 0
      ? `$${Number(precio).toLocaleString('es-CO')}/mes`
      : 'Gratis';

  return (
    <div className="dash">
      <nav className="dash-nav">
        <div className="dash-nav-left">
          <div className="dash-brand">
            <svg width="26" height="26" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="17" cy="17" r="16" stroke="#e3b23c" strokeWidth="1.5" />
              <path d="M14 11.5L23 17L14 22.5V11.5Z" fill="#e3b23c" />
            </svg>
            <span className="dash-brand-name">CineVerse</span>
          </div>
          <ul className="dash-links">
            <li className="active">Inicio</li>
            <li>Series</li>
            <li>Películas</li>
            <li>Mi lista</li>
          </ul>
        </div>

        <div className="dash-user">
          <div className="dash-user-info">
            <span className="dash-user-name">{displayName}</span>
            {user?.rol && <span className="dash-user-role">{user.rol}</span>}
          </div>
          <div className="dash-avatar">{initial}</div>
          <button className="dash-logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      <header className="dash-hero">
        <p className="dash-hero-eyebrow">Tu sesión está activa</p>
        <h1>Hola de nuevo, {firstName}</h1>
        <p>Retoma tus series pendientes o descubre algo nuevo del catálogo seleccionado para ti esta semana.</p>
        <div className="dash-hero-cta">
          <button className="btn-primary" style={{ width: 'auto', padding: '12px 26px' }}>
            Explorar catálogo
          </button>
          <button className="btn-ghost">Mi lista</button>
        </div>

        <div className="dash-plan-card">
          <div className="dash-plan-info">
            <span className="dash-plan-badge">Plan {planLabel}</span>
            <span className="dash-plan-price">{precioFormateado}</span>
          </div>
          <ul className="dash-plan-details">
            <li>Calidad máxima: {user?.calidadMaxima || 'SD (480p)'}</li>
            <li>Pantallas simultáneas: {user?.pantallasSimultaneas ?? 1}</li>
            <li>Descargas offline: {user?.descargasOffline ? 'Sí' : 'No'}</li>
          </ul>
          <Link to="/profile" className="dash-plan-link">
            Cambiar plan →
          </Link>
        </div>
      </header>

      <main className="dash-content">
        {ROWS.map((row) => (
          <section className="dash-row" key={row.title}>
            <h2 className="dash-row-title">{row.title}</h2>
            <div className="dash-row-scroll">
              {row.items.map((item) => (
                <article
                  className="dash-card"
                  key={item.title}
                  style={{ background: item.gradient }}
                >
                  <span className="dash-card-play">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M4 2.5L11 7L4 11.5V2.5Z" fill="#fff" />
                    </svg>
                  </span>
                  <div className="dash-card-info">
                    <p className="dash-card-title">{item.title}</p>
                    <p className="dash-card-meta">{item.meta}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
