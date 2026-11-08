import * as THREE from 'three';
import { createCharacter, animateCharacter, setCharacterOutfit } from './characters.js';
import { disposeCharacterSkeletons } from './authored-characters.js';
import { REWARDS } from './challenge.js';

// A posed memory using the same character assets and venue facade as the game.
export function createMemoryScene(profile, outfit, venue, facade) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#202737');
  scene.add(new THREE.HemisphereLight('#ffe9d8', '#68758f', 2.5));
  const light = new THREE.DirectionalLight('#fff0dc', 3); light.position.set(-3,5,5); scene.add(light);
  if (facade) { const backdrop = facade.clone(true); backdrop.position.set(0,0,-venue.building.depth/2-.9); backdrop.rotation.set(0,0,0); scene.add(backdrop); }
  const player = createCharacter('#303544','#49362e','player'), girl=createCharacter(profile.color,profile.hair,profile.id);
  const color=REWARDS.find(r=>r.id===outfit)?.color; if(color) setCharacterOutfit(player,color);
  player.position.set(.43,0,.2); girl.position.set(-.43,0,.25); player.rotation.set(0,-.12,.035); girl.rotation.set(0,.12,-.035);
  animateCharacter(player,false,0); animateCharacter(girl,false,0);
  scene.add(player,girl);
  const camera=new THREE.PerspectiveCamera(28, 3/2,.1,80); camera.position.set(0,1.72,3.2); camera.lookAt(0,1.66,.2);
  return {scene,camera,player,girl,dispose(){disposeCharacterSkeletons(player);disposeCharacterSkeletons(girl);}};
}
export function captureGoalPhoto(renderer, profile, outfit, venue, facade) {
  const photo=createMemoryScene(profile,outfit,venue,facade), width=720,height=480;
  const target=new THREE.WebGLRenderTarget(width,height); target.texture.colorSpace=THREE.SRGBColorSpace;
  const previous=renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target); renderer.render(photo.scene,photo.camera);
    const pixels=new Uint8Array(width*height*4); renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
    const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext('2d'), data=ctx.createImageData(width,height);
    for(let y=0;y<height;y++) data.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);
    ctx.putImageData(data,0,0); return canvas.toDataURL('image/webp',.86);
  } finally {renderer.setRenderTarget(previous);target.dispose();photo.dispose();}
}
