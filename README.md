# Resort Map Builder

## Parte 2

Esta etapa crea el espacio de trabajo tridimensional del proyecto.

### Archivos

- `index.html`: estructura de la interfaz.
- `style.css`: apariencia y adaptación a distintas pantallas.
- `app.js`: escena Three.js, cámara, cuadrícula y controles.
- `README.md`: notas del proyecto.

### Qué incluye esta etapa

- Plano 3D base.
- Cuadrícula editable.
- Cámara inclinada.
- Zoom.
- Paneo.
- Rotación.
- Vista superior.
- Restablecer/centrar vista.
- Control de opacidad del plano.
- Control de opacidad de la cuadrícula.
- Mostrar/ocultar cuadrícula.
- Panel plegable.
- Compatibilidad táctil.
- Límite de pixel ratio para evitar carga innecesaria.

### Three.js

Esta versión usa Three.js `0.186.0` mediante import map y CDN.

### GitHub Pages

Los archivos están pensados para estar juntos en la raíz del repositorio:

```text
/
├── index.html
├── style.css
├── app.js
├── README.md
├── assets/
└── data/
```

No borres todavía `assets/` ni `data/`. Se usarán en etapas posteriores.
