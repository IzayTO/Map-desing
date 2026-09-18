# Resort Map Builder · Parte 4

La Parte 4 añade una biblioteca de props ligeros y mantiene el proyecto dividido por responsabilidades.

## Archivos

```text
/
├── index.html
├── style.css
├── app.js
└── src/
    └── props.js
```

`props.js` es nuevo. Contiene únicamente la biblioteca procedural de objetos.

## Props incluidos

- Palmera
- Árbol
- Arbusto
- Poste
- Fuente
- Puente
- Camino
- Zona de agua

No requieren archivos GLB ni texturas externas.

## Reglas

### Vegetación, poste y fuente

Tienen escala uniforme para no deformarlos.

### Puente, camino y agua

Pueden cambiar ancho, altura y largo.

### Edificios

Conservan el sistema de la Parte 3.

## Transformaciones

- `W`: mover.
- `E`: rotar.
- `R`: escalar.
- `Esc`: deseleccionar.
- `Delete / Backspace`: eliminar.
- `Ctrl/Cmd + D`: duplicar.

## Escala del proyecto

`1 unidad 3D = 1 metro`.

## Rendimiento

Los props reutilizan geometrías y materiales para reducir consumo de memoria.
Los objetos siguen siendo independientes para permitir selección y edición individual.

Si en una etapa futura el mapa contiene cientos o miles de elementos repetidos,
la arquitectura permite migrar categorías repetitivas a `THREE.InstancedMesh`.
