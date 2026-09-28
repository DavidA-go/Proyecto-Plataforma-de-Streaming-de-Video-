from services.auth_service import AuthService

def main():
    auth = AuthService()

    while True:
        print("\n--- SISTEMA DE AUTENTICACIÓN ---")
        print("1. Registrar usuario")
        print("2. Iniciar sesión")
        print("3. Salir")
        opcion = input("Selecciona una opción: ")

        if opcion == "1":
            nombre = input("Nombre completo: ")
            correo = input("Correo electrónico: ")
            password = input("Contraseña: ")
            auth.registrar_usuario(nombre, correo, password)

        elif opcion == "2":
            correo = input("Correo electrónico: ")
            password = input("Contraseña: ")
            usuario = auth.iniciar_sesion(correo, password)
            if usuario:
                print(f"Sesión iniciada como: {usuario}")

        elif opcion == "3":
            print("¡Hasta luego!")
            break
        else:
            print("Opción inválida.")

if __name__ == "__main__":
    main()