import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../ops/relay/001_ticket_directory.sql',import.meta.url),'utf8');
const count=re=>(sql.match(re)||[]).length;
test('relay migration has balanced PL/pgSQL function delimiters',()=>{
 const functions=count(/CREATE OR REPLACE FUNCTION public\.zoo_ops_/g);
 assert.ok(functions>=7);
 assert.equal(count(/\bAS \$\$/g),functions);
 assert.equal(count(/END \$\$;/g),functions+1);
});
test('relay migration has one final transaction commit',()=>{
 assert.equal(count(/\bCOMMIT;/g),1);
 assert.ok(sql.trim().endsWith('COMMIT;'));
});
test('relay dispatch receipt body has a complete lease-fenced update',()=>{
 assert.match(sql,/IF p_receipt !~/);
 assert.match(sql,/lease_owner=p_worker AND lease_token=p_token/);
});
