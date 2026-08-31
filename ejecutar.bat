@echo off
title Servidor CineStream - Flask
echo Activando entorno virtual...
call venv\Scripts\activate
echo Iniciando aplicacion...
python app.py
pause