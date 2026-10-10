const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = process.argv[2] === undefined ? 8877 : Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Invalid port. Use an integer between 1 and 65535.');
  process.exit(1);
}
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.wav':'audio/wav','.md':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8'};
const server = http.createServer((request, response) => {
  response.setHeader('X-Six-Realms-Preview', '1');
  try {
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if (pathname === '/__preview/health') {
      response.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      response.end(JSON.stringify({service:'six-realms-preview',port,pid:process.pid}));
      return;
    }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403);response.end();return; }
    fs.readFile(file,(error,data)=>{response.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(error?'Not found':data);});
  } catch {response.writeHead(400);response.end('Invalid request');}
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Stop the old preview server or choose another port.`
    : `Preview server failed: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port,'127.0.0.1',()=>console.log(`六域： http://127.0.0.1:${port}/`));
