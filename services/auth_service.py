from repositories.user_repository import UserRepository
from services.password_hasher import PasswordHasher
from models.user import User

class AuthService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.hasher = PasswordHasher()

    def registrar_usuario(self, nombre, correo, password):
        # 1. Verificar si el correo ya existe en la BD
        usuario_existente = self.user_repo.find_by_email(correo)
        if usuario_existente:
            return False  # El correo ya está registrado

        # 2. Generar el hash de la contraseña
        hashed_password = self.hasher.hash_password(password)

        # 3. Crear el objeto User con los datos correspondientes
        nuevo_usuario = User(
            nombre=nombre,
            correo=correo,
            password=hashed_password,
            rol="cliente",
            activo=True
        )

        # 4. Guardar en la base de datos a través del repositorio
        return self.user_repo.create_user(nuevo_usuario)

    def autenticar_usuario(self, correo, password):
        # 1. Buscar el usuario por correo
        usuario = self.user_repo.find_by_email(correo)
        if not usuario:
            return None

        # 2. Verificar la contraseña ingresada con el hash guardado
        if self.hasher.verify_password(password, usuario.password):
            return usuario
        
        return None