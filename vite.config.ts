import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Import @tailwindcss/vite

// https://vite.dev/config/
export default defineConfig({
  base: "/spotify-vinyl-player-app/",
  plugins: [
    react(),
    tailwindcss() // Add tailwindcss() to the plugins array
  ],
  server: {
    host: '127.0.0.1'
  }
})
