/**
 * Vue Grid Layout plugin — registers grid-layout and grid-item as global components.
 * Client-only (.client.ts) because vue-grid-layout uses browser APIs (DOM manipulation).
 */
import VueGridLayout from 'vue-grid-layout';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueGridLayout);
});
