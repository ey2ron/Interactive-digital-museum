import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--dist');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4'};
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let directory = production ? path.join(root,'dist') : root;
  let relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!production && pathname.startsWith('/assets/')) {directory=path.join(root,'public');}
  if (!production && pathname.startsWith('/vendor/three/')) {directory=path.join(root,'node_modules','three');relative=pathname.slice('/vendor/three/'.length);}
  const file = path.resolve(directory, relative);
  if (!file.startsWith(directory+path.sep)) {res.writeHead(403);return res.end();}
  fs.stat(file,(error,stat)=>{
    if(error || !stat.isFile()){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')return res.end();
    fs.createReadStream(file).pipe(res);
  });
});
server.listen(5173,'127.0.0.1',()=>console.log('RVASA2 is ready: http://127.0.0.1:5173'));
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
