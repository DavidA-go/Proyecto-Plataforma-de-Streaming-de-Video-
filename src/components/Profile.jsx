import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const PLAN_LABELS = {
  free: 'Free',
  basico: 'Básico',
  premium: 'Premium',
  familiar: 'Familiar',
};

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [planes, setPlanes] = useState([]);
  const [tipoPlan, setTipoPlan] = useState('free');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  // Carga el usuario de sesión y, en paralelo, la lista de planes disponibles.
  // Esa lista viene de PlanFactory (backend), así que si se agrega un plan nuevo
  // aparecerá aquí automáticamente, sin tocar este componente.
  useEffect(() => {
    const stored = localStorage.getItem('cineverse_user');
    if (!stored) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(stored);
    setUser(parsedUser);
    setTipoPlan(parsedUser.planTipo || 'free');

    const fetchPlanes = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/planes');
        setPlanes(response.data.planes || []);
      } catch (err) {
        console.error('No se pudieron cargar los planes:', err);
      }
    };
    fetchPlanes();
  }, [navigate]);

  const handleGuardarPlan = async () => {
    if (!user) return;
    setLoading(true);
    setMensaje('');
    setError('');

    try {
      const response = await axios.put(`http://localhost:5000/api/usuarios/${user.id}/plan`, {
        tipoPlan,
      });

      const updatedUser = response.data.user;
      localStorage.setItem('cineverse_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setMensaje('¡Tu plan se actualizó con éxito!');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo actualizar el plan.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const planActualLabel = PLAN_LABELS[user.planTipo] || 'Free';

  return (
    <div className="profile-page">
      <nav className="dash-nav">
        <Link to="/dashboard" className="dash-brand">
          <svg width="26" height="26" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="17" cy="17" r="16" stroke="#e3b23c" strokeWidth="1.5" />
            <path d="M14 11.5L23 17L14 22.5V11.5Z" fill="#e3b23c" />
          </svg>
          <span className="dash-brand-name">CineVerse</span>
        </Link>
        <Link to="/dashboard" className="btn-ghost">
          Volver al inicio
        </Link>
      </nav>

      <main className="profile-content">
        <p className="auth-eyebrow">Mi perfil</p>
        <h1 className="profile-title">Hola, {user.nombre}</h1>
        <p className="profile-subtitle">
          Estás en el plan <strong>{planActualLabel}</strong>. Elige otro plan cuando quieras, se
          aplica al instante.
        </p>

        {mensaje && <div className="alert-success">{mensaje}</div>}
        {error && <div className="alert-error">{error}</div>}

        <div className="plan-selector plan-selector-profile">
          {planes.map((plan) => (
            <button
              type="button"
              key={plan.tipo}
              className={`plan-option ${tipoPlan === plan.tipo ? 'selected' : ''}`}
              onClick={() => setTipoPlan(plan.tipo)}
            >
              <span className="plan-option-name">{PLAN_LABELS[plan.tipo] || plan.tipo}</span>
              <span className="plan-option-price">
                {plan.precioMensual > 0
                  ? `$${Number(plan.precioMensual).toLocaleString('es-CO')}/mes`
                  : 'Gratis'}
              </span>
              <span className="plan-option-detail">{plan.calidadMaxima}</span>
              <span className="plan-option-detail">
                {plan.pantallasSimultaneas} pantalla{plan.pantallasSimultaneas > 1 ? 's' : ''} simultánea
                {plan.pantallasSimultaneas > 1 ? 's' : ''}
              </span>
              <span className="plan-option-detail">
                Descargas offline: {plan.descargasOffline ? 'Sí' : 'No'}
              </span>
            </button>
          ))}
        </div>

        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '13px 34px', marginTop: '28px' }}
          onClick={handleGuardarPlan}
          disabled={loading || tipoPlan === user.planTipo}
        >
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </main>
    </div>
  );
}
