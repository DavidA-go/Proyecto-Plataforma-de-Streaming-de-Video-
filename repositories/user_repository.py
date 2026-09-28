from database.connection import DatabaseSingleton
from models.user import User

class UserRepository:
    def __init__(self):
        self.db = DatabaseSingleton().get_connection()

    def create_user(self, user: User) -> bool:
        query = """
            INSERT INTO usuarios (nombre, correo, password, rol, activo)
            VALUES (%s, %s, %s, %s, %s);
        """
        with self.db.cursor() as cursor:
            cursor.execute(query, (user.nombre, user.correo, user.password, user.rol, user.activo))
            self.db.commit()
            return True

    def find_by_email(self, correo: str) -> User | None:
        query = """
            SELECT id, nombre, correo, password, rol, activo
            FROM usuarios
            WHERE correo = %s;
        """
        with self.db.cursor() as cursor:
            cursor.execute(query, (correo,))
            result = cursor.fetchone()
            
            if not result:
                return None

            # Manejo de respuesta tipo tupla/lista
            if isinstance(result, (tuple, list)):
                return User(
                    user_id=result[0],
                    nombre=result[1],
                    correo=result[2],
                    password=result[3],
                    rol=result[4],
                    activo=result[5]
                )

            # Manejo de respuesta tipo diccionario (DictCursor)
            return User(
                user_id=result.get('id'),
                nombre=result.get('nombre'),
                correo=result.get('correo'),
                password=result.get('password'),
                rol=result.get('rol'),
                activo=result.get('activo')
            )