import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'micro.breaks',
    description: 'Move a little, every hour you sit.',
    permissions: ['idle', 'alarms', 'notifications', 'storage', 'tabs'],
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});
