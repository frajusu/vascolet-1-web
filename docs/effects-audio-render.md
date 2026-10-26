# Efectos, audio y fluidez — 0.2.1

## Cuadrados negros de las partículas

`coinEffect.png` tiene texels negros **opacos** dentro de los fotogramas. No es un atlas de transparencia convencional. El constructor nativo `AnimationEffect` (`004345a0`) compara la clave `POWER` y asigna modo de mezcla 2.

El port usa composición aditiva (`lighter`) para ese sprite. El negro aporta cero a la imagen existente y las estrellas se suman sobre el escenario, como en las capturas originales. El estado del contexto se restaura después; los demás sprites mantienen composición normal.

La duración de los efectos se obtiene de su animación: `POWER` dura 30/30 = 1 segundo; `ENEMY_DEATH`, 32/60. Se eliminó la permanencia fija de 1,2 segundos que mantenía el último fotograma.

## Sonidos recuperados y eventos

`tools/recover-atlas.py --audio-only` emula el registro de sonidos `0041d3f0`, interceptando `0041d230`. `assets/data/audio.json` conserva las 21 claves, archivos, ganancias y direcciones de registro originales.

Ejemplos que antes estaban confundidos:

- `JUMP` usa `jump_vascolet.ogg`; `JUMP_ENEMY` usa `jump.ogg`.
- `ITEM` tiene ganancia 0,6; `POWERUP`, 0,4; las escaleras, 0,5.
- El thrower nativo (`004401a0`, `00440580`) distingue el proyectil: Futuro usa `LASER`, Piratas usa `CANNON` y el resto usa `SHOOT`.
- La muerte de un enemigo usa `EXPLOSION` (`0043f2e0`), no el segundo sonido de muerte del jugador.
- La apertura de puerta también invoca `EXPLOSION` en `00441950`.
- La guillotina invoca su sonido al completar la carrera de bajada (`0043ec00` → callback `0043f260`).

El jugador emite los sonidos al entrar en índices de la **línea temporal** de animación (`004313c0`):

| Animación | Índice | Clave |
|---|---:|---|
| WALK | 2 / 6 | STEP_1 / STEP_2 |
| D_WALK | 3 / 9 | D_STEP_2 / D_STEP_1 |
| CLIMB | 1 / 3 | STAIR_1 / STAIR_2 |

Estos no son números de celda del atlas. El descenso por una escalera recorre la animación hacia atrás; la detección de cruces contempla esa dirección y la vuelta del bucle. Al detenerse, la escalera conserva el fotograma y deja de emitir pasos.

## Reproducción

Los 21 efectos se descargan y decodifican antes de dar control al jugador. WebAudio inicia fuentes de buffer al producirse el evento, sin crear y decodificar un elemento multimedia nuevo en cada recogida/paso.

Se conserva una voz por clave nativa: `0041d380` detiene y reinicia el sonido con el mismo nombre. Las claves diferentes pueden mezclarse. Sus ganancias originales se aplican antes del volumen general de efectos.

La música sigue transmitiéndose mediante audio HTML. Los gestos de teclado/mouse desbloquean el contexto y reintentan la música bloqueada por autoplay. Pausa y muerte cancelan eventos antiguos; no se reproduce una cola acumulada al volver. Los cambios de volumen/mute afectan a efectos que ya estén sonando y son independientes de la música.

## Render de alta frecuencia

La simulación conserva un paso fijo de **1/60 s**. El render se ejecuta en cada `requestAnimationFrame` y dibuja una interpolación entre los estados anterior y actual para jugador, enemigos, plataformas, proyectiles, apertura de puertas y relojes visuales.

No se extrapolan posiciones ni se cambia el estado de colisiones/guardado. Los sonidos se disparan en simulación, nunca desde el render. Los cambios de habitación, apariciones y reapariciones invalidan la interpolación para mantener los cortes originales.

Los dibujos de las animaciones conservan la frecuencia del original; se suaviza su desplazamiento, no se inventan fotogramas intermedios del arte. La cantidad de presentaciones queda ligada a la frecuencia de la pantalla/navegador, sin un límite de render a 60 Hz.

## Verificación

- Pruebas de cadencia a 60, 120 y 144 Hz: misma posición física y exactamente los mismos eventos de pasos, con posiciones visuales intermedias en alta frecuencia.
- Pruebas de no interpolar a través de cortes, respawn o cambios de animación.
- Prueba Canvas de los 30 fotogramas de `POWER`: ningún píxel oscurece el fondo de color; las estrellas sí lo iluminan y no se filtra el modo de mezcla al siguiente sprite.
- Prueba de señal real en un `AnalyserNode`: el efecto `ITEM` decodificado produce una onda no nula en el navegador.
- Pruebas de recogida única, pasos en sus índices, expiración de partículas y render intermedio que no modifica física ni dispara sonidos adicionales.
- Regresiones visuales previas de menús e inicios de las cinco épocas.

La cadencia de 120/144 Hz se prueba con un reloj controlado; no es una medición de rendimiento de todos los monitores/GPU. Los contadores y el analizador son interfaces de prueba, sin añadir elementos a la página del juego.
