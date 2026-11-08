import fs from 'node:fs/promises';
import sharp from 'sharp';
import * as THREE from 'three';
import {loadOfflineAvatar} from './load-avatar-offline.mjs';
import {renderGeometry} from './software-preview.mjs';
import {createMemoryScene} from '../src/goal-photo.js';
import {buildKabukichoDistrict} from '../src/kabukicho.js';
import {KABUKICHO_VENUES} from '../src/venues.js';
import {PROFILES} from '../src/game.js';
await loadOfflineAvatar();
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const city=new THREE.Group();buildKabukichoDistrict(city);const cells=[];
for(const [i,venue] of KABUKICHO_VENUES.entries()) {
 const profile=PROFILES[i?1:0],photo=createMemoryScene(profile,'burgundy',venue,city.getObjectByName(venue.id));
 const raw=renderGeometry(photo.scene,photo.camera,720,480);
 cells.push({input:await sharp(raw,{raw:{width:720,height:480,channels:3}}).png().toBuffer(),left:720*i,top:0});photo.dispose();
}
await fs.mkdir('artifacts',{recursive:true});
await sharp({create:{width:1440,height:480,channels:3,background:'#202737'}}).composite(cells).png().toFile('artifacts/goal-memories.png');
console.log('Saved artifacts/goal-memories.png (offline model preview, no generated illustration)');
