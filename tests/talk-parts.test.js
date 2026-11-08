import test from 'node:test';
import assert from 'node:assert/strict';
import {createTalkProgress,clearTalkPart,nextTalkPart,createTalkQte,advanceTalkQte,inputTalkQte} from '../src/talk-parts.js';
test('progress requires both a rhythm clear and a QTE clear, pays once and cannot skip parts',()=>{
 const p=createTalkProgress(),run={finished:true,hits:6,misses:0,points:110};
 assert.equal(nextTalkPart(p),false);assert.equal(clearTalkPart(p,run,{status:'active'}),false);
 assert.equal(clearTalkPart(p,{...run,hits:3},{status:'passed'}),false);assert.equal(clearTalkPart(p,{...run,finished:false},{status:'passed'}),false);
 assert.equal(clearTalkPart(p,run,{status:'passed'}),true);assert.equal(p.points,110);
 assert.equal(clearTalkPart(p,run,{status:'passed'}),false);assert.equal(p.points,110);
 assert.equal(nextTalkPart(p),true);assert.equal(nextTalkPart(p),false);
 for(const index of [1,2]){assert.equal(p.index,index);clearTalkPart(p,{...run,points:120},{status:'passed'});if(index===1)nextTalkPart(p);}
 assert.equal(nextTalkPart(p),false);assert.equal(p.points,350);assert.equal(p.hits,18);assert.deepEqual(p.cleared,[0,1,2]);
});
test('tap QTE accepts the visible timing window, rejects early or late taps and expires',()=>{
 for(const at of [.2,1.4,2.1]){const q=createTalkQte('tap');assert.equal(inputTalkQte(q,'tap',at),at===1.4?'passed':'failed');}
 const q=createTalkQte('tap');advanceTalkQte(q,4.1);assert.equal(inputTalkQte(q,'tap',1.4),'failed');
});
test('hold QTE requires continuous contact; release and cancellation cannot fake a long press',()=>{
 const q=createTalkQte('hold');inputTalkQte(q,'down',.2);assert.equal(advanceTalkQte(q,.8),'active');assert.equal(advanceTalkQte(q,.95),'passed');
 const early=createTalkQte('hold');inputTalkQte(early,'down',.1);assert.equal(inputTalkQte(early,'up',.4),'failed');
 const cancelled=createTalkQte('hold');inputTalkQte(cancelled,'down',.1);inputTalkQte(cancelled,'cancel',.3);assert.equal(advanceTalkQte(cancelled,1.5),'active');
});
test('swipe requires a rightward gesture with a bounded distance, vertical drift and duration',()=>{
 for(const [end,time,expected] of [[{x:100,y:10},.5,'passed'],[{x:-100,y:0},.5,'failed'],[{x:30,y:0},.5,'failed'],[{x:100,y:100},.5,'failed'],[{x:100,y:0},2,'failed']]){
  const q=createTalkQte('swipe');inputTalkQte(q,'down',.1,{x:0,y:0});assert.equal(inputTalkQte(q,'up',time,end),expected);
 }
});
