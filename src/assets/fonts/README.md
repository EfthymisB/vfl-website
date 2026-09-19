# Fonts

Self-hosted so the site makes no third-party font requests (faster, and no cookie/consent
question to answer).

| File | Family | Licence | Source |
|---|---|---|---|
| `archivo-latin-wght-normal.woff2` | Archivo Variable (100–900) | SIL Open Font License 1.1 | `@fontsource-variable/archivo` |
| `inter-latin-wght-normal.woff2` | Inter Variable (100–900) | SIL Open Font License 1.1 | `@fontsource-variable/inter` |
| `jetbrains-mono-latin-wght-normal.woff2` | JetBrains Mono Variable (100–800) | SIL Open Font License 1.1 | `@fontsource-variable/jetbrains-mono` |

Latin subset only, ~120 KB for all three.

To refresh them:

```bash
npm i -D @fontsource-variable/archivo @fontsource-variable/inter @fontsource-variable/jetbrains-mono
cp node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2 src/assets/fonts/
cp node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2 src/assets/fonts/
cp node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2 src/assets/fonts/
npm remove @fontsource-variable/archivo @fontsource-variable/inter @fontsource-variable/jetbrains-mono
```
