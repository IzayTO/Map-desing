# Resort Map Builder

Base inicial del proyecto para construir un editor 3D ligero de mapas de resort.

## Parte 1

Esta versión únicamente comprueba que:

- `index.html` carga correctamente.
- `style.css` está enlazado.
- `app.js` se ejecuta.
- Las rutas son relativas y compatibles con GitHub Pages.
- La estructura ya está preparada para añadir el plano 3D en la Parte 2.

## Estructura

```text
resort-map-starter/
├── index.html
├── style.css
├── app.js
├── assets/
└── data/
```

## Probar en computadora

Puedes abrir `index.html` directamente en el navegador.

Para desarrollo futuro será mejor usar un servidor local sencillo, porque algunos módulos 3D modernos funcionan mejor mediante `http://localhost` que abriendo el archivo con `file://`.

## GitHub Pages

Sube el contenido a la raíz de un repositorio y activa GitHub Pages desde:

Settings → Pages → Deploy from a branch → `main` → `/ (root)`

La aplicación usa rutas relativas, así que puede publicarse dentro de un repositorio de proyecto.
