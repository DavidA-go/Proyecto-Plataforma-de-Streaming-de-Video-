import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import AuthVisual from './AuthVisual';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/login', {
        email,
        password,
      });

      if (response.status === 200) {
        // Guardamos el usuario para poder mostrarlo en el dashboard
        localStorage.setItem('cineverse_user', JSON.stringify(response.data.user));
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al conectar con el servidor.');
    }
  };

  return (
    <div className="auth-page">
      <AuthVisual
        heading="Todo tu entretenimiento, en un solo lugar."
        copy="Series, películas y estrenos exclusivos esperándote. Inicia sesión y sigue justo donde lo dejaste."
      />

      <div className="auth-form-side">
        <div className="auth-container">
          <div className="auth-card">
            <p className="auth-eyebrow">Bienvenido de nuevo</p>
            <h2 className="auth-title">Inicia sesión</h2>
            <p className="auth-subtitle">Ingresa tus datos para continuar viendo tu contenido.</p>

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="tucorreo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-primary">
                Iniciar sesión
              </button>
            </form>

            <p className="auth-footer">
              ¿Primera vez en la plataforma? <Link to="/register">Suscríbete ahora</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
