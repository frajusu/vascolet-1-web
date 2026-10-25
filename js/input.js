export const Input={held:new Set(),pressed:new Set(),release(){this.held.clear();this.pressed.clear();},down(...keys){return keys.some(k=>this.held.has(k));},tap(...keys){return keys.some(k=>this.pressed.has(k));},flush(){this.pressed.clear();}};
const keys=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyZ','KeyW','KeyA','KeyS','KeyD','Escape','Enter']);
export function setupInput(){
  window.addEventListener('keydown',e=>{if(!keys.has(e.code)||e.target.matches('input,textarea,select'))return;e.preventDefault();if(!Input.held.has(e.code))Input.pressed.add(e.code);Input.held.add(e.code);});
  window.addEventListener('keyup',e=>{Input.held.delete(e.code);});window.addEventListener('blur',()=>Input.release());
  for(const b of document.querySelectorAll('[data-key]')){
    const code=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(!Input.held.has(code))Input.pressed.add(code);Input.held.add(code);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>Input.held.delete(code));
  }
}
