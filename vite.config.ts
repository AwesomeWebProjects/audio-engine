import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      outDir: 'dist',
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AudioEngine',
      formats: ['es', 'cjs'],
      fileName: (format) =>
        `audio-engine.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      output: {
        globals: {},
      },
    },
  },
});