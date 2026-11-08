import test from 'node:test';
import assert from 'node:assert/strict';
import { TALK_HANDS, createTalkRps, winningHand, playTalkHand } from '../src/talk-rps.js';
const talk=()=>({rounds:createTalkRps(()=>0),turn:0,wins:0,chain:0,favor:45,discomfort:24,locked:false});
test('all nine matchups follow the hand cycle; only wins add a combo',()=>{
 for(const opponent of TALK_HANDS)for(const player of TALK_HANDS){
  const t=talk();t.rounds[0].hand=opponent.key;t.chain=2;
  const result=playTalkHand(t,player.key);
  const expected=player.key===opponent.key?'draw':player.beats===opponent.key?'win':'lose';
  assert.equal(result.grade,expected);assert.equal(result.chain,expected==='win'?3:0);
  assert.equal(result.correct,expected==='win');assert.equal(winningHand(opponent.key),TALK_HANDS.find(h=>h.beats===opponent.key).key);
 }
});
test('three wins can unlock an invitation despite two mistakes; two wins cannot',()=>{
 for(const wins of [2,3,5]){
  const t=talk();let result;
  for(let i=0;i<5;i++){
   t.turn=i;const key=i<wins?winningHand(t.rounds[i].hand):TALK_HANDS.find(h=>h.key!==t.rounds[i].hand&&h.key!==winningHand(t.rounds[i].hand)).key;
   result=playTalkHand(t,key);assert.equal(result.accepted,i===4&&wins>=3);Object.assign(t,result);
  }
  assert.equal(t.wins,wins);
 }
});
test('timeouts, locked taps and invalid hands never award a win',()=>{
 const t=talk();assert.equal(playTalkHand(t,'invalid'),null);
 const result=playTalkHand(t,'timeout');assert.equal(result.grade,'miss');assert.equal(result.wins,0);assert.equal(result.accepted,false);
 t.locked=true;assert.equal(playTalkHand(t,winningHand(t.rounds[0].hand)),null);
 t.locked=false;t.turn=5;assert.equal(playTalkHand(t,'rock'),null);
});
test('each round gives a readable cue and a bounded timer, with no consecutive repeated opponent hands',()=>{
 for(const random of [()=>0,()=>.5,()=>.999]){
  const rounds=createTalkRps(random);assert.equal(rounds.length,5);assert.equal(rounds[0].seconds,6);
  for(let i=0;i<5;i++){assert.ok(rounds[i].cue);assert.ok(rounds[i].seconds>=4.5);if(i)assert.notEqual(rounds[i].hand,rounds[i-1].hand);}
 }
});
