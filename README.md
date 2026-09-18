# Resort Map Builder · Parte 6.3

Corrección visual y funcional sobre Parte 6.2.

## Corregido: imagen guía invisible

La imagen sí se cargaba, pero el material de Three.js quedaba internamente marcado como invisible.
En 6.3:

- la textura se renderiza realmente;
- la capa queda encima del fondo y debajo de la construcción;
- no puede seleccionarse accidentalmente;
- sigue ocupando el plano completo de 140 × 140 m;
- mantiene mostrar/ocultar y opacidad;
- continúa guardándose en `resort.json`.

## Escritorio reorganizado

En PC ya no se apilan Propiedades, Proyecto y Controles PC.

La pantalla se divide conceptualmente en:

```text
┌──────────────┬───────────────────────────────┬────────────────┐
│ Biblioteca   │                               │ Propiedades    │
│              │           PLANO 3D            │                │
│              │                               ├────────────────┤
├──────────────┤                               │ Proyecto       │
│ Objetos      │                               │                │
└──────────────┴───────────────────────────────┴────────────────┘
```

El canvas ocupa el centro y los paneles tienen carriles reservados.

`Controles PC` ahora abre dentro del área central, separado de Proyecto.

## iOS

No se modifica el sistema móvil de cajones inferiores. iPhone/iPad siguen usando:

`Props · Objetos · Editar · Vista · Proyecto`

## Compatibilidad

`resort.json` mantiene el esquema v2 de Parte 6.2.
También se amplió el límite de lectura a 30 MB porque el archivo puede contener la imagen guía embebida.
