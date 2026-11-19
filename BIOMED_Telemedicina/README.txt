BIOMED | TELEMEDICINA INTEGRAL
Prototipo académico local — versión con rediseño de interfaz

IMPORTANTE
Esta aplicación es una demostración educativa. No es un sistema clínico real, no está certificada y no debe utilizarse para atender pacientes. Utiliza exclusivamente datos ficticios.

NOVEDADES DE ESTA VERSIÓN
- Navegación principal reorganizada en una barra horizontal superior, adaptable a computadora, tableta y móvil.
- Nueva pantalla de teleconsulta con vista previa de cámara, estado de dispositivos y controles separados para cámara, micrófono y detener la prueba.
- La cámara funciona solo como vista previa local del mismo dispositivo. No realiza videollamadas remotas.
- Términos y Condiciones ampliados, consultables desde la pantalla de registro y desde el enlace inferior.
- El registro requiere aceptar el aviso informativo de privacidad y los Términos y Condiciones. El servidor comprueba ambos valores.
- El documento TERMINOS_Y_CONDICIONES.txt se incluye como copia de lectura.

CONTENIDO
- app.py: servidor local Python y API de demostración.
- static/index.html: estructura de las pantallas y ventana de Términos y Condiciones.
- static/style.css: estilos visuales adaptables.
- static/app.js: navegación, roles, módulos y controles de cámara local.
- data/biomed_demo.json: datos ficticios de demostración.
- TERMINOS_Y_CONDICIONES.txt: versión de texto de las condiciones informativas.
- INICIAR_BIOMED.bat: acceso rápido en Windows.

REQUISITOS
- Windows, macOS o Linux.
- Python 3.9 o posterior instalado.
- No requiere instalar paquetes externos.

INICIAR EN WINDOWS
1. Extrae todo el ZIP en una carpeta nueva.
2. Abre la carpeta BIOMED_Telemedicina.
3. Haz doble clic en INICIAR_BIOMED.bat.
   También puedes abrir CMD en esa carpeta y ejecutar: py app.py
4. En el navegador abre: http://localhost:8080
5. Para detener el servidor, vuelve a la ventana de la consola y presiona Ctrl + C.

CUENTAS DE DEMOSTRACIÓN
Médico: medico@biomed.demo
Paciente: paciente@biomed.demo
Contraseña para ambas: Biomed123!

FUNCIONES INCLUIDAS
- Inicio de sesión y registro por rol.
- Panel de médico: pacientes, citas, expedientes, notas, medicamentos, referencias, rehabilitación y mensajería.
- Panel de paciente: perfil, expediente de consulta, citas, rehabilitación y mensajería.
- Gráficas mensuales de actividad.
- Prueba local de cámara y micrófono.

LIMITACIONES IMPORTANTES
- No ingreses nombres, datos de contacto, expedientes, antecedentes, fotografías, diagnósticos, resultados ni otra información real o sensible.
- La versión local almacena datos en archivos del proyecto. Las contraseñas de demostración se guardan sin un sistema de hashing adecuado para producción.
- Las sesiones y controles de rol son básicos y no sustituyen una arquitectura de seguridad. No expongas el servidor a Internet.
- La mensajería no es un canal clínico seguro.
- La pantalla de cámara solo muestra la vista previa del dispositivo local; no conecta usuarios entre sí.
- El módulo de rehabilitación solo documenta planes ficticios ingresados por el profesional en el escenario de ejemplo; no prescribe ejercicios ni calcula tiempos de recuperación.
- Los Términos y Condiciones son un texto académico informativo, no asesoría jurídica, contrato definitivo ni aviso de privacidad legal. Requieren revisión profesional antes de cualquier despliegue real.

DATOS
La demostración guarda datos en data/biomed_demo.json. Para restaurar el conjunto inicial, detén el servidor, elimina ese archivo y vuelve a ejecutar app.py. Se creará de nuevo con cuentas y datos ficticios.
