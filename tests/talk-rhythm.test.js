import test from 'node:test';
import assert from 'node:assert/strict';
import {RHYTHM,TALK_LANES,createTalkRhythm,advanceTalkRhythm,tapTalkRhythm,rhythmOutcome} from '../src/talk-rhythm.js';
const key=n=>TALK_LANES[n.lane].key;
test('each part has six notes, a bounded score and cannot unlock an invitation by itself',()=>{
 for(let variant=0;variant<3;variant++){
  const run=createTalkRhythm(variant);assert.equal(run.notes.length,6);
  for(const n of run.notes){const hit=tapTalkRhythm(run,key(n),n.time).hit;assert.equal(hit.grade,'perfect');}
  assert.equal(run.combo,6);assert.equal(run.points,80);assert.equal(rhythmOutcome(run,{favor:45,discomfort:24}).accepted,false);
  advanceTalkRhythm(run,RHYTHM.duration);assert.equal(rhythmOutcome(run,{favor:45,discomfort:24}).accepted,false);
 }
});
test('good timing, wrong lanes, early taps and double taps have distinct bounded outcomes',()=>{
 const run=createTalkRhythm(),n=run.notes[0];
 assert.equal(tapTalkRhythm(run,key(n),n.time-.5).hit,null);assert.equal(run.hits,0);
 assert.equal(tapTalkRhythm(run,key(n),n.time+.15).hit.grade,'good');const score=run.points;
 assert.equal(tapTalkRhythm(run,key(n),n.time+.15).hit,null);assert.equal(run.points,score);
 const next=run.notes[1];assert.equal(tapTalkRhythm(run,TALK_LANES[(next.lane+1)%3].key,next.time).hit.grade,'miss');
 assert.equal(tapTalkRhythm(run,key(next),next.time).hit,null);assert.equal(run.combo,0);assert.equal(run.misses,1);
});
test('all unattended notes miss, elapsed cannot rewind and finished charts cannot farm score',()=>{
 const run=createTalkRhythm();assert.equal(advanceTalkRhythm(run,RHYTHM.duration).length,6);assert.equal(run.misses,6);assert.equal(run.finished,true);
 assert.equal(rhythmOutcome(run,{favor:60,discomfort:24}).accepted,false);assert.equal(tapTalkRhythm(run,'joke',3),null);assert.deepEqual(advanceTalkRhythm(run,0),[]);
 const another=createTalkRhythm();advanceTalkRhythm(another,5);advanceTalkRhythm(another,2);assert.equal(another.elapsed,5);
});
test('only completing all four parts with enough total hits unlocks the invitation',()=>{
 for(const completedParts of [0,1,2,3,4]){const summary={finished:true,completedParts,hits:16,misses:8,notes:{length:24}};assert.equal(rhythmOutcome(summary,{favor:45,discomfort:24}).accepted,completedParts===4);}
});
