# Resort Map Builder · Parte 6.2

Actualización de la 6.1 con mejoras de trabajo sobre referencia real.

## Novedades

- Imagen guía bloqueada sobre el plano.
- Opacidad ajustable para construir encima.
- La imagen se ajusta al tamaño máximo del plano (140 × 140 m).
- La imagen guía también se guarda dentro de `resort.json`.
- Imán de cuadrícula configurable por selectores.
- Imán entre objetos configurable por selectores.
- Atracción al suelo configurable y activada por defecto.
- Guías visuales de alineación (líneas punteadas) cuando el imán entre objetos se activa.
- Mejor comportamiento del imán durante el escalado para que los objetos no se separen tan fácilmente al crecer.

## Proyecto

En el panel **Proyecto** ahora puedes: 

- Elegir el alcance del imán de cuadrícula.
- Elegir el alcance del imán entre objetos.
- Elegir el alcance de la atracción al suelo.
- Cargar una imagen guía.
- Ocultarla / mostrarla.
- Ajustar su opacidad.
- Guardar y cargar `resort.json`.

## Imagen guía

La imagen guía no forma parte de los objetos editables.
Se trata como una capa de referencia bloqueada, así que no se selecciona ni interfiere con la construcción.

## Archivos principales

```text
index.html
style.css
app.js
props.js
ui.js
placement.js
desktop-controls.js
snap.js
project-io.js
scale-anchor.js
README.md
```
