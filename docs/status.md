# Estado de fidelidad y verificación

## Qué se conserva directamente

- Los cinco TMX originales, sin cambios de contenido, y los 76 recursos importados, comprobados por SHA-256.
- Sus 1.680 registros de objetos, incluidos carteles, puertas, enemigos, puntos de salvado y mejoras.
- Rectángulos/grillas/pivotes recuperados del ejecutable para los sprites y elementos del mundo.
- Las secuencias y tiempos de 57 animaciones recuperadas, incluidos fotogramas repetidos.
- Tablas de gravedad, marcha, escalera y saltos del jugador.
- Distribución de habitaciones de 16 × 12 tiles y reglas de precedencia de tipos de tile.

## Implementado en el port

Movimiento, salto, doble salto progresivo, escaleras, colisiones sólidas y de una sola cara, caída por plataformas, plataformas móviles con transporte, objetos, puntuación, vidas, consumo de llaves, puertas que se abren, puntos de salvado, reanudación, cambio de época y final.

Los tipos colocados en los mapas tienen controladores: `Enemy`, `Fire`, `Bird`, `Piranha`, `Guillotine`, `Thrower`, `Jumper`, `Stalactite`, `Platform` y `PlatformInterp`. Los cañones crean proyectiles, las estalactitas caen al acercarse el jugador y las propiedades de habitación activan meteoritos. Los enemigos aptos para ello pueden derrotarse saltando encima.

El menú, HUD, selector, opciones, controles táctiles y las cajas de texto son interfaz web reconstruida. Las ilustraciones de fondo, historia, ayuda y créditos son originales. El selector permite explorar las cinco épocas desde el inicio.

## Aspectos todavía provisionales

1. **IA y colisiones de enemigos:** se utilizan sus parámetros reales y animaciones, pero las cajas de contacto, rebotes, estados y condiciones exactas de derrota no han sido certificados contra Windows.
2. **Movimiento del jugador:** constantes recuperadas; integración, tolerancia de bordes y buffer de salto son implementación web. El límite de caída, muerte/reaparición e invulnerabilidad tienen ajustes del port.
3. **Plataformas y peligros:** curvas de interpolación, esperas, trayectorias, activación fuera de pantalla y RNG están reconstruidos. Los meteoritos usan una secuencia determinista del port, no el RNG original.
4. **Cámara:** habitaciones inferidas del `StageManager`; la pequeña diferencia entre las coordenadas TMX y la región de presentación nativa necesita contraste. No se reproduce todavía cada transición nativa.
5. **Presentación:** los fondos JPG se recortan a su contenido 1172 × 879, excluyendo el padding de textura. La composición de menús y HUD no es una copia pixel-perfect.
6. **Variantes del personaje:** se recuperaron los atlas y secuencias del dinosaurio y de la variante `P_`, pero sus condiciones de activación no se han reconstruido. El jugador normal es el activo en la campaña web.
7. **Progresión:** la salida al recoger el microondas, mejoras y puertas funcionan; falta certificar un recorrido continuo de todos los secretos y rutas de la campaña. El guardado conserva consumidos y puertas del nivel activo; no pretende replicar el formato de guardado de Windows.

## Pruebas incluidas

### `npm test`

Siete grupos de pruebas verifican:

- Lectura completa de los cinco TMX y disponibilidad de cada asset referenciado.
- Integridad por hash de los recursos importados.
- Rectángulos, grillas y todos los índices de las animaciones dentro de sus texturas.
- Constantes del jugador y habitaciones contra la evidencia binaria.
- Gravedad, suelo, salto y techo.
- Plataformas de una sola cara, caída, puertas y tiles letales.
- Conversión de textos y validación de guardados corruptos.

### `npm run test:browser -- --built`

Ejecuta Chromium/Chrome/Edge contra el sitio empaquetado y deja capturas y JSON en `test-results/`:

- Menú e introducción real de cuatro páginas más la introducción de época.
- Caminar y saltar con eventos de teclado reales sobre el mapa de Prehistoria.
- Pausa, opciones y reanudación.
- En **cada uno de los cinco mapas**, una situación controlada prueba suelo de entrada, recogida de Vascolet, doble salto, puerta cerrada/abierta con consumo de llave, checkpoint, muerte por tile letal, reaparición y salida por microondas.
- Reanudación del punto de salvado después de recargar la página.
- Contexto móvil con pantalla táctil: un toque sostenido mueve realmente al jugador y el diseño no desborda horizontalmente.
- Sin errores JavaScript de página ni respuestas HTTP fallidas durante la prueba principal.

**Alcance:** las colocaciones de objetos/puertas/checkpoints/salida usan teletransportes de prueba declarados. La prueba de doble salto busca espacio libre en cada mapa para que un techo bajo no anule el impulso. No es un bot que haya recorrido la campaña de principio a fin, ni una certificación de equivalencia con el ejecutable original.

La interfaz de pruebas solamente se expone al añadir `?test=1`. En una partida normal no se exponen esos controles. La acción de GitHub ejecuta las pruebas antes de desplegar y conserva el informe y las capturas como artefacto.

## Próxima validación útil

Comparar captura y movimiento de la versión Windows y la web, habitación por habitación; recuperar los estados/contactos pendientes de cada especie; cerrar un recorrido natural de los cinco escenarios con secretos, llaves y mejoras. Las evidencias y herramientas del repositorio permiten continuar ese trabajo sin sustituir los mapas por aproximaciones.
