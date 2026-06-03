@echo off
:: Servidor de desarrollo con soporte Range requests (requerido por PMTiles)
:: Uso: doble click o ejecutar desde la raiz del proyecto
echo.
echo  Corredor Biologico - Servidor de Desarrollo
echo  PMTiles requiere Range requests - usando serve (npx)
echo.
cd /d "%~dp0.."
npx serve . -p 8766 -s
