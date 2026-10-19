import fs from 'node:fs';
const entries={};
for(const file of fs.readdirSync('src/public'))entries['/'+file]={data:fs.readFileSync('src/public/'+file).toString('base64'),type:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'application/octet-stream'};
for(const file of fs.readdirSync('src/assets'))entries['/'+file]={data:fs.readFileSync('src/assets/'+file).toString('base64'),type:'image/png'};
const catalog=fs.readFileSync('src/catalog.mjs','utf8').replaceAll('export ','');
const server=fs.readFileSync('src/server.mjs','utf8').replace("import {search,song,chart} from './catalog.mjs';",'');
const assets=`const ASSETS=${JSON.stringify(entries)};function serveAsset(path,method){if(path==='/')path='/index.html';const a=ASSETS[path];if(!a)return new Response('Not found',{status:404});const bytes=method==='HEAD'?null:Uint8Array.from(atob(a.data),c=>c.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':a.type,'Cache-Control':path.endsWith('.png')?'public, max-age=86400':'no-store','X-Content-Type-Options':'nosniff'}});}\n`;
fs.mkdirSync('worker',{recursive:true});fs.writeFileSync('worker/index.js',catalog+'\n'+assets+server);console.log('Worker built with '+Object.keys(entries).length+' approved assets');
