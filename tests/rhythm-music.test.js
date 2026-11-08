import test from 'node:test';
import assert from 'node:assert/strict';
import {createRhythmMusic} from '../src/rhythm-music.js';
import {RHYTHM} from '../src/talk-rhythm.js';
test('original music uses the chart tempo and can pause, resume and stop without leaving audible nodes',()=>{
 let ctx;class Audio{
  constructor(){ctx=this;this.currentTime=10;this.started=[];this.gains=[];}
  createGain(){const value={value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}};this.gains.push(value);return {gain:value,connect(){}};}
  createOscillator(){return {frequency:{value:0},connect(){},start:t=>this.started.push(t),stop(){}};}
  resume(){this.paused=false;return Promise.resolve();}suspend(){this.paused=true;return Promise.resolve();}close(){this.closed=true;return Promise.resolve();}
 }
 const music=createRhythmMusic({AudioContext:Audio});assert.ok(music);assert.ok(ctx.started.length>20);
 const origin=10.12;assert.ok(ctx.started.some(t=>Math.abs(t-origin-RHYTHM.leadIn)<1e-8));
 assert.ok(ctx.started.some(t=>Math.abs(t-origin-RHYTHM.leadIn-60/RHYTHM.bpm)<1e-8));
 const count=ctx.started.length;music.hit(0,true);assert.equal(ctx.started.length,count+1);
 ctx.currentTime=13.12;assert.ok(Math.abs(music.now()-3)<1e-8);music.pause();assert.equal(ctx.paused,true);music.resume();assert.equal(ctx.paused,false);
 music.stop();assert.equal(ctx.gains[0].value,0);assert.equal(ctx.closed,true);
 assert.equal(createRhythmMusic({}),null);
});
