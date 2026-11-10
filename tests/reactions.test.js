import test from 'node:test';
import assert from 'node:assert/strict';
import {reactionFor,sampleReaction,sampleGroove,REACTION_SECONDS} from '../src/reactions.js';
test('winning actions get distinct reactions; combos intensify wins but never turn a miss into affection',()=>{
 assert.equal(reactionFor('win','rock',1),'laugh');assert.equal(reactionFor('win','paper',1),'nod');assert.equal(reactionFor('win','scissors',1),'shy');
 assert.equal(reactionFor('win','paper',3),'delight');assert.equal(reactionFor('draw','paper',4),'curious');assert.equal(reactionFor('miss','rock',4),'awkward');assert.equal(reactionFor('lose','rock',1),'awkward');
});
test('expressions and pose offsets stay finite, bounded and fade to zero at the end',()=>{
 for(const id of ['laugh','nod','shy','delight','curious','awkward','greet','sway','invite','celebrate'])for(const elapsed of [-.1,0,.12,.5,1.4,REACTION_SECONDS,2]){
  const p=sampleReaction(id,elapsed);
  for(const [key,value] of Object.entries(p)){if(key==='gesture')continue;assert.ok(Number.isFinite(value));if(elapsed<=0||elapsed>=REACTION_SECONDS)assert.equal(Math.abs(value),0,`${id}/${key} restores`);}
  for(const key of ['smile','relaxed','surprise','blink','mouth'])assert.ok(p[key]>=0&&p[key]<=1);
 }
});

test('musical phrases have full-body steps, overhead reaches and a complete finale turn',()=>{
 const samples=Array.from({length:161},(_,i)=>sampleGroove(3,i*8/160*60/112));
 assert.ok(Math.max(...samples.map(p=>p.leftArm))>2.4);
 assert.ok(Math.max(...samples.map(p=>p.leftKnee))>.8);
 assert.ok(Math.max(...samples.map(p=>p.shiftX))>.2);
 assert.ok(samples.at(-2).turnY>Math.PI*1.9);
 for(let part=0;part<4;part++)for(let i=0;i<160;i++)for(const value of Object.values(sampleGroove(part,i*.05)))assert.ok(Number.isFinite(value));
});
