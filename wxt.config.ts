import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'micro.breaks',
    description: 'Move a little, every hour you sit.',
    permissions: ['idle', 'alarms', 'notifications', 'storage', 'tabs', 'declarativeNetRequestWithHostAccess'],
    // Video missions embed YouTube, see src/background/youtube.ts
    host_permissions: ['https://www.youtube-nocookie.com/*'],
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});
