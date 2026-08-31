import psycopg

conexion = psycopg.connect(
    host="localhost",
    port=5432,
    dbname="login_solid",
    user="postgres",
    password="Crisxpg"
)

print("Conexión exitosa a PostgreSQL")

conexion.close()