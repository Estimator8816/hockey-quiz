/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_NAME, BASE } from './src/config';

export default defineConfig({
  base: BASE,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        display: 'standalone',
        lang: 'ru',
        start_url: BASE,
        background_color: '#0b2a4a',
        theme_color: '#0b2a4a',
        icons: [
          { src: 'icon-180.png', sizes: '180x180', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts?(x)'],
  },
});
