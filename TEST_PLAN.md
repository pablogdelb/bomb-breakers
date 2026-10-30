# Plan de pruebas

## Automáticas (`npm test`, 39 tests)
**Motor (`test/engine.test.js`)**
- 200 bombas por cada combinación dificultad × tamaño de equipo (6 combinaciones): generación determinista por semilla, estructura correcta (nº de módulos, protocolo solo en normal/difícil), y **resolubilidad**: la solución de `solve()` es aceptada paso a paso por `validateAction`.
- Verificadores **independientes** (reimplementados de otro modo) para cables, caja fuerte, simón, protocolo; circuito comprobado por **búsqueda exhaustiva** frente al solver GF(2); jeroglíficos con conjunto correcto único.
- Respuestas incorrectas rechazadas (todas las combinaciones de interruptores incorrectas, todos los cables/botones incorrectos, cada dígito alterado) y entradas mal formadas = `invalid` (no suman error).
- Reparto de información: ninguna vista contiene claves secretas; el operador nunca recibe colores; el experto no recibe datos de la bomba; el intérprete no recibe reglas.
- **Ningún rol resuelve solo**: variando únicamente los datos que ese rol no ve, la respuesta cambia en >50 % de las mutaciones (operador, experto, intérprete).
- **El analista es imprescindible** en 4v4: **cada uno de sus datos** (parámetro de cada corte, tabla, inversión, pilotos invertidos, modificadores) cambia la respuesta en el 100 % de las bombas; y tiene al menos 2 datos por módulo. En 3v3 los parámetros son los valores fijos del manual.
- Igualdad: ambos equipos reciben la misma bomba y estados iniciales idénticos pero independientes.

**Multijugador (`test/multiplayer.test.js`, WebSocket real)**
- Salas de 6 (3v3) y 8 (4v4): roles únicos, inicio, bombas idénticas, vistas idénticas por rol entre equipos, la semilla no se envía durante la partida, solo el operador puede actuar.
- Errores: alarma → −20 s → explosión; acciones duplicadas cuentan una vez; el otro equipo no se ve afectado; el equipo vivo puede ganar.
- Victoria, resultado, revancha (equipos/roles conservados, estado limpio, semilla nueva, intercambio de roles).
- Temporizador del servidor (reloj acelerado): si nadie desactiva, ambos pierden por tiempo.
- Reconexión: recuperar sesión con token conserva asiento/rol/estado; segunda pestaña sustituye a la primera sin duplicar; token falso rechazado; la partida continúa si el anfitrión se desconecta.
- Modo cooperativo (1 equipo de 3 y de 4): inicio, victoria, derrota por errores, revancha, puestos azules rechazados, cambio de modo, límite de creación de salas por IP.
- Lobby: nombres duplicados, sala llena (8), sala inexistente, inicio con equipos incompletos, analista inválido en 3v3, solo el anfitrión configura, intercambio de puestos, JSON inválido, saneado de nombres, límite de peticiones.

## E2E (`npm run test:e2e`)
8 contextos Chromium con viewport iPhone 13 juegan una partida 4v4 difícil **solo a través de la interfaz**: crear sala, unirse por enlace de invitación, elegir puestos, listos, iniciar, comprobar que el DOM del operador no contiene colores, explosión del equipo azul por 3 errores, el rojo comete 1 error y resuelve los 6 módulos pulsando la UI, pantalla de resultados, revancha con bomba nueva y recarga de página con recuperación de sesión. Falla si hay errores de JS en consola. Genera capturas en `e2e/shots/`. `e2e/coop.mjs` hace lo mismo en modo cooperativo con 3 móviles (fácil) hasta la pantalla de victoria.

## Manuales (no automatizables) — pendientes de hacer con personas
- Partida real con 6–8 personas en sus móviles (iOS Safari y Android Chrome).
- Tiempos por módulo (objetivo 45–120 s con equipo coordinado) y ajuste de `TIME_SCALE`/duraciones.
- Claridad del manual y guía de gestos. Volumen/tono de los sonidos.
- Wifi móvil inestable / cambio de red.
