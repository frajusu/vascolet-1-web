# Vascolet 1 — La máquina del tiempo

**[Jugar](https://frajusu.github.io/vascolet-1-web/)** · [Observación del original](docs/reverse-engineering.md) · [Estado de correspondencia](docs/status.md) · [Plan para continuar](docs/CONTINUAR.md)

Port web no oficial del juego de Batoví de 2010, en JavaScript y Canvas.

La página muestra **solamente el juego sobre fondo negro**, como Vascolet 4 web. Menú, opciones, ayuda, créditos, selector, HUD, pausa y confirmación están dentro del juego y siguen las pantallas observadas del ejecutable Windows.

**0.2.1:** partículas aditivas sin cuadrados negros, efectos de sonido predecodificados con sus volúmenes/eventos nativos y movimiento interpolado a la frecuencia de la pantalla, conservando física de 60 Hz. [Detalle y pruebas](docs/effects-audio-render.md).

![Windows original a la izquierda; port web a la derecha](docs/native-comparison.jpg)

## Correspondencia con Windows

La versión 0.2 reemplaza las aproximaciones visuales de la primera versión por datos obtenidos **ejecutando el original**:

- **434 salas capturadas** con su renderer Direct3D: 71 de Prehistoria, 83 de Egipto, 72 de Castillo, 132 de Piratas y 76 de Futuro.
- **1.674 objetos** vinculados uno a uno con el TMX, con posición, caja física y habitación leídas de memoria del original. Los seis registros del jugador permanecen en los mapas originales.
- **11 grupos de atlas de interfaz** leídos de las estructuras del juego en ejecución.
- **137 caracteres** y avances de la fuente bitmap original.
- **104 entradas de atlas y 57 animaciones**, recuperadas del ejecutable.
- Dinosaurio en Prehistoria, personaje normal en Egipto/Castillo/Piratas y patineta en Futuro.
- Orden original: **Prehistoria → Egipto → Castillo → Piratas → Futuro**.
- Región visible de **1200 × 900**, con habitaciones de 16 × 12 tiles; el port conserva el recorte del original en lugar de hacer zoom para mostrar 1216 × 912.

La comparación de las 434 salas puntúa **el mundo estático**, excluyendo actores móviles, jugador, HUD y texto. Su error RGB medio por época quedó entre **1,2 y 1,8 sobre 255**; eso no es una certificación de física o IA idénticas. Las pruebas de navegador también comparan menús e inicios con PNG del original. [Resultados y límites](analysis/native-validation.json).

## Controles

| Tecla | Acción |
|---|---|
| ← / → | Caminar |
| Espacio | Saltar; volver a pulsar en el aire tras recoger Cereales |
| ↑ / ↓ | Escaleras |
| Esc | Pausa |
| Click | Botones originales del juego |
| Cualquier tecla / click | Avanzar las ilustraciones |

Vascolet mejora el salto; Cereales habilita/mejora el doble salto. Las puertas consumen las llaves de su color. Los puntos de salvado permiten reanudar desde la época correspondiente. Las opciones originales separan música y efectos y permiten pantalla completa y estirar la imagen.

## Desarrollo

Node.js 22 o posterior:

```sh
npm ci
npm run serve
# http://127.0.0.1:8124
```

```sh
npm test
npm run build
npm run test:browser -- --built
```

Las pruebas usan Chrome/Edge, Chromium de Playwright o `BROWSER_EXECUTABLE`. Para preparar un navegador de pruebas:

```sh
node node_modules/playwright-core/cli.js install chromium
```

`_site/` es el sitio publicable; GitHub Actions verifica y despliega GitHub Pages.

Para regenerar capturas y comparaciones con una copia local del original en `../Vascolet1/`, consultar [el procedimiento](docs/reverse-engineering.md). `npm run compare:native` genera las vistas comparativas y `npm run compare:scenes` contrasta las 434 capturas locales.

## Estado

La presentación y geometría se contrastaron con el original. **Todavía falta certificar un recorrido natural completo y equivalencia temporal de toda la IA, contactos, plataformas y transiciones.** Las pruebas de mecánicas utilizan situaciones controladas y lo declaran. [Detalle de lo verificado y lo pendiente](docs/status.md).

## Créditos

El juego original fue desarrollado por **Batoví Games Studio**. Vascolet, personajes, marcas, mapas, imágenes, música y demás recursos pertenecen a sus respectivos titulares. Se conservan los créditos originales dentro del juego.

El código nuevo del port se publica bajo MIT (`LICENSE`); esa licencia excluye los recursos y marcas originales. Proyecto no oficial de preservación, no afiliado a Batoví ni a Nestlé.
