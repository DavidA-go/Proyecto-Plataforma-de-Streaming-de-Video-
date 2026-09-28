import bcrypt

class PasswordHasher:
    @staticmethod
    def hash_password(password: str) -> str:
        # Genera el salt y el hash seguro
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')

    @staticmethod
    def verify_password(password: str, hashed_password: str) -> bool:
        # Compara la contraseña en texto plano con el hash de la BD
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    