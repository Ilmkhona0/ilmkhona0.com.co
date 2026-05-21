/**
 * loadtest.mjs — a tiny, dependency-free load test for ilmkhona0.com
 * ------------------------------------------------------------------
 * WHAT IT DOES
 *   It pretends to be many users at once. One computer opens lots of
 *   connections to your site in parallel, each acting like a separate
 *   visitor hitting the same endpoint over and over for a few seconds.
 *   It runs several "stages" with more and more simultaneous users, so
 *   you can watch where (if anywhere) your site starts to struggle.
 *
 * WHY THIS ENDPOINT
 *   We hit GET /api/comments. It READS from MongoDB but never writes,
 *   so hammering it opens real database connections (the thing we want
 *   to stress) without filling your database with junk data.
 *
 * HOW TO RUN  (needs Node 18+, which you have — Node 22 locally, 24 on Vercel)
 *   1. Open a terminal in this project folder.
 *   2. Run:   node loadtest.mjs
 *
 *   Change the target or the stages with environment variables, e.g.:
 *     TARGET="https://ilmkhona0.com.co/api/comments" node loadtest.mjs
 *     MAX_USERS=300 node loadtest.mjs
 *
 * HOW TO READ THE RESULTS  (printed after each stage)
 *   - OK / FAILED .... how many requests succeeded vs. failed.
 *       A healthy site has 0 failures. Failures climbing as users rise
 *       = you found a limit (often the MongoDB connection cap).
 *   - status codes ... 200 = good. 500 = your server/DB errored.
 *       429 = rate limited. Anything that isn't 2xx is a problem.
 *   - latency ........ how long requests took, in milliseconds.
 *       p95 = "95% of requests were faster than this." Watch p95 climb;
 *       when it shoots up, the site is under strain.
 *   - req/sec ........ throughput. If it stops rising as you add users,
 *       you've hit the ceiling of what the site can serve.
 */

// ---- Configuration -------------------------------------------------
const TARGET =
  process.env.TARGET || "https://ilmkhona0.com.co/api/comments";

// Each stage: how many simultaneous virtual users, and for how long.
// We start gentle and ramp up so nothing gets hurt by surprise.
const MAX_USERS = Number(process.env.MAX_USERS || 200);
const STAGE_SECONDS = Number(process.env.STAGE_SECONDS || 12);
// A gentle ramp up to MAX_USERS so you can see exactly where trouble starts.
const RAMP = [10, 25, 50, 100, 200, 350, 500, 750, 1000, 1500, 2000];
const STAGES = RAMP
  .filter((n, i, arr) => n <= MAX_USERS && arr.indexOf(n) === i)
  .map((users) => ({ users, seconds: STAGE_SECONDS }));
if (!STAGES.some((s) => s.users === MAX_USERS)) {
  STAGES.push({ users: MAX_USERS, seconds: STAGE_SECONDS });
}

// ---- One virtual user: loop, fire requests until the stage ends ----
async function virtualUser(deadline, stats) {
  while (Date.now() < deadline) {
    // Cache-buster so we always reach the server, never a cached copy.
    const url = `${TARGET}${TARGET.includes("?") ? "&" : "?"}_cb=${Date.now()}_${Math.random()}`;
    const start = performance.now();
    try {
      const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
      // Drain the body so the connection is freed for reuse.
      await res.arrayBuffer().catch(() => {});
      const ms = performance.now() - start;
      stats.latencies.push(ms);
      stats.total++;
      stats.status[res.status] = (stats.status[res.status] || 0) + 1;
      if (res.ok) stats.ok++;
      else stats.failed++;
    } catch (err) {
      const ms = performance.now() - start;
      stats.latencies.push(ms);
      stats.total++;
      stats.failed++;
      const key = err.code || err.cause?.code || err.name || "NetworkError";
      stats.errors[key] = (stats.errors[key] || 0) + 1;
    }
  }
}

// ---- Run a single stage with N concurrent virtual users ------------
async function runStage({ users, seconds }) {
  const stats = { total: 0, ok: 0, failed: 0, latencies: [], status: {}, errors: {} };
  const deadline = Date.now() + seconds * 1000;
  const swarm = [];
  for (let i = 0; i < users; i++) swarm.push(virtualUser(deadline, stats));
  await Promise.all(swarm);
  return { ...stats, seconds, users };
}

// ---- Helpers -------------------------------------------------------
function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}
const ms = (n) => `${n.toFixed(0)}ms`;

function printReport(r) {
  const lat = r.latencies.slice().sort((a, b) => a - b);
  const avg = lat.length ? lat.reduce((s, v) => s + v, 0) / lat.length : 0;
  const rps = (r.total / r.seconds).toFixed(1);
  const okPct = r.total ? ((r.ok / r.total) * 100).toFixed(1) : "0.0";

  console.log(`\n  ── ${r.users} simultaneous users, ${r.seconds}s ─────────────────`);
  console.log(`     requests : ${r.total}   (${rps} req/sec)`);
  console.log(`     OK       : ${r.ok}  (${okPct}%)`);
  console.log(`     FAILED   : ${r.failed}`);
  console.log(
    `     status   : ${Object.entries(r.status).map(([c, n]) => `${c}×${n}`).join("  ") || "—"}`
  );
  if (Object.keys(r.errors).length) {
    console.log(
      `     errors   : ${Object.entries(r.errors).map(([e, n]) => `${e}×${n}`).join("  ")}`
    );
  }
  console.log(
    `     latency  : min ${ms(lat[0] || 0)} | avg ${ms(avg)} | p95 ${ms(percentile(lat, 95))} | max ${ms(lat[lat.length - 1] || 0)}`
  );
}

// ---- Main ----------------------------------------------------------
console.log("Load test — ilmkhona0");
console.log(`Target : ${TARGET}`);
console.log(`Stages : ${STAGES.map((s) => s.users).join(" → ")} users, ${STAGE_SECONDS}s each`);
console.log("Tip    : 0 failures + flat latency = healthy. Rising failures or p95 = a limit.");

for (const stage of STAGES) {
  process.stdout.write(`\nRunning ${stage.users} users…`);
  const result = await runStage(stage);
  printReport(result);
}

console.log("\nDone. If failures or 500s appeared at higher user counts, that's likely");
console.log("the MongoDB Atlas connection limit — the place to harden first.\n");
