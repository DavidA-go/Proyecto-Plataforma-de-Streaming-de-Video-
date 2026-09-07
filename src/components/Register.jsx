import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import AuthVisual from './AuthVisual';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/register', {
        username,
        email,
        password,
        confirmPassword,
      });

      if (response.status === 201) {
        alert('¡Registro exitoso! Ya puedes iniciar sesión.');
        setUsername('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        navigate('/login');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al conectar con el servidor.');
    }
  };

  return (
    <div className="auth-page">
      <AuthVisual
        heading="Crea tu cuenta y empieza a maratonear hoy mismo."
        copy="Un solo registro te da acceso a todo el catálogo: series originales, películas y contenido exclusivo."
      />

      <div className="auth-form-side">
        <div className="auth-container">
          <div className="auth-card">
            <p className="auth-eyebrow">Únete a CineVerse</p>
            <h2 className="auth-title">Crea tu cuenta</h2>
            <p className="auth-subtitle">Solo toma un minuto. Cancela cuando quieras.</p>

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleSubmit} autoComplete="off">
              <div className="form-group">
                <label htmlFor="username">Nombre completo</label>
                <input
                  id="username"
                  type="text"
                  className="form-input"
                  placeholder="Tu nombre y apellido"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>

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
                  autoComplete="new-password"
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
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirmar contraseña</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="btn-primary">
                Registrarse
              </button>
            </form>

            <p className="auth-footer">
              ¿Ya tienes cuenta? <Link to="/login">Inicia sesión aquí</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
