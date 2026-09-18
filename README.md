# Resort Map Builder · Parte 6.1

Esta versión parte de la Parte 6 y mantiene:

- Guardar / cargar `resort.json`.
- Imán de cuadrícula.
- Colocación múltiple.
- iOS + PC.
- Bloqueo.
- Opacidad.
- Vistas.
- Sliders.
- Puente normal y puente arqueado.

## Escalado desde un solo lado

### PC / Mac

En modo **Escalar**, arrastra una flecha X/Y/Z:

- Normal: el objeto crece desde el centro.
- Manteniendo `Shift`: el lado contrario queda fijo y solo avanza el lado que estás arrastrando.
- Al soltar `Shift`: vuelve inmediatamente al comportamiento desde el centro.

### iPhone / iPad

Al seleccionar un objeto editable aparece arriba:

**⇥ Un lado**

- Apagado: escala desde el centro.
- Encendido: fija el lado contrario durante el escalado.

Los props de escala estrictamente uniforme (palmera, árbol, etc.) no muestran esta opción.

## Dos imanes independientes

En `Proyecto`:

### Imán de cuadrícula

Atrae X/Z hacia las líneas de la retícula cada 2 m.

### Imán entre objetos

Cuando dos piezas quedan a unos 30 cm:

- borde con borde,
- borde alineado,
- o centro con centro,

se produce una atracción suave. Un desplazamiento mayor vuelve a liberarlo.

Puedes activar ambos, solo uno o ninguno.

## Biblioteca nueva

### Geometría

- Bloque.
- Esfera.
- Cilindro.
- Cono.
- Pirámide cuadrada.
- Pirámide cortada.
- Triángulo 3D / cuña.

### Arquitectura

- Ventana.
- Puerta café.
- Lámpara de muro.
- Columna redonda.
- Pilar cuadrado.
- Barandal.
- Muro bajo.

### Escaleras

- Recta.
- En L con descanso.
- En U con retorno.

Cuando seleccionas una escalera aparece un slider de:

**Número de escalones: 3–30**

La escalera se reconstruye automáticamente sin modelos externos.

## Archivos nuevos / ampliados

```text
/
├── index.html
├── style.css
├── app.js
├── props.js
├── ui.js
├── placement.js
├── desktop-controls.js
├── snap.js
├── project-io.js
├── scale-anchor.js     ← NUEVO
└── README.md
```

Los parámetros de escalera y los nuevos estados de imán/escalado también se guardan dentro de `resort.json`.
