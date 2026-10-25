import { Save } from './save.js';
const root=new URL('../assets/audio/',import.meta.url);
export const AudioSystem={music:null,track:'',active:new Set(),
  async playMusic(name){if(name===this.track){this.music?.play().catch(()=>{});return;}this.music?.pause();this.track=name;this.music=new Audio(new URL('music/'+name+'.ogg',root));this.music.loop=true;this.volume();await this.music.play().catch(()=>{});},
  effect(name){const settings=Save.data.settings,volume=settings.effectsVolume??.5;if(settings.effectsOn===false||volume===0)return;const a=new Audio(new URL('fx/'+name+'.ogg',root));a.volume=volume;this.active.add(a);const done=()=>this.active.delete(a);a.onended=done;a.onerror=done;a.play().catch(done);},
  volume(){if(this.music)this.music.volume=Save.data.settings.musicOn===false?0:(Save.data.settings.musicVolume??.5);},
  suspend(){this.music?.pause();for(const a of this.active)a.pause();this.active.clear();},resume(){this.music?.play().catch(()=>{});}
};
