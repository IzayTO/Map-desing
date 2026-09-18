# Resort Map Builder · Parte 5

Esta versión parte directamente de la **4.2 corregida** y no elimina ninguna de sus funciones.

## Nuevo: colocación múltiple

Flujo:

1. Abre `Props`.
2. Toca `Palmera`, `Árbol`, `Edificio`, etc.
3. El panel se cierra automáticamente.
4. Aparece una barra arriba con el tipo elegido, cuántos llevas y `✓`.
5. Toca una parte de la cuadrícula para colocar el objeto.
6. Puedes seguir tocando para colocar más del mismo tipo.
7. Pulsa `✓` cuando termines.
8. El último objeto queda seleccionado y vuelven las herramientas normales.

Para colocar solo uno:

`Props → objeto → tocar una vez → ✓`

## Se conserva de 4.2

- Bloquear / desbloquear.
- Eliminar y duplicar desde la barra rápida.
- Sliders de posición.
- Opacidad individual.
- Propiedades.
- Vista 3D.
- Vista desde arriba.
- Opacidad del plano y de la retícula.
- Panel móvil Props / Objetos / Editar / Vista.
- Selección de Objetos cierra el panel.
- Colores por familia.

## Archivos

```text
/
├── index.html
├── style.css
├── app.js
├── props.js
├── ui.js
├── placement.js
└── README.md
```

`placement.js` es nuevo y solo administra el modo de colocación.

## Detalles

- El punto se calcula mediante raycasting contra el plano.
- La colocación queda dentro de la cuadrícula de 140 × 140 m.
- Arrastrar la cámara no crea objetos.
- Solo un toque/clic corto coloca.
- `Esc` termina el modo.
- Elegir Mover / Rotar / Escalar termina el modo primero.
