import http from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const args=process.argv.slice(2),index=args.indexOf('--port');const port=index<0?8124:Number(args[index+1]);
const directory=args.includes('--built')?path.join(root,'_site'):root;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.tmx':'application/xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.ogg':'audio/ogg','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://localhost');const decoded=decodeURIComponent(url.pathname);const relative=decoded==='/'?'index.html':decoded.replace(/^\/+/,''),file=path.resolve(directory,relative);
    if(file!==directory&&!file.startsWith(directory+path.sep)){res.writeHead(403);res.end();return;}
    if(!(await stat(file)).isFile())throw Error('not file');const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>{const message={type:'ready',url:`http://127.0.0.1:${server.address().port}`};console.log(message.url);process.send?.(message);});
process.on('message',m=>{if(m.type==='stop')server.close(()=>process.exit(0));});
