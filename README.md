# Vascolet 1 — La máquina del tiempo

Port web **no oficial** del juego de Batoví de 2010, hecho en **JavaScript + Canvas** a partir de los mapas, imágenes y audio originales, y del análisis de su ejecutable C++.

**[Jugar en el navegador](https://frajusu.github.io/vascolet-1-web/)** · [Método de recuperación](docs/reverse-engineering.md) · [Estado y pruebas](docs/status.md)

## Jugar

| Control | Acción |
|---|---|
| ← / → o A / D | Caminar |
| Espacio o Z | Saltar; volver a pulsar en el aire tras recoger Cereales |
| ↑ / ↓ o W / S | Subir y bajar escaleras |
| ↓ + Espacio | Bajar de una plataforma de una sola cara |
| Esc | Pausa |
| Enter / Espacio | Confirmar en menús |
| Botones en pantalla | Controles táctiles en teléfonos/tabletas |

Recoge Vascolet para aumentar el salto y Cereales para habilitar/mejorar el doble salto. Cada 2.000 puntos ganas una vida. Las puertas consumen llaves de su color. Encuentra el microondas para viajar a la siguiente época.

Hay diez vidas iniciales y puntos de salvado dentro de los niveles. El progreso, los objetos recogidos, las puertas abiertas y las opciones se guardan en este navegador. **Continuar** recupera la última aventura. El selector permite explorar cualquiera de las cinco épocas; entrar de nuevo por el selector inicia esa época desde su entrada.

## Contenido

- Los **cinco mapas TMX completos**: Prehistoria, Egipto, Piratas, Castillo y Futuro, con **1.680 objetos** definidos por los autores.
- Gráficos, carteles, ilustraciones de historia, créditos, música y efectos originales.
- **104 entradas de atlas** utilizables, recuperadas de 109 registros del ejecutable; **57 animaciones / 259 entradas de fotograma**, incluidos sus tiempos.
- Movimiento y saltos con constantes recuperadas, escaleras, plataformas de una sola cara y plataformas móviles.
- Monedas, vidas, mejoras, llaves, puertas, guardado y cambio de época.
- Controladores para enemigos terrestres, aves, saltadores, pirañas, cañones, guillotinas, estalactitas y meteoritos.
- Menú, introducción, selección de épocas, pausa, opciones de volumen/filtrado, ayuda, créditos y final.
- Publicación estática con módulos empaquetados y nombre versionado; no requiere servidor de aplicación.

**Estado:** versión jugable en desarrollo. Los recursos y las definiciones de animación proceden del original; parte de la física de contacto, la IA, la cámara y la interfaz siguen siendo reconstrucciones. Las pruebas verifican entradas de los cinco mapas y mecánicas mediante situaciones controladas, además de marcha/salto con teclado y movimiento táctil reales. Todavía no certifican una campaña completa recorrida de manera natural ni equivalencia exacta con Windows. [Detalle de fidelidad](docs/status.md).

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

Las pruebas de navegador usan Edge/Chrome, un Chromium ya descargado por Playwright, o la ruta `BROWSER_EXECUTABLE`. Para instalar un navegador de pruebas en una máquina nueva:

```sh
node node_modules/playwright-core/cli.js install chromium
```

Para servir el artefacto publicable: `npm run serve -- --built`. La carpeta `_site/` es el sitio estático. El workflow de GitHub Actions ejecuta las pruebas y despliega GitHub Pages.

## Estructura

```text
assets/                   recursos originales y manifiestos recuperados
js/tmx.js                 TMX base64 little-endian, propiedades y textos
js/assets.js              carga y reproducción de atlas/animaciones
js/physics.js             colisiones, plataformas, escaleras y constantes
js/game.js                campaña, jugador, objetos y enemigos
js/render.js              Canvas, pantallas de 16 × 12 tiles y HUD
js/main.js                estados, menús, pausa y arranque
js/input.js audio.js save.js
analysis/                 inventarios, hashes y evidencias de recuperación
tools/                    extracción reproducible, Ghidra y pruebas
docs/                     método, procedencia y estado de fidelidad
```

## Procedencia

Se tomó como referencia **el método** de [Vascolet 4 web](https://github.com/frajusu/vascolet-4-web/): recursos originales + análisis del binario + implementación web comprobable. Este es un proyecto independiente.

La extracción de atlas usa emulación acotada de los constructores de recursos, interceptando todas las llamadas. Las constantes y animaciones conservan direcciones de procedencia. No se distribuye el ejecutable de Windows ni hace falta para jugar el port. [Cómo repetir el análisis con tu copia](docs/reverse-engineering.md).

## Créditos y licencia

**Vascolet: La máquina del tiempo**, sus personajes, marcas, gráficos, mapas, música y demás recursos pertenecen a sus respectivos titulares; el juego original fue desarrollado por **Batoví Games Studio**. Se conservan sus créditos originales dentro del juego.

El código nuevo de este port se publica bajo MIT, según `LICENSE`. Esa licencia no concede derechos sobre los recursos ni las marcas originales. Port de preservación y homenaje, no afiliado a Batoví ni a Nestlé.
