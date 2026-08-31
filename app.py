from flask import Flask, render_template, request, redirect, url_for, session
from services.auth_service import AuthService

# 1. Instanciar Flask antes de usarlo
app = Flask(__name__)
app.secret_key = 'tu_clave_secreta_aqui'

auth_service = AuthService()

@app.route("/")
def index():
    return render_template("login.html")

@app.route("/login", methods=["POST"])
def login():
    correo = request.form.get("correo")
    password = request.form.get("password")
    usuario = auth_service.autenticar_usuario(correo, password)
    
    if usuario:
        session["usuario"] = {
            "nombre": usuario.nombre,
            "correo": usuario.correo,
            "rol": usuario.rol,
            "activo": usuario.activo
        }
        return redirect(url_for("dashboard"))
    
    return render_template("login.html", error="Credenciales inválidas.")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        nombre = request.form.get("nombre")
        correo = request.form.get("correo")
        password = request.form.get("password")
        confirm_password = request.form.get("confirm_password")

        if password != confirm_password:
            return render_template("register.html", error="Las contraseñas no coinciden.")

        exito = auth_service.registrar_usuario(nombre, correo, password)
        if exito:
            return redirect(url_for("index"))
        
        return render_template("register.html", error="El correo ya se encuentra registrado.")

    return render_template("register.html")

@app.route("/dashboard")
def dashboard():
    usuario = session.get("usuario")
    if not usuario:
        return redirect(url_for("index"))
    return render_template("dashboard.html", usuario=usuario)

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


# 2. Bloque indispensable para levantar el servidor web
if __name__ == "__main__":
    app.run(debug=True)