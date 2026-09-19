# Resort Map Builder · Parte 8

Esta carpeta parte de la versión 6.7.2 del repositorio y añade dos bloques nuevos sin reescribir el núcleo estable:

- **Parte 7 · Lugares importantes**: marcadores ligeros para Edificio 65, Lobby, Piscina de olas, Restaurante, Spa, Recepción, etc.
- **Parte 8 · Editor de red de rutas**: nodos y conexiones manuales para construir la red por donde más adelante se calcularán recorridos.

## Importante

Todavía **no hay pathfinding**. No se implementa Dijkstra ni A*. La red únicamente se dibuja, edita y guarda.

## Coordenadas X / Y / Z

La Parte 8 oculta la capa HTML anterior y coloca X/Y/Z como sprites dentro de la misma escena Three.js del gizmo. Así las letras ya no dependen del desplazamiento del canvas causado por paneles laterales y se comportan igual en móvil y escritorio.

## Guardado

El archivo `resort.json` mantiene el schema principal de la versión 6.7.2 y añade un bloque opcional:

```json
"part8": {
  "version": 1,
  "places": [],
  "routeNetwork": {
    "nodes": [],
    "edges": []
  }
}
```

Los proyectos antiguos siguen cargando: si no existe `part8`, se inicia con lugares y red vacíos.

## Instalación

Copia **el contenido de esta carpeta PARTE_8** a la raíz del repositorio GitHub Pages, reemplazando los archivos con el mismo nombre y añadiendo `part8-preload.js`, `part8.js` y `part8.css`.

La carpeta `BACKUP_6.7.2` del ZIP es únicamente respaldo y no debe mezclarse con la raíz del sitio.
