// Removes the previous build before a new one.
//
// Eleventy does not empty _site/ between runs. Running the dev server (which
// writes draft pages) and then `npm run build` would otherwise leave those
// draft pages sitting in _site/ — not a problem on GitHub Actions, which always
// builds from a fresh checkout, but misleading locally.
import { rmSync } from "node:fs";

rmSync("_site", { recursive: true, force: true });
