import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {loadOfflineAvatar} from '../scripts/load-avatar-offline.mjs';
import {createMemoryScene,captureGoalPhoto} from '../src/goal-photo.js';
import {PROFILES} from '../src/game.js';
import {KABUKICHO_VENUES} from '../src/venues.js';
await loadOfflineAvatar();
test('memory uses the selected woman, player outfit and a shared copy of the venue facade',()=>{
 const facade=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());facade.name='venue-test';
 for(const profile of [PROFILES[0],PROFILES[1],PROFILES[11]]){
  const photo=createMemoryScene(profile,'burgundy',KABUKICHO_VENUES[0],facade);
  assert.equal(photo.girl.userData.kind,profile.id);assert.equal(photo.player.userData.kind,'player');
  assert.equal(photo.scene.getObjectByName('venue-test').geometry,facade.geometry);
  assert.ok(photo.girl.userData.authored);assert.equal(photo.camera.aspect,1.5);
  photo.scene.updateMatrixWorld(true);photo.camera.updateMatrixWorld(true);
  const head=new THREE.Vector3(-.43,2.1,.25).project(photo.camera);assert.ok(Math.abs(head.x)<1&&Math.abs(head.y)<1);
  photo.dispose();
 }
});
test('capture flips render-target rows, returns a downloadable image and restores renderer/resources',()=>{
 const previousDoc=globalThis.document;let written;
 globalThis.document={createElement:()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:data=>{written=data.data;}}),toDataURL:(type)=>{assert.equal(type,'image/webp');return 'data:image/webp;base64,dGVzdA==';}})};
 const original={name:'original'},renderer={current:original,getRenderTarget(){return this.current;},setRenderTarget(target){this.current=target;if(target!==original)target.addEventListener('dispose',()=>{this.disposed=true;});},render(scene){this.skeletons=[];scene.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.computeBoneTexture();this.skeletons.push(o.skeleton);}});},readRenderTargetPixels(target,x,y,w,h,pixels){pixels.fill(17);pixels.set([1,2,3,255],(h-1)*w*4);}};
 try{
  const uri=captureGoalPhoto(renderer,PROFILES[0],'default',KABUKICHO_VENUES[0]);
  assert.equal(uri,'data:image/webp;base64,dGVzdA==');assert.deepEqual([...written.slice(0,4)],[1,2,3,255]);
  assert.equal(renderer.current,original);assert.equal(renderer.disposed,true);assert.ok(renderer.skeletons.every(s=>s.boneTexture===null));
  renderer.render=()=>{throw Error('render failed');};renderer.disposed=false;
  assert.throws(()=>captureGoalPhoto(renderer,PROFILES[1],'default',KABUKICHO_VENUES[1]),/render failed/);
  assert.equal(renderer.current,original);assert.equal(renderer.disposed,true);
 }finally{globalThis.document=previousDoc;}
});
