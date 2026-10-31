import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateReviewFeed} from '../review-feed.mjs';

const now=Date.parse('2026-10-31T22:00:00Z');
const row={
 event_id:'event_1',run_id:'run_schedule_1',review_run_id:'run_review_1',schedule_id:'sched_1',
 scheduled_for:'2026-10-31T21:45:00Z',finished_at:'2026-10-31T21:50:00Z',
 received_at:'2026-10-31T21:50:01Z',task_status:'COMPLETED',review_status:'passed',
 source_commit:'a'.repeat(40),intent_passed:8,intent_failed:0,intent_skipped:0,
 live_passed:4,live_failed:0,live_skipped:0,coverage:'Eight intent suites'
};
const feed=(changes={},observed_at='2026-10-31T21:59:00Z')=>({
 schema_version:1,provider:'trigger.dev',observed_at,
 latest:{...row,...changes},history:[{...row,...changes}]
});
const validCases=[
 ['ordinary UTC review',feed()],
 ['leap day in leap year',feed({scheduled_for:'2024-02-29T21:45:00Z',
  finished_at:'2024-02-29T21:50:00Z',received_at:'2024-02-29T21:50:01Z'})],
 ['fractional seconds and timezone offsets',feed({
  scheduled_for:'2026-10-31T17:45:00.123456-04:00',
  finished_at:'2026-10-31T17:50:00.654321-04:00',
  received_at:'2026-10-31T17:50:01.123456-04:00'})]
];
for(const [name,payload] of validCases)
 test('accept valid RFC3339 review evidence: '+name,()=>{
  assert.equal(evaluateReviewFeed(payload,now).valid,true);
 });
const invalidCases=[
 ['non-timestamp zero',feed({scheduled_for:'0'})],
 ['space-separated timestamp',feed({scheduled_for:'2026-10-31 21:45:00Z'})],
 ['February 30 review',feed({scheduled_for:'2026-02-28T21:45:00Z',
  finished_at:'2026-02-30T21:50:00Z',received_at:'2026-03-03T21:50:01Z'})],
 ['February 30 publication',feed({scheduled_for:'2026-02-28T21:45:00Z',
  finished_at:'2026-02-28T21:50:00Z',received_at:'2026-02-28T21:50:01Z'},
  '2026-02-30T21:59:00Z')],
 ['non-leap February 29',feed({scheduled_for:'2025-02-29T21:45:00Z'})],
 ['invalid timezone offset',feed({scheduled_for:'2026-10-31T21:45:00+24:00'})],
 ['invalid minute',feed({scheduled_for:'2026-10-31T21:60:00Z'})]
];
for(const [name,payload] of invalidCases)
 test('reject malformed review evidence: '+name,()=>{
  const result=evaluateReviewFeed(payload,now);
  assert.equal(result.valid,false);
  assert.equal(result.state,'UNKNOWN');
 });
