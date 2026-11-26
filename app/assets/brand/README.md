# Brand files

`colors.json` and `tokens.css` are copied unchanged from the private
`buspilot-org/brand` repository (`tokens/`). Don't edit them here: change
`tokens/colors.json` there, run its build script and copy both files again.
The icons in `public/` (`favicon.*`, `apple-touch-icon.png`, `icon-*.png`)
come from `icons/web/` and the fonts in `public/fonts/` from `fonts/` in the
same repository.

`nuxt.config.ts` reads `colors.json` for the Vuetify themes. `tokens.css`
provides the same colours as `--bp-*` custom properties for custom CSS;
prefer Vuetify's theme colours where a component supports them.

The Buspilot name, logo and brand assets are not covered by the AGPL licence
of this repository. All rights reserved. Forks must replace them. The font
is licensed under the SIL Open Font License 1.1 (`public/fonts/OFL.txt`).
