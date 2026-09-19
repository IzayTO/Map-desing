# Resort Map Builder · Parte 6.7.2

Esta versión parte directamente de la 6.7.1 corregida y conserva todas las funciones anteriores.

## Correcciones principales

### Contornos persistentes

El contorno ahora se genera como una capa hija de cada mesh compatible. Eso hace que herede la misma posición, rotación y escala de la geometría.

Ya no se reconstruye el contorno durante cada frame de mover / rotar / escalar. Esto corrige el problema donde el objeto rotaba pero el contorno quedaba desfasado o desaparecía al confirmar la transformación.

Se mantienen sin contorno por diseño:

- vegetación,
- agua,
- postes / lámparas,
- fuentes,
- puente normal y puente arqueado.

Sí pueden usar contorno, entre otros:

- edificios,
- bloques y formas geométricas,
- caminos,
- puertas y ventanas,
- columnas y pilares,
- muros y barandales,
- escaleras.

Cada objeto compatible conserva:

- Contorno ON / OFF.
- Nitidez / intensidad del contorno.

### Etiquetas X / Y / Z

Las letras dejaron de colocarse como burbujas flotantes alrededor del volumen del objeto.
Ahora se posicionan en pantalla siguiendo la dirección real de las líneas del gizmo de TransformControls.

- Mover: ejes globales.
- Escalar: ejes locales del objeto.
- Rotar: solo se muestra la etiqueta del eje visible.

### Optimización

Los EdgesGeometry ya no se destruyen y recrean continuamente durante una transformación. Solo se reconstruyen cuando cambia realmente la geometría, por ejemplo al modificar una escalera paramétrica.

## Conservado

- Undo / Redo.
- Inputs numéricos y sliders X / Y / Z.
- Mini brújula.
- Activar / desactivar etiquetas de ejes.
- Ctrl + rotar = snap cada 45 grados.
- Escalado de un solo lado.
- Imán de cuadrícula, objetos y suelo.
- Imagen guía y sus controles.
- Guardar / cargar resort.json.
- Compatibilidad con archivos anteriores.
- Gestos móviles y controles de PC.
