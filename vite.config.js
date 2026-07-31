import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

function levelEditorPlugin() {
  return {
    name: 'level-editor-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/save-level' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const filePath = path.resolve(__dirname, 'src/levels/underground/mapNodes.json');
              fs.writeFileSync(filePath, JSON.stringify(data.mapNodes, null, 2));
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: error.message }));
            }
          });
          return;
        }
        next();
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), levelEditorPlugin()],
})
