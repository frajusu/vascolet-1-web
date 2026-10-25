# Observación y reconstrucción del original

## Copia de referencia

Se utilizó `../Vascolet1/Vascolet.exe`, con sus recursos instalados. Su SHA-256 es:

```text
7f4b9ff4d18846214a33793989ca15171e0f56fa39094596b24fd646f587fd71
```

Coincide con el ejecutable extraído del instalador NSIS examinado inicialmente. Los 76 recursos originales importados también coinciden por hash (`analysis/inventory.json`). El port no necesita el EXE para funcionar.

## Ejecutar y mirar, antes de interpretar

`tools/native-observe.py` prepara una copia en `%LOCALAPPDATA%/Temp/opencode/vascolet1-native-reference` y la ejecuta en un escritorio Win32 no seleccionado. Captura el backbuffer Direct3D y suministra teclado/mouse privados. El escritorio visible y sus entradas no se utilizan.

El laboratorio de IO se toma, **en lectura**, de `../vascolet-web/tools/native-isolated/`. Se compila una adaptación temporal para Vascolet 1:

- Mouse por mensajes despachados en el propio hilo/escritorio del juego.
- Semántica privada correcta de `ShowCursor(FALSE)`; el motor de Vascolet 1 espera un resultado negativo.
- Captura ampliada a 16 MiB y tratamiento de ASLR para lecturas de memoria.
- Perfil de guardado temporal y cierre del proceso mediante Job Object.

El EXE copiado conserva su hash. Para la inspección sistemática se modifican **solamente estados del proceso temporal**: progreso desbloqueado para usar su selector real, activación de una habitación con el código original y colocación del jugador. El barrido habilita el flag de no-daño para que una colocación de laboratorio no interrumpa la captura. Los informes identifican esas situaciones como fixtures.

## Las 434 salas

`tools/survey-original.py` entra a cada época por la interfaz del original. Reconoce las ilustraciones comparándolas con sus recursos y avanza hasta el juego. Después activa y captura cada habitación que tiene tiles distintos del relleno del mapa.

| Época | Salas originales capturadas |
|---|---:|
| Prehistoria | 71 |
| Egipto | 83 |
| Castillo | 72 |
| Piratas | 132 |
| Futuro | 76 |
| **Total** | **434** |

En las 434 capturas se comprobó que la habitación activa del original coincidiera con la solicitada. Las imágenes completas del barrido quedan localmente en `analysis/native-reference/world/<época>/rooms/`; los índices e informes documentan la cobertura.

No se trata de un bot que haya recorrido naturalmente la campaña: la colocación de laboratorio está declarada.

## Posición y cajas reales de los objetos

El TMX describe 1.680 objetos, seis de ellos registros del jugador. El cargador nativo transforma las coordenadas y usa plantillas de cajas físicas por entidad; interpretar literalmente ancho/alto del TMX o derivar la caja del tamaño del sprite daba resultados incorrectos.

Se recorrieron las listas de `InteractiveObject` del juego en memoria y se vinculó su orden con los objetos del XML, excluyendo `Vascolet`:

- Caja base local, dimensiones y habitación propietaria.
- Posición de presentación y vtable de la clase nativa.
- Correspondencia de cada `Item` con su clave original.

`assets/data/native-objects.json` contiene las **1.674 correspondencias**, sin direcciones de heap transitorias. `js/game.js` carga esas cajas y posiciones; no sustituye los mapas ni inventa rectángulos. Egipto usa el último registro del jugador del XML, confirmado por la entrada observada.

Las entidades se muestran y actualizan en su habitación propietaria. La activación reinicia posiciones/temporizadores pertinentes; `pIsKey` conserva los estados persistentes.

## Interfaz observada

El mapa de recursos `AssetsGeneral` se leyó del proceso. `assets/data/ui-atlas.json` contiene sus 11 grupos: botones, opciones, pausa, fondos y componentes del HUD, con recortes y pivotes reales.

La tabla de 137 caracteres procede de `00443070` y sus avances se calculan ejecutando en Unicorn la función `00442e50`. `assets/data/font.json` permite dibujar el texto con la fuente original, sin sustituirla por una fuente de navegador.

Se observaron menú, opciones, ayuda, créditos, ilustraciones, selector, HUD, pausa, confirmación, muerte y reaparición. El selector conserva sus estados rasterizados del original en `assets/gui/native/`: estados desbloqueados y fondos de hover. Se hornean con `tools/build-native-skins.py` para conservar exactamente la composición, escala y filtrado del original. Los puntos se actualizan sobre esa base; las zonas de interacción no son decoración HTML visible.

Los JPG originales contienen imagen de **1200 × 900** y padding hasta 2048 × 1024. El recorte anterior de 1172 × 879 era incorrecto.

## Atlas y animaciones del mundo

`tools/recover-atlas.py` emula únicamente constructores de recursos del PE, interceptando sus llamadas. No invoca Windows ni el bucle del juego:

| Dirección | Datos |
|---|---|
| `0042cd10` | Descriptores del jugador |
| `00438be0` | Enemigos y efectos |
| `00418100` | Objetos |
| `00419b20` | Elementos, carteles y puertas |
| `0042b3c0` | Animaciones del jugador |
| `00434760` | Animaciones de enemigos/efectos |

Resultado: 109 registros de descriptor, con **104 entradas utilizables**, y **57 animaciones / 259 entradas de fotograma**. Las pruebas verifican que cada índice cabe en la textura correspondiente. Los JSON conservan direcciones de procedencia.

## Movimiento y presentación

Evidencias en `analysis/native-constants.json` y funciones consultadas:

- Gravedad 1800 (`0050a7c0`), marcha 250 (`0050a7c4`), escalera 150 (`0050a820`).
- Caja del jugador 50 × 90 (`004eef3c`, `004eef38`).
- Salto: 600, 700, 790, 810, 850; doble salto: 0, 640, 680, 720, 760.
- Límite de magnitud de velocidad 1500 (`004ea3c8`).
- Integración analítica `v·dt + a·dt²/2`, seguida por velocidad (`00447290`).
- Separación de contacto de 0,49; ventana de 1200 × 900 dentro de habitaciones de 16 × 12 tiles.
- Cruce por bordes y activación de habitación (`00432320`, `004279d0`); no se usa una cámara suave inventada.
- Precedencia de tipo de tile (`00428bd0`): duro, escalera, fin de escalera, plataforma, letal.
- Muerte observada: espera de un segundo, impulso -800, caída con gravedad y reaparición tras salir por debajo de la ventana +500 (`004333f0`, `00432a30`). La vida se descuenta al reaparecer.

Se confirmó visualmente `D_` en Prehistoria y `P_` en Futuro. La fuente, geometría y recortes son datos recuperados; esto no certifica automáticamente todos los estados de IA y contactos.

## Reproducción local

Requiere Windows, Visual Studio Build Tools x86/Windows SDK, el laboratorio de referencia de Vascolet 4 y la copia instalada de Vascolet 1:

```sh
python -m pip install -r tools/requirements.txt
python tools/native-observe.py --build
python tools/survey-original.py
```

Para las escenas de interfaz, usar los planes `analysis/native-*.plan.json`; por ejemplo:

```sh
python tools/native-observe.py --plan analysis/native-selection-skins.plan.json --output analysis/native-reference/selection-skins
python tools/build-native-skins.py
```

Los planes exploratorios pueden depender del progreso del perfil temporal. El barrido sistemático fuerza el selector y reconoce las ilustraciones en vez de depender de un número fijo de Enter.

La recuperación de atlas necesita un índice completo de funciones de Ghidra (`address`, `name`, `size`). `tools/ExportVascoletGame.java` exporta ese índice y pseudocódigo del intervalo principal. `tools/import-native-reference.py` integra las tablas observadas y usa la exportación `analysis/native/00443070.c` para el orden de caracteres.

```sh
python tools/extract-original.py
python tools/recover-atlas.py --index RUTA_A_funciones.tsv
python tools/import-native-reference.py
npm run compare:native
npm run compare:scenes
python tools/build-evidence.py
```

Los informes separan comparación visual estática, fixtures de mecánicas y aspectos temporales pendientes. [Estado detallado](status.md).
