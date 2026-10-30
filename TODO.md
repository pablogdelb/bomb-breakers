# Pendiente / mejoras (fuera del producto mínimo)

## Conocido
- **Salas en memoria**: si el servidor se reinicia o se duerme (plan gratuito), las salas se pierden. Persistencia (Redis/Postgres) permitiría varias instancias.
- Si un jugador no vuelve en una partida en curso, su equipo no puede progresar (no hay sustitución). Sala de espera: el asiento se libera tras 60 s.
- Los tiempos (12/10/8 min) y la dificultad no se han ajustado con personas reales.
- Sin chat/voz por diseño (la comunicación es presencial).
- Fuentes desde Google Fonts (si no cargan, hay tipografías de respaldo).
- Accesibilidad daltonismo: los colores llevan abreviatura (R, AZ, V, AM) pero sería deseable un modo de patrones.
- Espectadores y más de 8 jugadores no soportados.

## Ideas
Más mecanismos, modos de juego, estadísticas/clasificaciones, editor de bombas, PWA instalable, sonidos con ficheros de audio, partidas con tiempo compartido real entre equipos.
