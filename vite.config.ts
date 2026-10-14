import { defineConfig } from 'vite';

// Relative base so the build works under any sub-path (e.g. GitHub Pages
// project sites at https://<user>.github.io/<repo>/) without knowing the repo name.
export default defineConfig({
  base: './',
});
