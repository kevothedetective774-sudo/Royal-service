import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const dbUrl = process.env.DATABASE_URL || 
    process.env.VITE_DATABASE_URL || 
    'postgresql://neondb_owner:npg_TXm6UtSlW7Ae@ep-little-hall-b5o6vcsm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.DATABASE_URL': JSON.stringify(dbUrl),
      'process.env.VITE_DATABASE_URL': JSON.stringify(dbUrl),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
