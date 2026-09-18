# Resort Map Builder · Parte 4.1 corregida

Esta versión corrige el problema móvil visto en iPhone.

## IMPORTANTE

Sube **todos** estos archivos a la raíz del repositorio:

```text
/
├── index.html
├── style.css
├── app.js
├── props.js
├── ui.js
└── README.md
```

No hace falta crear la carpeta `src` en esta revisión. `props.js` y `ui.js` están en la raíz para que sea más fácil subirlos desde GitHub móvil.

## Qué se corrigió

- Biblioteca de props siempre accesible en móvil.
- Lista de objetos accesible.
- Panel de propiedades accesible.
- Panel de vista accesible.
- Botón `Vista 3D`.
- Botón `Desde arriba`.
- Opacidad de retícula.
- Opacidad del plano.
- Mostrar/ocultar retícula.
- Barra inferior móvil con Props / Objetos / Editar / Vista.
- Paneles convertidos en cajones en iPhone para no tapar permanentemente el plano.
- Se añadió cache-busting `?v=4.1` para evitar que Safari/GitHub Pages reutilicen `style.css` o `app.js` antiguos.
- Se mantiene el sistema de edificios y todos los props de la Parte 4.

## Señal de que JavaScript cargó correctamente

Al abrir la página debe aparecer un `Edificio 1` en el centro del plano.

Si el plano aparece vacío, significa que falta alguno de estos archivos:

- `app.js`
- `props.js`
- `ui.js`

o que GitHub Pages todavía está publicando una versión anterior.
