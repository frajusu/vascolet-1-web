export const HARD=1, PLATFORM=2, HAZARD=4, LADDER=8, LADDER_END=16;
const children=(n,name)=>[...n.children].filter(c=>c.localName===name);
const number=(n,key,fallback=0)=>n.hasAttribute(key)?Number(n.getAttribute(key)):fallback;
export function properties(n){const out={};for(const ps of children(n,'properties'))for(const p of children(ps,'property'))out[p.getAttribute('name')]=p.getAttribute('value')??p.textContent;return out;}
export function originalText(s=''){
  const accents={a:'á',e:'é',i:'í',o:'ó',u:'ú',A:'Á',E:'É',I:'Í',O:'Ó',U:'Ú',m:'ñ',M:'Ñ','!':'¡','?':'¿'};
  return s.replace(/\\n/g,'\n').replace(/\\(.)/g,(_,c)=>accents[c]??c).replace(/�/g,'¡');
}
export function decodeLayer(data){
  if(data.getAttribute('compression'))throw Error('Compresión TMX no admitida');
  const encoding=data.getAttribute('encoding');
  if(encoding==='base64'){
    const bytes=Uint8Array.from(atob(data.textContent.replace(/\s/g,'')),c=>c.charCodeAt(0));
    if(bytes.byteLength%4)throw Error('Capa TMX truncada');
    const view=new DataView(bytes.buffer);return Array.from({length:bytes.length/4},(_,i)=>view.getUint32(i*4,true));
  }
  if(encoding==='csv')return data.textContent.trim().split(/[\s,]+/).map(Number);
  if(!encoding)return children(data,'tile').map(t=>number(t,'gid'));
  throw Error('Codificación TMX no admitida: '+encoding);
}
export function parseTMX(doc){
  if(doc.querySelector('parsererror')||doc.documentElement.localName!=='map')throw Error('Mapa TMX inválido');
  const r=doc.documentElement,p=properties(r);
  const map={w:number(r,'width'),h:number(r,'height'),tw:number(r,'tilewidth'),th:number(r,'tileheight'),props:p,tilesets:[],layers:[],objects:[]};
  for(const t of children(r,'tileset')){
    const flags={};for(const tile of children(t,'tile')){
      const ps=properties(tile);let f=0;
      // Native 00428bd0 assigns one TileType, in this precedence order.
      // A tile marked pHard + pPlatform ends up one-way, not a solid wall.
      for(const [key,bit] of [['pHard',HARD],['pLadder',LADDER],['pLadderEnd',LADDER_END],['pPlatform',PLATFORM],['pKilling',HAZARD]])if(String(ps[key]).toLowerCase()==='true')f=bit;
      // Preserve the original typo pPlaftorm as evidence; the native parser ignores it.
      flags[number(tile,'id')]=f;
    }
    map.tilesets.push({firstgid:number(t,'firstgid'),image:children(t,'image')[0].getAttribute('source'),columns:Number(p.pTileSetWidth),flags});
  }
  for(const l of children(r,'layer')){
    const data=decodeLayer(children(l,'data')[0]);if(data.length!==number(l,'width')*number(l,'height'))throw Error('Tamaño de capa TMX incorrecto');
    map.layers.push({name:l.getAttribute('name'),w:number(l,'width'),h:number(l,'height'),data,props:properties(l)});
  }
  for(const g of children(r,'objectgroup'))for(const o of children(g,'object'))map.objects.push({id:map.objects.length,name:o.getAttribute('name')??'',type:o.getAttribute('type')??'',x:number(o,'x'),y:number(o,'y'),w:number(o,'width'),h:number(o,'height'),props:properties(o)});
  // REF is an editor reference, not a second collision/render layer in the native loader.
  map.layer=map.layers.find(l=>l.name!=='REF');if(!map.layer)throw Error('Mapa sin capa de juego');
  map.flags=new Uint8Array(map.w*map.h);
  for(let i=0;i<map.layer.data.length;i++){
    const gid=map.layer.data[i]&0x1fffffff; const ts=[...map.tilesets].reverse().find(t=>t.firstgid<=gid);
    map.flags[i]=ts?.flags[gid-ts.firstgid]??0;
  }
  return map;
}
