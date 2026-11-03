import {pathToFileURL} from 'node:url';

export function classify(jobs, annotations) {
  const messages = annotations.map(a => a.message || '');
  if (messages.some(m => /account is locked due to a billing issue/i.test(m))) return 'ACCOUNT_BILLING_LOCK';
  if (!jobs.length) return 'NO_JOBS_RECORDED';
  if (jobs.some(j => j.conclusion === 'failure' && !j.steps?.length)) return 'FAILED_BEFORE_STEPS';
  if (jobs.every(j => j.conclusion === 'success')) return 'SUCCESS';
  return 'NOT_SUCCESSFUL';
}

// Run outside Actions so runner startup failures remain observable.
export async function diagnose(repo, runId, {fetcher = fetch, token = process.env.GH_TOKEN} = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^\d+$/.test(String(runId))) throw Error('Expected owner/repo and numeric run ID');
  const get = async path => {
    const response = await fetcher(`https://api.github.com/repos/${repo}/${path}`, {
      headers: {Accept: 'application/vnd.github+json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error(`GitHub HTTP ${response.status}`);
    return response.json();
  };
  const pages = async (path, key) => {
    const all = [];
    for (let page = 1; page <= 100; page++) {
      const data = await get(`${path}?per_page=100&page=${page}`);
      const rows = key ? data[key] : data;
      if (!Array.isArray(rows)) throw Error('Invalid GitHub response');
      all.push(...rows);
      if (rows.length < 100) return all;
    }
    throw Error('Pagination limit exceeded');
  };
  const jobs = await pages(`actions/runs/${runId}/jobs`, 'jobs');
  const annotations = [];
  for (const job of jobs) annotations.push(...await pages(`check-runs/${job.id}/annotations`));
  return {
    observed_at: new Date().toISOString(), repository: repo, run_id: String(runId),
    status: classify(jobs, annotations),
    run_url: `https://github.com/${repo}/actions/runs/${runId}`,
    billing_url: 'https://github.com/settings/billing',
    jobs: jobs.map(j => ({id:j.id, conclusion:j.conclusion, step_count:j.steps?.length ?? 0})),
    annotations: annotations.map(a => ({level:a.annotation_level, message:a.message})),
    repository_write_verified: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await diagnose(process.argv[2], process.argv[3]);
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== 'SUCCESS') process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({status:'OBSERVATION_FAILED', error:error.message}));
    process.exitCode = 2;
  }
}
