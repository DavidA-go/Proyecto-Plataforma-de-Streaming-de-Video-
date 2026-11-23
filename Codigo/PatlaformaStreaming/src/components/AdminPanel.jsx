import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getUsuario } from '../api';

// Panel de administración. Cada sección llama a un endpoint protegido por un
// PROXY en el backend: aunque alguien abra esta pantalla a mano, la API
// responde 403 si su rol no es "admin". Las estadísticas muestran el FLYWEIGHT
// (pocas instancias compartidas para muchísimas solicitudes).
const NUEVO_VACIO = { nombre: '', correo: '', password: '', tipoPlan: 'free', rol: 'usuario' };
const PLANES = ['free', 'basico', 'premium', 'familiar'];

export default function AdminPanel() {
  const navigate = useNavigate();
  const [yo] = useState(getUsuario);
  const [usuarios, setUsuarios] = useState([]);
  const [accesos, setAccesos] = useState([]);
  const [fw, setFw] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevo, setNuevo] = useState(NUEVO_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [edicion, setEdicion] = useState({ nombre: '', correo: '', password: '' });

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

  const crearUsuario = async (e) => {
    e.preventDefault();
    setMensaje('');
    try {
      const res = await api.post('/api/admin/usuarios', nuevo);
      setMensaje(`Usuario ${res.data.user.nombre} creado.`);
      setError('');
      setNuevo(NUEVO_VACIO);
      setMostrarNuevo(false);
      cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo crear el usuario.');
    }
  };

  const empezarEdicion = (u) => {
    setEditandoId(u.id);
    setEdicion({ nombre: u.nombre, correo: u.correo, password: '' });
    setMensaje('');
    setError('');
  };

  const guardarEdicion = async (id) => {
    setMensaje('');
    try {
      const datos = { nombre: edicion.nombre, correo: edicion.correo };
      if (edicion.password) datos.password = edicion.password; // vacío = no cambiar la contraseña
      const res = await api.put(`/api/admin/usuarios/${id}`, datos);
      setMensaje(`Usuario ${res.data.user.nombre} actualizado. ${edicion.password ? 'La contraseña fue cambiada.' : 'La contraseña NO se cambió (el campo estaba vacío).'}`);
      setError('');
      setEditandoId(null);
      cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo editar el usuario.');
    }
  };

  const eliminarUsuario = async (u) => {
    if (!window.confirm(`¿Eliminar a ${u.nombre} (${u.correo})? Esta acción no se puede deshacer.`)) return;
    setMensaje('');
    try {
      await api.delete(`/api/admin/usuarios/${u.id}`);
      setMensaje(`Usuario ${u.nombre} eliminado.`);
      setError('');
      cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo eliminar el usuario.');
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
          <button className="btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setMostrarNuevo((v) => !v)}>
            {mostrarNuevo ? 'Cancelar' : '➕ Agregar usuario'}
          </button>

          {mostrarNuevo && (
            <form onSubmit={crearUsuario} style={{ display: 'grid', gap: 8, width: '100%', margin: '12px 0' }}>
              <input className="form-input" placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required />
              <input className="form-input" type="email" placeholder="Correo" value={nuevo.correo} onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })} required />
              <input className="form-input" type="password" name="nueva-password-usuario" autoComplete="new-password" placeholder="Contraseña (mínimo 6 caracteres)" value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} required minLength={6} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select className="form-input" style={{ width: 'auto' }} value={nuevo.tipoPlan} onChange={(e) => setNuevo({ ...nuevo, tipoPlan: e.target.value })}>
                  {PLANES.map((p) => <option key={p} value={p}>plan {p}</option>)}
                </select>
                <select className="form-input" style={{ width: 'auto' }} value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
                  <option value="usuario">usuario</option>
                  <option value="admin">admin</option>
                </select>
                <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 18px' }}>Crear usuario</button>
              </div>
            </form>
          )}

          <ul className="dash-plan-details">
            {usuarios.map((u) => (
              <li key={u.id}>
                {editandoId === u.id ? (
                  <span style={{ display: 'grid', gap: 8 }}>
                    <input className="form-input" autoComplete="off" value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} placeholder="Nombre" />
                    <input className="form-input" type="email" autoComplete="off" value={edicion.correo} onChange={(e) => setEdicion({ ...edicion, correo: e.target.value })} placeholder="Correo" />
                    <input className="form-input" type="password" name="nueva-password-edicion" autoComplete="new-password" value={edicion.password} onChange={(e) => setEdicion({ ...edicion, password: e.target.value })} placeholder="Nueva contraseña (vacío = no cambiar)" />
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => guardarEdicion(u.id)}>Guardar</button>
                      <button type="button" className="btn-ghost" onClick={() => setEditandoId(null)}>Cancelar</button>
                    </span>
                  </span>
                ) : (
                  <>
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
                    {u.id === yo.id && ' (tú)'}{' '}
                    <button type="button" className="btn-ghost" style={{ padding: '4px 10px' }} onClick={() => empezarEdicion(u)}>✏️ Editar</button>{' '}
                    <button type="button" className="btn-ghost" style={{ padding: '4px 10px' }} disabled={u.id === yo.id} title={u.id === yo.id ? 'No puedes eliminar tu propia cuenta' : undefined} onClick={() => eliminarUsuario(u)}>🗑️ Eliminar</button>
                  </>
                )}
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
