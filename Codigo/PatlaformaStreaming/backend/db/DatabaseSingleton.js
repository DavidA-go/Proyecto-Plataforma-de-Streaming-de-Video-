import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolvemos la ruta del .env de forma EXPLÍCITA, relativa a este archivo
// (backend/db/DatabaseSingleton.js -> backend/.env). Así funciona sin
// importar si el proceso se arrancó desde la raíz del proyecto
// (npm run dev) o desde dentro de backend/ (npm start).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

class DatabaseSingleton {
  constructor() {
    if (!DatabaseSingleton.instance) {
      // Configura la conexión a tu base de datos PostgreSQL
      const config = {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'login_solid',
        password: process.env.DB_PASSWORD || 'Crisxpg',
        port: process.env.DB_PORT || 5432,
      };

      // Log de diagnóstico: confirma qué .env se está usando realmente
      // (la contraseña se enmascara, nunca se imprime completa).
      console.log('🔧 Configuración de conexión a PostgreSQL:', {
        ...config,
        password: config.password ? `${config.password[0]}***(${config.password.length} caracteres)` : '(vacía)',
      });

      this.pool = new Pool(config);

      this.pool.on('connect', () => {
        console.log('⚡ Conexión establecida mediante Singleton (Pool PostgreSQL)');
      });

      // IMPORTANTE: sin este listener, cualquier error de conexión
      // (password incorrecto, Postgres apagado, etc.) hace que Node
      // lance una excepción no capturada y tumbe TODO el backend.
      // Con este listener, el error solo se registra en consola y el
      // servidor sigue vivo (las rutas que usan la BD responderán con
      // error 500, pero el resto de la app no se cae).
      this.pool.on('error', (err) => {
        console.error('❌ Error inesperado en el Pool de PostgreSQL:', err.message);
      });

      DatabaseSingleton.instance = this;
    }

    return DatabaseSingleton.instance;
  }

  // Método centralizado para ejecutar consultas
  async query(text, params) {
    return await this.pool.query(text, params);
  }
}

// Congelamos la instancia para garantizar el patrón Singleton
const dbInstance = Object.freeze(new DatabaseSingleton());
export default dbInstance;