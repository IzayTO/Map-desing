# Wizard Map Design parte 8

Esta entrega parte **directamente de Resort Map Builder 6.7.2**, conservando el constructor 3D estable y sumando completas las Partes 7 y 8 sin implementar pathfinding todavía.

## Qué incluye

- Constructor de edificios, geometrías y props existente.
- Mover, rotar y escalar con TransformControls.
- Ctrl durante rotación = snap de 45°; al soltar Ctrl vuelve la rotación libre.
- Escalado desde un lado, bloqueo, duplicado, eliminación, opacidad, Undo/Redo e imanes.
- Imagen guía y guardado/carga de `resort.json`.
- Contornos basados en `EdgesGeometry` como hijos de los meshes compatibles.
- Mini brújula 2D.
- **X/Y/Z corregidos mediante sprites Three.js**, sin offsets DOM dependientes del ancho de los paneles.
- **Parte 7 · Lugares importantes**.
- **Parte 8 · Editor manual de red de rutas**.
- Ajustes de interfaz móvil, incluyendo **Deshacer / Rehacer / Restablecer vista juntos en la zona inferior derecha**.

## Parte 7 · Lugares importantes

Dentro de **Editar → Lugares** puedes:

1. pulsar `Agregar lugar`;
2. tocar/clicar el suelo;
3. cambiar nombre y categoría;
4. mover el marcador;
5. bloquearlo;
6. ocultarlo/mostrarlo;
7. eliminarlo.

Los marcadores son sprites ligeros. El nombre se muestra solo al seleccionar el lugar o al pasar el puntero sobre él en PC. Cada lugar tiene un ID persistente y un campo `routeNodeId` preparado para una asociación futura con la red.

## Parte 8 · Red de rutas

Dentro de **Editar → Rutas** puedes:

- crear nodos tocando/clicando el suelo;
- seleccionar y mover nodos;
- eliminar nodos;
- conectar dos nodos de manera explícita;
- desconectar conexiones existentes.

La visualización utiliza un `InstancedMesh` para los nodos y un único `LineSegments` para las conexiones. Las líneas se reconstruyen únicamente cuando cambia la red o se mueve un nodo.

No permite conexiones de un nodo consigo mismo ni duplicados A-B / B-A. Al borrar un nodo se eliminan automáticamente sus conexiones.

## Todavía NO incluye

- Dijkstra.
- A*.
- cálculo automático origen → destino.
- flechas o instrucciones para huéspedes.

Esta fase solamente construye correctamente el mapa, los lugares y el grafo físico.

## `resort.json`

La versión de documento pasa a schema 5 y añade, en el nivel principal:

```json
{
  "places": [],
  "routeNetwork": {
    "nodes": [],
    "edges": []
  }
}
```

Los proyectos antiguos de las versiones 1–4 continúan siendo aceptados. Si un archivo viejo no contiene esos campos, se restauran como listas vacías.

## Archivos

La entrega conserva la misma base de 11 archivos de 6.7.2 (adaptando solamente los que necesitan integración) y añade tres módulos nuevos:

- `axis-overlay.js`
- `places.js`
- `route-editor.js`

Para publicar, copia **todos los archivos de esta carpeta** a la raíz del repositorio de GitHub Pages, reemplazando los archivos con el mismo nombre y añadiendo los tres módulos nuevos.
