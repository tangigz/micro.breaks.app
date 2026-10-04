import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

/**
 * OAuth client for Google Calendar: type "Chrome extension", created in Google Cloud for the
 * extension ID below. Empty until it exists; "Connect Google Calendar" then says so.
 */
const GOOGLE_CLIENT_ID: string = '';

/** Public key that fixes the extension ID to hkgliedfglkhagpbpljdbfabimefocak, which the OAuth client is tied to. */
const KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAljHbxT2PMUk1zKsHr2G01t1PX++zkCcpv8UC3QjabkhLY5ppU2L8F+6HtdvCVHsl5KxgZKucPOXUx65xqnM+Ww4VhDBxi6AfbdLI4sX3I4rfGiEElwOBaKJpcAVFIlEkY9v8ECCHjtR98pH1H9WXuJzhjZ9G/EHOypdvDBga7gQUbJYzQB201y9u/tU+kHADiFhBqzT6YmZMl4D4EdEBRNpuDt856aRtGS2Qn3OySfwht1TaUcYhAtIooHvc5nn5y38/A1C8ctEMmu15fm9y7UreIACgc32i0gYrUCJZrNXxHJsFSoxdUQnwYkFC6zw8arm3ziMXYlux57R60HeHIwIDAQAB';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'micro.breaks',
    description: 'Move a little, every hour you sit.',
    key: KEY,
    permissions: ['idle', 'alarms', 'notifications', 'storage', 'tabs', 'declarativeNetRequestWithHostAccess', 'identity'],
    // Video missions embed YouTube (src/background/youtube.ts); meetings come from Google Calendar (src/background/calendar.ts)
    host_permissions: ['https://www.youtube-nocookie.com/*', 'https://www.googleapis.com/calendar/*'],
    // Read-only, busy times only: no event titles, no attendees
    ...(GOOGLE_CLIENT_ID
      ? { oauth2: { client_id: GOOGLE_CLIENT_ID, scopes: ['https://www.googleapis.com/auth/calendar.freebusy'] } }
      : {}),
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});
