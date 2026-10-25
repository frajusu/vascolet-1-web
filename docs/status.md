# Correspondencia y verificación — 0.2

## Correcciones sobre la primera versión

- Retirada la interfaz de página añadida: cabecera, marco, pie, cronología, botones externos y controles táctiles superpuestos.
- Menú original con `Jugar`, `Opciones`, `Ayuda`, `Creditos`, `Salir`; opciones originales con música/efectos, mute, pantalla completa y estirar.
- HUD de franja completa, fuente bitmap, pausa `Jugar/Salir` y confirmación original.
- Recorte correcto de las ilustraciones a 1200 × 900 y dibujo por habitaciones, sin líneas entre tiles.
- Orden nativo de las épocas, dinosaurio en Prehistoria y patineta en Futuro.
- Reemplazadas las cajas/posiciones inferidas por las 1.674 registradas en ejecución nativa.
- Contacto de 0,49, integrador analítico, límite vectorial de velocidad, cruce de ventana y secuencia de muerte/reaparición contrastados con código y ejecución.

## Qué se observó de verdad

El ejecutable Windows se ejecutó con entrada privada y captura de backbuffer. Se registraron sus pantallas de interfaz, introducciones, cinco entradas de nivel, selector, muerte y reaparición, así como **todas las 434 salas con tiles distintos de relleno** de los cinco mapas.

Para recorrer todas esas salas se usó un fixture: activar la habitación con el código nativo, colocar al jugador y habilitar no-daño en una copia temporal. Se verificó el índice de habitación activo en cada captura. Esto **no equivale a atravesar naturalmente los escenarios**.

## Comparación de las 434 salas

`tools/compare-scenes.mjs` dibuja en web la misma sala y calcula error RGB frente a la captura del original:

| Época | Salas | MAE estático medio, escala 0–255 |
|---|---:|---:|
| Prehistoria | 71 | 1,44 |
| Egipto | 83 | 1,77 |
| Castillo | 72 | 1,49 |
| Piratas | 132 | 1,22 |
| Futuro | 76 | 1,31 |

El puntaje estático excluye jugador, actores móviles, HUD y la franja de texto. Las referencias de este barrido son JPEG; su compresión aporta parte del error. No se convierte el MAE en un porcentaje de fidelidad del juego.

La cámara se fija a la misma sala para comparar renderers. Si una colocación de emergencia dentro de relleno sólido produce una despenetración distinta en web, se conserva como diferencia separada en el informe; no se compara por error una sala con su vecina. Los metadatos conservan el área de píxeles efectivamente comparada.

Resultados: `analysis/scene-comparison.json` y resumen `analysis/native-validation.json`. Las 434 imágenes completas quedan en el laboratorio local y se regeneran con `tools/survey-original.py`.

## Pruebas automáticas

### `npm test`

Diez grupos verifican mapas, hashes, atlas, animaciones, constantes binarias, suelo/techo/plataformas/puertas, correspondencia de cada objeto nativo, integración y bordes de ventana, fuente/atlas UI y estados rasterizados, además de textos y guardados.

### `npm run test:browser -- --built`

- Página de Canvas sin decoración añadida y menú con los cinco botones nativos.
- Regresiones visuales contra PNG capturados del original: menú, opciones, ayuda, créditos, selector e inicio de las cinco épocas.
- Música/efectos separados, mute, fullscreen y estirar.
- Introducción, marcha y salto con teclado real; pausa y confirmación de salida.
- En cada mapa: recogida de mejoras, doble salto, consumo de llave/puerta, checkpoint, muerte, espera/caída/reaparición y recogida de microondas.
- Reanudación del checkpoint desde su tarjeta de época tras recargar.
- Página pequeña sin interfaz externa ni desbordamiento horizontal.
- Sin errores JavaScript ni respuestas HTTP fallidas durante la prueba.

Los casos de objetos, puertas, peligros y salida son **fixtures controlados**, no una campaña recorrida por un bot. La interfaz de fixtures solo existe con `?test=1`.

## Límites que siguen abiertos

1. **IA y contactos:** cajas, parámetros y animaciones son originales, pero hace falta cerrar equivalencia temporal de cada especie, rebote, detección y condición de derrota.
2. **Plataformas/peligros:** quedan curvas, activación, tiempos y RNG por verificar en recorridos continuos. El generador de meteoritos del port todavía no reproduce el RNG original.
3. **Texto:** se usa la fuente original; quedan casos de caracteres dañados en los XML y detalles de composición multilínea que requieren contraste adicional.
4. **Transiciones:** el efecto de microondas y sus recursos se recuperaron. La navegación posterior del port no está certificada como idéntica a todos los callbacks/tiempos nativos; las capturas de laboratorio de final de época se conservan para continuar el análisis.
5. **Campaña:** aún no se certificó un recorrido natural completo con todas las rutas y secretos, ni la equivalencia total del guardado nativo. La persistencia web usa su propio formato.

La cobertura visual estática y las pruebas no se presentan como una descompilación completa o una certificación de comportamiento idéntico del 100 % del juego.
