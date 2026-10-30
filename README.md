# BOMB BREAKERS

Juego web multijugador para 6 u 8 personas con el móvil en la mano: dos equipos (3 o 4 jugadores) compiten por desactivar **la misma bomba**. Cada jugador tiene un rol con información distinta y la comunicación es **presencial**: gestos y palabras según las restricciones del rol.

| Rol | Alias | Ve | Puede |
|---|---|---|---|
| Operador | El ciego | La bomba en gris (el servidor ni siquiera le envía los colores) | Manipular la bomba. Habla y oye |
| Experto | El mudo | El manual con las reglas del módulo | No habla: solo gestos |
| Intérprete | El sordo | La bomba a color | Habla al operador, gestos al experto; no usa lo que oye |
| Analista (solo 4v4) | — | Parámetros técnicos | Solo gestos al experto |

Flujo: **intérprete → (gestos) experto → (gestos) intérprete → (voz) operador → bomba**.

## Ejecutar

```bash
npm install
npm start            # http://localhost:3000
```

Para jugar en red local abre `http://<IP-de-tu-ordenador>:3000` en los móviles (misma wifi). Para jugar por internet, ver [DEPLOY.md](DEPLOY.md).

## Cómo se juega
1. Una persona pulsa **CREAR SALA** y comparte el código de 6 caracteres o el enlace (`https://tu-sitio/ABC123`).
2. Todos entran con un nombre (sin registro), eligen equipo y rol tocando un puesto (si está ocupado, se intercambian) y pulsan **ESTOY LISTO**.
3. El anfitrión elige 3v3 / 4v4 y dificultad, y pulsa **INICIAR**. Cuenta atrás de 5 s.
4. Gana el primer equipo que desactiva todos los módulos. Pierde el equipo que agota el tiempo o los errores.
5. **JUGAR REVANCHA** vuelve a la sala con los mismos equipos/roles (se pueden intercambiar roles o mezclar equipos) y una bomba nueva.

| | Fácil | Normal | Difícil |
|---|---|---|---|
| Tiempo | 12 min | 10 min | 8 min |
| Módulos | 3 | 4 + protocolo final | 5 + protocolo final |
| Errores | 4 (alarma, alarma, −20 s, explosión) | 3 (alarma, −20 s, explosión) | 3 |

## Minijuegos
Cables encadenados · Caja fuerte · Simón corrompido · Circuito de emergencia (sistema lineal sobre GF(2)) · Jeroglíficos · Protocolo final. Cada uno implementa `generate(seed, difficulty, teamSize)`, `projectForRole`, `validateAction`, `solve` (`server/engine/`). Las reglas exactas están en el manual en pantalla (`public/js/manual.js`) y en los tests.

## Arquitectura
- **Servidor Node.js + WebSocket (`ws`)**, autoritativo: salas, roles, bomba, temporizador, errores, victoria y reconexión. Sirve también el cliente: **un único servicio y un único enlace**.
- **Cliente** en ES modules + SVG, sin paso de build, pensado para móvil.
- **Seguridad**: soluciones solo en el servidor; cada rol recibe una proyección de datos (no CSS). El operador recibe una vista sin colores. Tokens de sesión aleatorios (se guarda solo su hash). Validación y límite de mensajes, deduplicación de acciones.
- Estado de las salas **en memoria** (una instancia). Ver decisiones y limitaciones abajo.

### Decisiones respecto al documento maestro
- **Node + `ws` en lugar de Supabase/Vercel**: el propio documento lo permite. Un servicio con estado en memoria es más simple y fiable para tiempo real de baja latencia. Por eso no hay migraciones SQL (las tablas del §11 se corresponden con las estructuras de `server/room.js`).
- **Contradicción rol sordo/operador**: el intérprete (sordo) no puede usar información oral, pero el operador debe transmitir identificadores al experto en el Protocolo final. Solución: el operador puede hablar; el experto (mudo, no sordo) lo oye; el intérprete lo ignora.
- **Protocolo con 5 módulos** (difícil): usa los 4 últimos módulos; la lista aparece etiquetada en las pantallas.
- **Temporizador compartido**: todos comparten el instante de inicio; cada equipo tiene su límite (las penalizaciones solo afectan al equipo que falla).
- **Fin de partida**: termina en cuanto un equipo desactiva; si ambos fallan, pierden los dos.
- Seats fijos: para iniciar hay que ser exactamente 6 u 8 jugadores con todos los puestos ocupados.

## Variables de entorno
Ver `.env.example` (todas opcionales; no hay secretos).

## Tests
```bash
npm test         # motor + multijugador (WebSocket real)
npm run test:e2e # 8 navegadores móviles Chromium jugando una partida completa por la interfaz
```
Ver [TEST_PLAN.md](TEST_PLAN.md). Limitaciones y pendientes: [TODO.md](TODO.md).
