# Generador de informes de ahorro (Argieder)

Página web que convierte el Excel de simulación (luz y gas) en un informe PDF.
Todo se procesa en el navegador: el Excel **no se sube a ningún servidor**.

## Estructura

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página (dropzone, botones, vista previa). |
| `css/styles.css` | Colores y diseño (la parte `.rpt` es el informe). |
| `js/core.js` | Lee el Excel y calcula ofertas, ahorros y desglose. |
| `js/app.js` | Pantalla, informe y generación del PDF. |
| `js/logo.js` | Logo embebido que sale dentro del PDF. |
| `img/logo.png` | Logo de la cabecera de la página. |

## Publicarla en GitHub Pages (sin instalar nada)

1. Entra en https://github.com y crea una cuenta (o inicia sesión).
2. Arriba a la derecha pulsa **+ → New repository**.
3. Nombre: `informes-ahorro` (o el que quieras). Déjalo en **Public**. Pulsa **Create repository**.
4. En la página del repositorio pulsa **uploading an existing file**.
5. Descomprime el ZIP y **arrastra todo su contenido** (las carpetas `css`, `js`, `img` y los archivos `index.html`, `README.md`, `.nojekyll`) a la ventana. Si no ves `.nojekyll`, no pasa nada.
6. Abajo pulsa **Commit changes**.
7. Ve a **Settings → Pages**.
8. En *Build and deployment → Source* elige **Deploy from a branch**. En *Branch* elige **main** y **/(root)**, y pulsa **Save**.
9. Espera 1–2 minutos y recarga. Arriba aparecerá la dirección: `https://TU-USUARIO.github.io/informes-ahorro/`. Esa es la página para las trabajadoras.

## Modificarla después

- Entra en el archivo desde GitHub, pulsa el icono del **lápiz**, cambia lo que necesites y pulsa **Commit changes**. En 1–2 minutos la web se actualiza.
- Para subir una versión nueva completa: **Add file → Upload files**, arrastra los archivos y confirma (reemplaza los anteriores).
- Si cambias algo y la página se ve igual, recarga con Ctrl+F5.

## Con Git (opcional)

```bash
git clone https://github.com/TU-USUARIO/informes-ahorro.git
cd informes-ahorro
# copia aquí los archivos, luego:
git add .
git commit -m "Actualiza el generador"
git push
```

## Dónde cambiar cada cosa

- Colores del informe y tamaños: `css/styles.css` (busca `.rpt`).
- Textos del informe (títulos, notas al pie): `js/app.js`, función `renderReport`.
- Qué filas del Excel se leen y cómo se calcula el desglose: `js/core.js`.
- Colores de las barras: constante `COL` en `js/app.js`.

## Notas

- Necesita conexión: carga las librerías de Excel y PDF desde cdnjs (versiones fijas).
- El Excel debe traer los importes **calculados** (ábrelo en Excel y guárdalo antes de subirlo).
- Un repositorio público muestra el código a cualquiera (no contiene datos de clientes). Si lo quieres privado, GitHub Pages en repositorios privados requiere un plan de pago; alternativas gratuitas: Netlify o Cloudflare Pages.
