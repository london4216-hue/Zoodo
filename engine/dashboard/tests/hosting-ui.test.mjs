import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const html=readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../index.html'),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1]||'';
test('real multi-host status panel is added without removing the owner navigation',()=>{
 assert.ok(html.indexOf('id="accountability"')<html.indexOf('id="hostingFailover"'));
 assert.ok(html.indexOf('id="hostingFailover"')<html.indexOf('YOUR HOME / QUICK LINKS'));
 assert.ok(html.includes('id="hostMirrorRows"'));
 assert.ok(html.includes('https://prestigeengage-demo.netlify.app/'));
 assert.ok(html.includes('https://transcendiq-control-panel.netlify.app/pitch/control-panel.html'));
});
test('unconfigured hosts are never misrepresented as live',()=>{
 assert.match(script,/NOT CONNECTED · no mirror deployment or failover claim/);
 assert.match(script,/SOURCE BUILD MATCHED/);
 assert.match(script,/browser journey\/DNS failover not verified/);
 assert.match(script,/source_commit!==expected/);
});
test('host verification retries with existing evidence polling, no forced navigation',()=>{
 assert.match(script,/checkHostingMirrors\(\)\.catch/);
 assert.match(script,/setInterval\(update,30000\)/);
 assert.ok(!script.includes('window.location.assign('));
 assert.ok(!script.includes('window.location.replace('));
});
