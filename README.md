# Resort Map Builder · Parte 5.1

Pulido multiplataforma antes de la Parte 6.

La prioridad continúa siendo iOS/táctil, pero la versión de escritorio ahora tiene controles de cámara dedicados.

## iPhone / iPad

Se conserva:

- Gestos táctiles.
- Props / Objetos / Editar / Vista.
- Colocación múltiple.
- Palomita `✓`.
- Bloqueo.
- Opacidad.
- Sliders.
- Vista 3D / Desde arriba.

## PC / Mac

### Mouse

- Clic izquierdo + arrastrar: mover el plano.
- Clic derecho + arrastrar: rotar/orbitar la cámara.
- Rueda: zoom.
- Clic corto: seleccionar o colocar objeto.
- Se bloquea el menú contextual dentro del plano para que el clic derecho sea cómodo.

### Teclado de cámara

- `↑ ↓ ← →`: desplazarse por el plano.
- `Shift + ← / →`: girar alrededor del punto observado.
- `Shift + ↑ / ↓`: inclinar la cámara arriba/abajo.
- `+ / -`: acercar/alejar.
- `0`: centrar la vista.

### Teclado de objetos

Se conserva:

- `W`: mover objeto.
- `E`: rotar objeto.
- `R`: escalar objeto.
- `Esc`: terminar colocación o deseleccionar.
- `Delete / Backspace`: eliminar.
- `Ctrl/Cmd + D`: duplicar.

Los controles de cámara por teclado no actúan mientras escribes en un campo o mientras arrastras un manipulador.

## Archivo nuevo

```text
desktop-controls.js
```

Separa toda la navegación de teclado de `app.js`.
