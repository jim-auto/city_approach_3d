import test from 'node:test';
import assert from 'node:assert/strict';
import { createDateRun, scoreReply, dateTotal, createWalkRun, advanceWalk, respondWalk, collectWalkPoints, finishDate, dateRank, loadAlbum, saveAlbum } from '../src/date-run.js';

test('date score has an auditable breakdown, turn deduplication, rank and one arrival payout',()=>{
 const run=createDateRun();for(let i=0;i<5;i++){assert.equal(scoreReply(run,i,true),50+i*10);assert.equal(scoreReply(run,i,true),0);}
 assert.equal(run.conversation,350);run.consent=120;run.walk=300;
 const walk=createWalkRun({x:0,z:0},{x:0,z:50});walk.elapsed=40;
 assert.equal(finishDate(run,walk,true),280);assert.equal(dateTotal(run),1100);assert.equal(dateRank(run),'S');
 assert.equal(finishDate(run,walk,true),0);assert.equal(scoreReply(run,5,true),0);assert.equal(walk.finished,true);
 const practice=createDateRun();finishDate(practice,null,false);assert.equal(practice.tempo,0);assert.equal(practice.arrival,100);
});
test('correct responses build combos; mistakes reset the response bonus',()=>{
 const run=createDateRun();scoreReply(run,0,true);scoreReply(run,1,false);assert.equal(scoreReply(run,2,true),50);
});
const player={x:0,z:0},goal={x:0,z:60};
function move(run, from, to, gap=1) {for(let z=from+.2;z<to+.01;z+=.2)advanceWalk(run,.1,{x:0,z},{x:0,z:z-gap},goal);}
test('walking cues, nearby responses and bounded combos add score; repeated taps cannot farm points',()=>{
 const walk=createWalkRun(player,goal);move(walk,0,2);
 assert.ok(walk.prompt);const good=respondWalk(walk,1);assert.ok(good.points>0);assert.equal(walk.hits,1);assert.equal(respondWalk(walk,1),null);
 const paid=collectWalkPoints(walk);assert.ok(paid>=40);assert.equal(collectWalkPoints(walk),0);
 move(walk,2,8);assert.ok(walk.prompt);respondWalk(walk,1);assert.equal(walk.combo,2);
 move(walk,8,16);respondWalk(walk,1);move(walk,16,26);respondWalk(walk,1);
 assert.equal(walk.maxCombo,4);assert.equal(walk.count,4);assert.ok(walk.points<=300);
 for(let i=0;i<100;i++)advanceWalk(walk,.1,{x:0,z:26},{x:0,z:25},goal);
 assert.equal(walk.hits,4);assert.equal(walk.prompt,null);
});
test('moving away, standing still and teleporting cannot farm walking progress',()=>{
 const walk=createWalkRun(player,goal);for(let i=0;i<100;i++)advanceWalk(walk,.1,player,player,goal);
 assert.equal(walk.points,0);assert.equal(walk.prompt,null);
 advanceWalk(walk,.1,{x:0,z:40},{x:0,z:40},goal);assert.equal(walk.points,0);assert.equal(walk.progress,0);
 const normal=createWalkRun(player,goal);move(normal,0,2);respondWalk(normal,1);const before=normal.points;
 for(let z=2;z>=0;z-=.2)advanceWalk(normal,.1,{x:0,z},{x:0,z},goal);
 move(normal,0,2);assert.equal(normal.points,before);
});
test('far away responses do not score; waiting scores only after the companion catches up; expired prompts miss',()=>{
 const walk=createWalkRun(player,goal);move(walk,0,2,5);assert.equal(walk.prompt.wait,true);
 assert.equal(respondWalk(walk,5).wait,true);assert.equal(walk.hits,0);assert.equal(respondWalk(walk,5),null);
 advanceWalk(walk,.1,{x:0,z:2},{x:0,z:1},goal);assert.equal(walk.hits,1);assert.equal(walk.prompt,null);
 move(walk,2,8);assert.equal(respondWalk(walk,8).far,true);assert.equal(walk.hits,1);
 for(let i=0;i<22;i++)advanceWalk(walk,.25,{x:0,z:8},{x:0,z:7},goal);
 assert.equal(walk.misses,1);assert.equal(walk.combo,0);
 walk.finished=true;const elapsed=walk.elapsed;advanceWalk(walk,.2,player,player,goal);assert.equal(walk.elapsed,elapsed);
});
test('photo album and date best survive reload and tolerate invalid or blocked storage',()=>{
 const data=new Map(), storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const album={unlocked:['netcafe'],best:920,records:[{id:'waiting-netcafe',name:'ユイ',venue:'カスタマ',score:920,image:'data:image/webp;base64,dGVzdA=='}]};
 assert.equal(saveAlbum(storage,album),true);assert.deepEqual(loadAlbum(storage),album);
 assert.equal(saveAlbum(null,album),false);assert.deepEqual(loadAlbum(null),{unlocked:[],best:0,records:[]});
 data.set('city-approach-album-v1','{"unlocked":{},"best":-1,"records":[{"image":"javascript:alert(1)"}]}');assert.deepEqual(loadAlbum(storage),{unlocked:[],best:0,records:[]});
 assert.equal(saveAlbum({setItem(){throw Error('quota');}},album),false);
});


test('rhythm walks do not open old five-second prompts or apply missed-prompt penalties',()=>{
 const walk=createWalkRun({x:0,z:0},{x:0,z:50});walk.rhythmMode=true;
 for(let i=1;i<=180;i++)advanceWalk(walk,.1,{x:0,z:i*.2},{x:0,z:i*.2+1},{x:0,z:50});
 assert.equal(walk.prompt,null);assert.equal(walk.misses,0);assert.ok(walk.comfort>=65);
});
