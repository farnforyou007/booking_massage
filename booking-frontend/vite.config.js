import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// import basicSsl from '@vitejs/plugin-basic-ssl' // 1. เพิ่มบรรทัดนี้
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    tailwindcss(),
    // basicSsl()
  ],
  server: {
    host: true, // เพื่อให้เปิดผ่าน IP ได้
  //   // https: true // บังคับเปิด HTTPS
  }
})
