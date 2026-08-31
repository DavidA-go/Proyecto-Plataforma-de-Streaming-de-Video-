class User:
    def __init__(self, nombre: str, correo: str, password: str, rol: str = 'usuario', activo: bool = True, user_id: int = None):
        self.id = user_id
        self.nombre = nombre
        self.correo = correo
        self.password = password
        self.rol = rol
        self.activo = activo

    def __repr__(self):
        return f"<User {self.nombre} ({self.correo}) - Rol: {self.rol}>"