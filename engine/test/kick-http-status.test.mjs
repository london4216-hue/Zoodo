import test from 'node:test';
import assert from 'node:assert/strict';
import {kickHttpStatus} from '../ops/relay/kick-http-status.mjs';

test('confirmed kick states',()=>{for(const state of ['dispatched','delegated','idle'])assert.equal(kickHttpStatus({state}),200);});
test('unconfirmed kick states',()=>{for(const state of ['next-unconfirmed','uncertain','recovery_required','blocked'])assert.equal(kickHttpStatus({state}),503);});
test('invalid kick result',()=>{for(const result of [null,undefined,{},'dispatched'])assert.equal(kickHttpStatus(result),503);});
test('replacement does not certify original lease',()=>{assert.equal(kickHttpStatus({state:'uncertain',ticket:'T1',replacement:{state:'dispatched',ticket:'T2'}}),503);});
