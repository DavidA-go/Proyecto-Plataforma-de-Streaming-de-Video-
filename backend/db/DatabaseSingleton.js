import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

class DatabaseSingleton {
  constructor() {
    if (!DatabaseSingleton.instance) {
      // Configura la conexión a tu base de datos PostgreSQL
      this.pool = new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'login_solid',
        password: process.env.DB_PASSWORD || 'Crisxpg',
        port: process.env.DB_PORT || 5432,
      });

      this.pool.on('connect', () => {
        console.log('⚡ Conexión establecida mediante Singleton (Pool PostgreSQL)');
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