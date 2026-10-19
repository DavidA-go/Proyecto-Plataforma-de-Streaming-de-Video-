import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getUsuario } from '../api';

// Panel de administración. Cada sección llama a un endpoint protegido por un
// PROXY en el backend: aunque alguien abra esta pantalla a mano, la API
// responde 403 si su rol no es "admin". Las estadísticas muestran el FLYWEIGHT
// (pocas instancias compartidas para muchísimas solicitudes).
export default function AdminPanel() {
  const navigate = useNavigate();
  const [yo] = useState(getUsuario);
  const [usuarios, setUsuarios] = useState([]);
  const [accesos, setAccesos] = useState([]);
  const [fw, setFw] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [u, a, f] = await Promise.all([
        api.get('/api/admin/usuarios'),
        api.get('/api/admin/accesos'),
        api.get('/api/admin/flyweight'),
      ]);
      setUsuarios(u.data.usuarios);
      setAccesos(a.data.eventos);
      setFw(f.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar el panel.');
    }
  }, []);

  useEffect(() => {
    if (!yo) {
      navigate('/login');
      return;
    }
    cargar(); // eslint-disable-line react-hooks/set-state-in-effect -- carga inicial desde la API
  }, [yo, navigate, cargar]);

  const cambiarRol = async (id, rol) => {
    setMensaje('');
    try {
      const res = await api.put(`/api/admin/usuarios/${id}/rol`, { rol });
      setMensaje(`${res.data.user.nombre} ahora es ${rol}.`);
      setError('');
      cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cambiar el rol.');
    }
  };

  if (!yo) return null;

  return (
    <div className="profile-page">
      <nav className="dash-nav">
        <Link to="/dashboard" className="dash-brand">
          <span className="dash-brand-name">CineVerse · Admin</span>
        </Link>
        <Link to="/dashboard" className="btn-ghost">
          Volver al inicio
        </Link>
      </nav>

      <main className="profile-content">
        <p className="auth-eyebrow">Administración</p>
        <h1 className="profile-title">Panel de administrador</h1>

        {mensaje && <div className="alert-success">{mensaje}</div>}
        {error && (
          <div className="alert-error">
            {error} {yo.rol !== 'admin' && '(tu rol es "usuario": este panel es solo para admins)'}
          </div>
        )}

        <div className="dash-plan-card" style={{ display: 'flex' }}>
          <span className="dash-plan-badge">Usuarios y roles (Proxy → UsuarioProxy)</span>
          <ul className="dash-plan-details">
            {usuarios.map((u) => (
              <li key={u.id}>
                #{u.id} · {u.nombre} · {u.correo} · plan {u.planTipo} ·{' '}
                <select
                  value={u.rol}
                  disabled={u.id === yo.id}
                  onChange={(e) => cambiarRol(u.id, e.target.value)}
                  className="form-input"
                  style={{ display: 'inline-block', width: 'auto', padding: '4px 8px' }}
                >
                  <option value="usuario">usuario</option>
                  <option value="admin">admin</option>
                </select>
                {u.id === yo.id && ' (tú)'}
              </li>
            ))}
          </ul>
        </div>

        {fw && (
          <div className="dash-plan-card" style={{ display: 'flex', marginTop: 12 }}>
            <span className="dash-plan-badge">Flyweight: objetos compartidos</span>
            <ul className="dash-plan-details">
              <li>
                Roles: {fw.roles.solicitudes} solicitudes → solo {fw.roles.instanciasCreadas} instancia(s) (
                {fw.roles.claves.join(', ')})
              </li>
              <li>
                Calidades de video: {fw.calidades.solicitudes} solicitudes → solo {fw.calidades.instanciasCreadas}{' '}
                instancia(s) ({fw.calidades.claves.join(', ')})
              </li>
              {fw.permisosPorRol.map((r) => (
                <li key={r.nombre}>
                  <strong>{r.etiqueta}</strong>: {r.permisos.join(' · ')}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="dash-plan-card" style={{ display: 'flex', marginTop: 12 }}>
          <span className="dash-plan-badge">Registro de accesos del Proxy ({accesos.length})</span>
          <ul className="dash-plan-details">
            {accesos.slice(0, 30).map((e) => (
              <li key={e.id}>
                {e.resultado === 'PERMITIDO' ? '✅' : '⛔'} {e.resultado} · {e.rol}
                {e.usuarioId ? ` #${e.usuarioId}` : ''} · {e.servicio}.{e.operacion} · {new Date(e.fecha).toLocaleTimeString()}
              </li>
            ))}
          </ul>
          <button className="btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={cargar}>
            Actualizar
          </button>
        </div>
      </main>
    </div>
  );
}
