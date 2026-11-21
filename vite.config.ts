/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { BASE } from './src/config';

export default defineConfig({
  base: BASE,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,png,jpg,webp,svg,woff2}'] },
      // Без манифеста: iPhone кладёт на экран «Домой» ту ссылку, что открыта в Safari (с кодом приглашения).
      // С манифестом иконка открывала бы общую главную, а у иконки своё хранилище, не как в Safari, — вход терялся.
      manifest: false,
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts?(x)'],
  },
});
