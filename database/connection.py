import psycopg2
from psycopg2.extensions import connection

class DatabaseSingleton:
    _instance = None
    _connection: connection = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatabaseSingleton, cls).__new__(cls)
            try:
                cls._instance._connection = psycopg2.connect(
                    dbname="login_solid",  
                    user="postgres",
                    password="Crisxpg",     
                    host="localhost",
                    port="5432"
                )
                print("Conexión exitosa a la base de datos (Instancia Singleton creada).")
            except Exception as e:
                print(f"Error al conectar a PostgreSQL: {e}")
                cls._instance = None
                raise e
        return cls._instance

    def get_connection(self) -> connection:
        return self._connection

    def close_connection(self):
        if self._connection and not self._connection.closed:
            self._connection.close()
            print("Conexión cerrada.")
            DatabaseSingleton._instance = None