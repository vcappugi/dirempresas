@echo off
echo ===================================================
echo   Compilando Aplicacion Android (Empresas.apk)
echo ===================================================

set "JAVA_HOME=C:\Users\APL789\.jdk21\jdk-21.0.12+8"
set "ANDROID_HOME=C:\Users\APL789\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%"

echo 1. Empaquetando archivos web en www/...
call node build-app.js

echo 2. Sincronizando con Capacitor Android...
call npx cap sync

echo 3. Compilando APK nativo con Gradle...
cd android
call gradlew.bat assembleDebug
cd ..

echo 4. Copiando Empresas.apk al directorio principal...
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "Empresas.apk"

echo ===================================================
echo   APK generado con exito: Empresas.apk
echo ===================================================
pause
