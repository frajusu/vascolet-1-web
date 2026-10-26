# Punto de continuación

## Estado que debe conservarse

La página es solamente Canvas sobre negro. La interfaz corresponde al juego: no volver a añadir cabeceras, cronologías, marcos, pies, mensajes propios ni controles visibles ajenos al original.

La versión 0.2 es jugable. Menús, opciones, HUD, pausa, confirmación y selector se reconstruyeron con atlas/fuente leídos en ejecución y estados rasterizados observados. Prehistoria usa `D_` (dinosaurio); Futuro usa `P_` (patineta). Orden: Prehistoria, Egipto, Castillo, Piratas, Futuro.

La revisión 0.2.1 añade composición aditiva para `POWER`, caché WebAudio de los 21 efectos/ganancias originales, pasos/escaleras por índices de animación y render interpolado con simulación fija de 60 Hz. No volver a reproducir sonido desde el render ni a pintar `POWER` en mezcla normal. Ver `effects-audio-render.md` y las pruebas nuevas.

Se capturaron las **434 salas** y se cotejó su mundo estático. `assets/data/native-objects.json` contiene la correspondencia de los **1.674 objetos** no-jugador con sus cajas/posiciones reales. No volver a inferirlas del ancho/alto del TMX ni del dibujo del sprite.

## Primero al retomar

1. Leer `docs/status.md`, `analysis/native-validation.json` y este archivo.
2. Ejecutar `git status` para identificar cambios posteriores del usuario.
3. Arrancar `npm run serve` y contrastar el punto que se vaya a modificar con el Windows original, no con recuerdos de Vascolet 4 ni con decisiones de diseño propias.
4. Acotar una diferencia, medirla, corregirla y volver a comparar. No llamar «exacto» a algo que solo tiene una implementación aproximada.

## Trabajo pendiente, en orden

### 1. Cerrar el callback de final de época

- Referencias: `analysis/native-exit.plan.json`, capturas locales `analysis/native-reference/exit/`, funciones `00433b00`, `00432a30`, `0040c830` y el estado padre de `InGame`.
- Se observó la desaparición del personaje/microondas y el efecto `POWER`; las capturas con colocación de laboratorio permanecieron en la sala después del efecto. El port actualmente reproduce el efecto durante un segundo y navega al selector/final. **Esa navegación temporal no está certificada.**
- Repetir la llegada usando controles normales desde una posición cercana y observar los callbacks, flags, guardado y audio. Distinguir un problema del laboratorio de un comportamiento del juego. Resolver esto antes de añadir otra pantalla o inventar un mensaje.

### 2. Comparar comportamiento por familia de enemigos

- Empezar por los dos primeros cuartos de Prehistoria: dinosaurios y erizo. Luego escorpiones/momias, templarios, piratas, robots, aves, saltadores y pirañas.
- Registrar por tick posición, velocidad, estado, habitación y animación del proceso original con ASLR resuelto.
- Contrastar giro en paredes/bordes, `pCollidesFloor/H/V`, derrota por salto y persistencia `pIsKey` al salir y reentrar.
- Conservar las cajas observadas; corregir los estados/contactos y temporizadores, no «ajustar a ojo» la geometría.

### 3. Plataformas y peligros

- Comparar `Platform` y `PlatformInterp` con sus curvas, esperas, transporte del jugador y reinicio al activar habitación.
- Medir guillotinas, estalactitas, cañones/proyectiles y meteoritos. El RNG de meteoritos del port sigue siendo propio.
- Verificar colocaciones de fixture dentro de relleno sólido: las diferencias de despenetración quedan registradas en el informe, aunque el renderer se compara con la cámara fijada a la misma sala.

### 4. Texto y composición

- Usar `assets/data/font.json` y `ui-atlas.json`; no reemplazar la fuente por CSS.
- Revisar caracteres dañados de ciertos XML y el fallback del `GameFont` nativo antes de normalizarlos. Quedan pequeñas diferencias de alineación multilínea.
- Conservar el recorte de imágenes **1200 × 900**, no el antiguo 1172 × 879.

### 5. Guardado y recorrido natural

- La web usa `vascolet-1-web:native-v2` y reanuda el último checkpoint desde su tarjeta de época. No pretende reproducir todavía toda la estructura de guardado nativa por época.
- Verificar guardado, llaves consumidas y objetos persistentes tras muerte, salida, recarga y cambio de época.
- Completar una ruta continua de las cinco épocas con teclado normal, incluyendo mejoras, llaves, microondas y secretos. Los fixtures actuales no sustituyen ese recorrido.

## Herramientas y ubicaciones

- Original instalado: carpeta hermana `Vascolet1/`; SHA-256 del EXE `7f4b9ff4d18846214a33793989ca15171e0f56fa39094596b24fd646f587fd71`.
- Laboratorio IO de referencia: `../vascolet-web/tools/native-isolated/`, utilizado en lectura. Vascolet 4 no se modifica.
- Copia ejecutable de trabajo: `%LOCALAPPDATA%/Temp/opencode/vascolet1-native-reference/`.
- Capturas completas locales: `analysis/native-reference/world/<época>/rooms/`. Los índices `scenes.json` documentan la cobertura; las imágenes extensas se regeneran.
- Ghidra del análisis inicial: carpeta hermana `vascolet1-analisis/`. El pseudocódigo local está en `analysis/native/` y no es código fuente original recompilable.
- `tools/native-observe.py`: build del adaptador y ejecución de planes; `tools/survey-original.py`: barrido robusto de salas, reconociendo las introducciones.
- Las colocaciones y el no-daño son explícitos en los informes. `normalDamage` vuelve al daño normal para observar muerte. El juego usa un mutex global: ejecutar las sesiones nativas **en secuencia**.

## Reglas ya recuperadas que no deben perderse

- Gravedad 1800, marcha 250, escalera 150, caja del jugador 50 × 90 y separación 0,49.
- Integración `v·dt + a·dt²/2`; límite de magnitud de velocidad 1500.
- Ventana 1200 × 900 y habitaciones fuente de 1216 × 912: el salto de habitación conserva esas diferencias, no es una cámara suave.
- La muerte espera un segundo, impulsa a -800 y cae; descuenta la vida al reaparecer. El HUD muestra dos dígitos y puede haber una partida activa con contador 00.
- Las entidades se activan por habitación. `REF` es referencia del editor y la precedencia de tipos de tile no es una suma de flags independientes.

## Verificación para cada cambio

```sh
npm test
npm run build
npm run test:browser -- --built
```

Si cambia renderer, geometría o habitaciones:

```sh
npm run compare:native
npm run compare:scenes
python tools/build-evidence.py
```

Las regresiones visuales de CI usan los diez PNG versionados de `tools/fixtures/native/`, no el laboratorio ignorado. El manifiesto registra sus hashes y las pruebas unitarias comprueban su disponibilidad antes de lanzar el navegador. Para renovar esas referencias desde capturas nuevas: `npm run fixtures:native` y revisar los cambios antes de comitearlas.

El score de 434 salas excluye elementos dinámicos/HUD/texto y **no debe presentarse como prueba de toda la física o IA**.
