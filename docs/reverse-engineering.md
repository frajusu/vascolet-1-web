# Método de recuperación

## Referencia de trabajo

Se consultaron el README, los módulos de lectura TMX, el juego, las herramientas `re_exe.py`, el build y las pruebas de navegador de `vascolet-web` (Vascolet 4). La idea reutilizada es: **cargar datos reales, recuperar los detalles que faltan del binario, implementar las reglas en JavaScript y verificar los resultados**. El proyecto de Vascolet 4 se usó como referencia de lectura.

Vascolet 1 es C++ nativo x86, con RTTI de MSVC, Boost y clases del motor `bat`. A diferencia de Vascolet 4, los atlas y las animaciones principales están definidos en código, no en XML independientes. El enlace PE declara versión 9.0; eso no identifica por sí solo la versión exacta del compilador.

## Copia examinada

| Archivo | Tamaño | SHA-256 |
|---|---:|---|
| Instalador `Vascolet 1 La maquina del tiempo.exe` | 25.798.660 | `91f075da1bcf7065eaf6380a6bbe19051c65857c3c0742673a6de5410d9a444f` |
| Juego extraído `Vascolet.exe` | 1.229.824 | `7f4b9ff4d18846214a33793989ca15171e0f56fa39094596b24fd646f587fd71` |

El primero es NSIS 2. Se extrajo con 7-Zip, sin instalarlo. El paquete contiene 82 archivos; 76 son recursos que se importan para el port. `analysis/inventory.json` contiene sus rutas, tamaños y hashes. Las pruebas comparan esos hashes con los archivos publicados.

## Mapas originales

Los TMX contienen capas base64 de enteros little-endian de 32 bits, sin compresión, tiles de 76 × 76 y un tileset embebido. Se lee la primera capa distinta de `REF`; `REF` es una referencia del editor.

| Mapa | Tiles | Enemigos/peligros | Objetos recogibles |
|---|---:|---:|---:|
| Prehistoria | 576 × 96 | 225 | 132 |
| Egipto | 240 × 204 | 202 | 153 |
| Piratas | 256 × 204 | 92 | 128 |
| Castillo | 224 × 204 | 169 | 148 |
| Futuro | 256 × 204 | 36 | 127 |

También hay 58 plataformas móviles, 61 puertas, 59 puntos de salvado, 84 carteles y seis registros de posición del jugador. Egipto tiene dos registros; el port usa el último en orden de documento, situado junto a la bienvenida de la entrada. Esto sigue siendo una interpretación del cargador que debe contrastarse con ejecución nativa.

`00428bd0` permite distinguir la precedencia de tipos de tile: `pHard`, `pLadder`, `pLadderEnd`, `pPlatform`, `pKilling`. No son cinco flags de colisión simultáneos: el último tipo aplicable sustituye al anterior. El error ortográfico `pPlaftorm` se conserva en el mapa, pero no se interpreta como `pPlatform`.

Las propiedades `pxVel`, `pyVel`, `pxDest`, `pyDest`, `pxDelta`, `pyDelta`, `pDuration`, `pWait`, `pMinTime`, `pMaxTime`, `pRequiredItem` y las demás propiedades permanecen accesibles al runtime. `analysis/maps.json` es el catálogo legible de entidades. Los textos convierten escapes originales como `\a`, `\m` y `\n` a español y saltos de línea.

## Atlas y animaciones dentro del ejecutable

Se analizó el juego con Ghidra 11.2.1 y se exportaron funciones del intervalo principal del juego para orientar la recuperación. `tools/ExportVascoletGame.java` repite esa exportación sobre un proyecto de Ghidra ya importado. La salida es pseudocódigo de análisis, no el fuente original ni un proyecto recompilable.

Después, `tools/recover-atlas.py` carga el PE en **Unicorn x86** y recorre únicamente seis constructores conocidos. **Cada llamada se intercepta**: se modelan operaciones de cadenas, registro de recursos y fotogramas. No se invoca Windows, Direct3D, OpenAL ni el bucle del juego.

| Entrada | Información recuperada |
|---|---|
| `0042cd10` | 9 descriptores del jugador |
| `00438be0` | 55 descriptores de enemigos y efectos |
| `00418100` | 9 descriptores de objetos |
| `00419b20` | 36 descriptores de elementos, puertas y carteles |
| `0042b3c0` | 13 animaciones del jugador |
| `00434760` | 44 animaciones de enemigos y efectos |

Intercepciones relevantes:

- `004033f0`: `ImageMapDesc`, fuente de imagen, rectángulo/grilla y pivote.
- `0042c7a0`: definición de animación y frecuencia.
- `004594c0`: incorporación de una entrada de fotograma y su duración.
- `0042d6a0` / `0041e390`: referencia a un fotograma de un atlas.
- Operaciones de cadenas de MSVC: se reconstruyen los nombres en vez de adivinar la identidad de cada dibujo.

Los 109 descriptores incluyen registros auxiliares `PIXEL` y un fondo de menú. El manifiesto utilizable tiene **104 entradas**. Se recuperaron **57 animaciones y 259 entradas de fotograma**. Las pruebas validan que sus regiones y cada índice caben en las texturas originales.

Archivos resultantes:

- `assets/data/atlas.json`: rectángulos, grillas, pivotes y direcciones de registro.
- `assets/data/animations.json`: secuencias, frecuencias, duraciones y direcciones.
- `analysis/atlas-evidence.json`: registros crudos de los descriptores.
- `analysis/animation-evidence.json`: catálogo de secuencias recuperadas.

Es una recuperación específica de esta compilación: el script comprueba su SHA-256 antes de usar direcciones fijas. Emular los constructores no demuestra por sí solo que toda interpretación del renderer o de los eventos sea exacta.

## Física y habitaciones

`analysis/native-constants.json` conserva valores leídos directamente del PE y sus direcciones. Las pruebas los contrastan con los valores del runtime:

| Dato | Dirección | Valor |
|---|---|---|
| Gravedad | `0050a7c0` | 1800 |
| Velocidad horizontal | `0050a7c4` | 250 |
| Velocidad en escalera | `0050a820` | 150 |
| Caja del jugador | `004eef3c`, `004eef38` | 50 × 90 |
| Salto, 0 a 4 Vascolet | `0050a7d0`, paso 8 bytes | magnitudes 600, 700, 790, 810, 850 |
| Doble salto, 0 a 4 Cereales | `0050a7f8`, paso 8 bytes | magnitudes 0, 640, 680, 720, 760 |
| Habitación | `004eee0c`, `004eedd0` | 16 × 12 tiles |
| Región nativa de presentación | `004eef78`, `004eee64` | 1200 × 900 |

El port conserva coordenadas TMX de 76 px, divide el mapa en habitaciones de 1216 × 912 y las adapta a Canvas 800 × 600. El ajuste exacto de la región nativa de 1200 × 900 y las transiciones entre habitaciones aún necesita comparación visual con Windows.

Otras evidencias consultadas: `004313c0` para estados/saltos; `0042d8d0` para diez vidas iniciales; carteles del mapa para 2.000 puntos por vida; `00441950` y `004343f0` para apertura y consumo de llaves.

## Repetir la extracción

No se necesita Python ni el EXE para ejecutar el port, solamente para regenerar los manifiestos. Con una copia local extraída del mismo juego:

```sh
python -m pip install -r tools/requirements.txt
python tools/extract-original.py --source RUTA_A_LA_CARPETA_EXTRAIDA
```

Para el análisis Ghidra, importar `Vascolet.exe` en un proyecto, ejecutar el análisis automático y ejecutar `tools/ExportVascoletGame.java` con la carpeta de salida como argumento. Exporta `funciones.tsv` con las columnas `address`, `name`, `size`, además del pseudocódigo del intervalo principal del juego. Después:

```sh
python tools/recover-atlas.py --exe RUTA_A_Vascolet.exe --index RUTA_A_funciones.tsv
npm test
```

Los valores por defecto buscan el análisis inicial en la carpeta hermana `vascolet1-analisis/`. La emulación requiere el índice completo de Ghidra para determinar la limpieza de argumentos de las funciones interceptadas. `ExportVascoletGame.java` también exporta `index.tsv` con resultados de descompilación; ese segundo archivo **no sustituye** a `funciones.tsv`.
