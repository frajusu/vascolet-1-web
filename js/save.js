const KEY='vascolet-1-web:native-v2';
export function freshSave(){return {version:1,completed:[],bestCoins:[0,0,0,0,0],lastLevel:0,run:null,settings:{volume:.5,musicVolume:.5,effectsVolume:.5,musicOn:true,effectsOn:true,stretch:false,smooth:true}};}
export function sanitizeSave(raw){
  const out=freshSave();if(!raw||typeof raw!=='object'||raw.version!==1)return out;
  out.completed=[...new Set((Array.isArray(raw.completed)?raw.completed:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<5))];
  out.lastLevel=Number.isInteger(raw.lastLevel)&&raw.lastLevel>=0&&raw.lastLevel<5?raw.lastLevel:0;
  out.bestCoins=out.bestCoins.map((_,i)=>Math.max(0,Math.min(100,Math.floor(Number(raw.bestCoins?.[i])||0))));
  if(raw.settings&&typeof raw.settings==='object'){const v=raw.settings.volume;out.settings.volume=Number.isFinite(v)?Math.max(0,Math.min(1,v)):.5;out.settings.smooth=raw.settings.smooth!==false;for(const k of ['musicVolume','effectsVolume'])out.settings[k]=Number.isFinite(raw.settings[k])?Math.max(0,Math.min(1,raw.settings[k])):.5;out.settings.musicOn=raw.settings.musicOn!==false;out.settings.effectsOn=raw.settings.effectsOn!==false;out.settings.stretch=raw.settings.stretch===true;}
  if(raw.run&&typeof raw.run==='object'){
    const r=raw.run;
    if(Number.isInteger(r.level)&&r.level>=0&&r.level<5&&Number.isFinite(r.lives)&&r.lives>=0&&r.lives<=999&&Number.isFinite(r.score)&&r.score>=0&&r.score<1e9&&Number.isFinite(r.checkpoint?.x)&&Number.isFinite(r.checkpoint?.y)&&r.checkpoint.x>=0&&r.checkpoint.x<50000&&r.checkpoint.y>=0&&r.checkpoint.y<16000){
      const counts={};for(const k of ['YELLOW_KEY','RED_KEY','GREEN_KEY','BLUE_KEY','VASCOLETS','CEREALS'])counts[k]=Math.max(0,Math.min(k.endsWith('KEY')?99:4,Math.floor(Number(r.counts?.[k])||0)));
      out.run={level:r.level,lives:Math.floor(r.lives),score:Math.floor(r.score),checkpoint:{x:r.checkpoint.x,y:r.checkpoint.y},consumed:[...new Set((Array.isArray(r.consumed)?r.consumed:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<5000))],doors:[...new Set((Array.isArray(r.doors)?r.doors:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<5000))],counts};
    }
  }
  return out;
}
export const Save={data:freshSave(),available:true,load(){try{this.data=sanitizeSave(JSON.parse(localStorage.getItem(KEY)));}catch{this.data=freshSave();this.available=false;}return this.data;},write(){try{localStorage.setItem(KEY,JSON.stringify(this.data));}catch{this.available=false;}},reset(){this.data=freshSave();this.write();}};
