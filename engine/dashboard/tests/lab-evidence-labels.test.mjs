import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const section=(start,end)=>{
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Expected dashboard function boundary');
 return html.slice(a,b);
};
const myblock=section('async function checkMyBlockLab(){','async function checkYB3Lab(){');
const yb3=section('async function checkYB3Lab(){','async function loadQueue(){');

test('My Block host asset check does not claim verified functional deployment',()=>{
 assert.match(myblock,/HOST ASSETS PRESENT · FUNCTIONAL WALK UNVERIFIED/);
 assert.match(myblock,/status\.className='pending'/);
 assert.doesNotMatch(myblock,/LIVE ON THIS HOST · HTML \+ LOGIC VERIFIED/);
});
test('YB3 host asset check does not show a green success class',()=>{
 assert.match(yb3,/HOST ASSETS PRESENT · FUNCTIONAL WALK UNVERIFIED/);
 assert.match(yb3,/status\.className='pending'/);
 assert.doesNotMatch(yb3,/status\.className='live'/);
});
test('lab source and launchpad links remain present',()=>{
 for(const path of ['/labs/myblock/index.html','/labs/yearbook3/index.html']){
  assert.ok(html.includes(path),'Missing '+path);
 }
 assert.ok(html.includes('id="accountability"'));
 assert.ok(html.includes('id="refresh"'));
});
