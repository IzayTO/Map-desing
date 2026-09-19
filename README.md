# Resort Map Builder · Parte 6.7.1

Corrección inmediata de la Parte 6.7.

## Bug corregido

La creación dinámica de los inputs numéricos X/Y/Z provocaba:

`HierarchyRequestError: Failed to execute 'appendChild' on 'Node'`

La causa era que el código movía el nodo del valor dentro de un contenedor nuevo
y después consultaba otra vez `parentElement`, que para entonces ya era el
contenedor nuevo. Eso hacía que intentara insertarse a sí mismo.

Ahora se conserva la referencia al padre original antes de mover ningún nodo.

## Se conserva de 6.7

- Rotación libre normalmente.
- Mantener Control al rotar = snap angular cada 45 grados.
- 45 / 90 / 135 / 180 / 225 / 270 / 315 grados.
- Undo / Redo.
- Contornos configurables.
- Inputs numéricos X/Y/Z.
- Etiquetas X/Y/Z.
- Mini brújula.
- Gestos móviles.
- Imagen guía.
- Guardar / cargar resort.json.
- Compatibilidad con proyectos anteriores.
