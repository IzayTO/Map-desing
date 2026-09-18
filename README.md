# Resort Map Builder · Parte 6.5.1

Corrección puntual de la Parte 6.5.

## Problema corregido

Al orbitar en teléfono, el objetivo de la cámara podía adquirir un desplazamiento vertical.
En ciertos ángulos eso colocaba la cámara virtual por debajo del plano, haciendo que el
suelo pareciera una capa delante de los edificios.

## Cambios

- La cámara ya no puede cruzar por debajo del plano.
- El desplazamiento con dos dedos se mantiene sobre X/Z, sin deriva vertical.
- El suelo solo se renderiza por su cara superior.
- La imagen guía también solo se renderiza desde la parte superior.
- El suelo y la retícula no escriben profundidad de forma que oculten objetos transparentes.
- La opacidad del plano actualiza correctamente su comportamiento de profundidad.
- La atracción al suelo ahora usa la base real de la geometría, no solo el punto central.
- Todo lo demás de la 6.5 se conserva: gestos, botón flotante, PC, imagen guía,
  imanes, guardado/carga, props y controles.
