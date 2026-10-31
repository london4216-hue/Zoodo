// Run only on an authorized persistent host with a private, writable volume.
import {DurableQueue} from './durable-queue.mjs';
import {createIngressServer} from './webhook-ingress.mjs';
const secret=process.env.ZOO_GITHUB_WEBHOOK_SECRET;
const repos=(process.env.ZOO_ALLOWED_REPOS||'').split(',').map(s=>s.trim()).filter(Boolean);
const maintainers=(process.env.ZOO_APPROVED_LABELERS||'').split(',').map(s=>s.trim()).filter(Boolean);
const journal=process.env.ZOO_QUEUE_JOURNAL;
const port=Number(process.env.PORT||8080);
if(!secret||secret.length<16||!repos.length||!maintainers.length||!journal||!Number.isSafeInteger(port)||port<1||port>65535){
 console.error('Missing authorized webhook secret, allowlists, persistent queue journal, or valid PORT');
 process.exit(1);
}
const queue=new DurableQueue(journal,{leaseMs:60000,maxAttempts:3});
const server=createIngressServer({queue,secret,repos,maintainers});
server.listen(port,'0.0.0.0',()=>console.log('Zoo webhook ingress listening; provider dispatch NOT configured'));
