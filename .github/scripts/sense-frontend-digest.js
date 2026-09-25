/**
 * Daily changelog digest for sense_frontend.
 *
 * Fetches PRs merged to getathelas/sense_frontend:master in the last N hours,
 * spawns a Cursor Cloud Agent that reads .cursor/rules/doc_writer.mdc and
 * writes a Mintlify <Update> block to a scratch branch on this repo, then
 * fetches that content back and deletes the branch. The workflow's next
 * step posts the digest as a GitHub Issue.
 *
 * Env:
 *   CURSOR_API_KEY              - required, from cursor.com/settings
 *   OWN_REPO_TOKEN              - required, GitHub token with contents:write on
 *                                 this repo (workflow's built-in GITHUB_TOKEN
 *                                 with permissions.contents:write suffices)
 *   SENSE_FRONTEND_GITHUB_TOKEN - required, PAT with read on getathelas/sense_frontend
 *   OWN_REPO                    - GITHUB_REPOSITORY (auto-set on runners)
 *   LOOKBACK_HOURS              - default 24
 *   DIGEST_DATE                 - optional YYYY-MM-DD override for the label
 */

const fs = require('node:fs/promises');
const path = require('node:path');

const {
  CURSOR_API_KEY,
  OWN_REPO_TOKEN,
  SENSE_FRONTEND_GITHUB_TOKEN,
  GITHUB_REPOSITORY: OWN_REPO,
  LOOKBACK_HOURS = '24',
  DIGEST_DATE,
  GITHUB_OUTPUT,
} = process.env;

if (!CURSOR_API_KEY) throw new Error('CURSOR_API_KEY not set');
if (!OWN_REPO_TOKEN) throw new Error('OWN_REPO_TOKEN not set');
if (!SENSE_FRONTEND_GITHUB_TOKEN) throw new Error('SENSE_FRONTEND_GITHUB_TOKEN not set');
if (!OWN_REPO) throw new Error('GITHUB_REPOSITORY not set');

const cursorAuth = () => ({
  Authorization: `Basic ${Buffer.from(`${CURSOR_API_KEY}:${CURSOR_API_KEY}`).toString('base64')}`,
  'Content-Type': 'application/json',
});

const REPO = 'getathelas/sense_frontend';
// develop = staging. Merges here are individual features landing before the
// next release cut, so this is where "fine-grained changelog" content lives.
// master is release cuts (batched Release/xxx branches) — too coarse.
const BASE_BRANCH = 'develop';
const LOOKBACK = Number(LOOKBACK_HOURS);
const NOW = new Date();
const SINCE = new Date(NOW.getTime() - LOOKBACK * 3600 * 1000);
const DATE_LABEL = DIGEST_DATE || NOW.toISOString().slice(0, 10);

async function ghFetch(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SENSE_FRONTEND_GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${url}: ${await res.text()}`);
  return res.json();
}

async function fetchMergedPRs() {
  try {
    await ghFetch(`https://api.github.com/repos/${REPO}`);
  } catch (err) {
    throw new Error(
      `Cannot reach ${REPO}. Check that SENSE_FRONTEND_GITHUB_TOKEN is a fine-grained PAT with:\n` +
        `  - Resource owner: getathelas\n` +
        `  - Repository access: getathelas/sense_frontend\n` +
        `  - Permissions: Contents: Read, Pull requests: Read, Metadata: Read\n` +
        `  - Org admin approval (if required by getathelas org policy)\n\n` +
        `Underlying error: ${err.message}`,
    );
  }

  const merged = [];
  const sinceIso = SINCE.toISOString();
  for (let page = 1; page <= 5; page++) {
    const url = `https://api.github.com/repos/${REPO}/pulls?state=closed&base=${BASE_BRANCH}&sort=updated&direction=desc&per_page=100&page=${page}`;
    const items = await ghFetch(url);
    if (!items.length) break;
    for (const pr of items) {
      if (pr.merged_at && pr.merged_at >= sinceIso) {
        merged.push({
          number: pr.number,
          title: pr.title,
          user: pr.user?.login || 'unknown',
          body: pr.body || '',
          labels: (pr.labels || []).map((l) => l.name),
        });
      }
    }
    const oldest = items[items.length - 1];
    if (oldest.updated_at < sinceIso) break;
  }

  // Enrich each PR with a file summary — helps the drafter identify user-
  // facing changes (frontend/features/*) vs infra/tests/deps.
  for (const pr of merged) {
    try {
      const files = await ghFetch(
        `https://api.github.com/repos/${REPO}/pulls/${pr.number}/files?per_page=100`,
      );
      const dirCounts = {};
      for (const f of files) {
        const topDir = f.filename.split('/').slice(0, 3).join('/');
        dirCounts[topDir] = (dirCounts[topDir] || 0) + 1;
      }
      pr.fileSummary = Object.entries(dirCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([dir, n]) => `${dir} (${n})`)
        .join(', ');
    } catch {
      pr.fileSummary = '';
    }
  }

  return merged;
}

function trimBody(body, max = 1500) {
  if (!body) return '';
  const cleaned = body.replace(/<!--[\s\S]*?-->/g, '').trim();
  return cleaned.length > max ? cleaned.slice(0, max) + '…' : cleaned;
}

async function draftDigest(prs) {
  const branchName = `digest/${DATE_LABEL}-${Date.now()}`;
  const outputPath = `_digests/agent-output-${DATE_LABEL}.md`;

  const humanDate = new Date(DATE_LABEL).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Anonymize each PR as "Change N" — the agent should never see PR numbers
  // or committer names, so it can't leak them into the output.
  const prSummaries = prs
    .map((pr, i) => {
      const labels = pr.labels?.length ? `\n  Labels: ${pr.labels.join(', ')}` : '';
      const files = pr.fileSummary ? `\n  Files (top dirs): ${pr.fileSummary}` : '';
      return `Change ${i + 1}:\n  Title: ${pr.title}${labels}${files}\n  Description: ${trimBody(pr.body)}`;
    })
    .join('\n\n');

  const agentPrompt = `You are drafting a daily changelog digest for **external Air customers** — practice admins, providers, front-desk staff, and billers using the Air EHR. This content will be emailed to real customers within hours of you writing it. Treat every line as customer-facing and contract-adjacent.

## Steps (in order)

1. Read .cursor/rules/doc_writer.mdc completely. It defines tone, canonical product names, banned terms, and quality bars. Every rule in that file applies here.
2. Write the digest to a NEW file at ${outputPath}. That file must contain exactly one Mintlify <Update> block and nothing else.
3. Commit and push to your branch. Do NOT open a PR. Do NOT modify any other files.

## Absolute rules (violating any of these breaks the pipeline)

- **NEVER include** PR numbers, GitHub URLs, commit hashes, branch names, ticket IDs (Linear, Jira), developer usernames, or references to "Change 1 / Change 2" from the input below.
- **NEVER include** internal codenames: ARES, Triron, Gladriel, Galadriel, Normandy, Openclaw, sense_frontend, or any repository/service name. Refer to the product as "Air" only.
- **NEVER include** pricing, dollar amounts we charge, dated roadmap commitments ("coming in October"), unreleased features that aren't beta-available, or sales/marketing spin.
- **NEVER fabricate.** If a change's description is too thin to say something concrete and true about it, SKIP it. Silence is safer than invention.

## Structure (this shape is non-negotiable)

<Update label="${humanDate}" tags={["Air"]}>

  ## New

  ### <Feature or capability name (noun phrase)>
  _<Rollout state> · <Affected role or area>_

  <2–4 sentences of prose describing what shipped, why it matters, what workflow it improves or replaces. Written for a clinician / admin, not a developer. Bold UI element names inline (e.g. **Chart Notes**, **Save**).>

  Where to find it: **<Top-level section → Subsection → Action>**.

  ## Changed

  ### <Behavior-change name>
  _<Rollout state> · <Affected role or area>_

  <Prose describing the old behavior, the new behavior, and any workflow impact. Include the "why" if the description gives it.>

  ## Fixed

  - **<UI label or workflow>** — one-sentence description of the fix and where it was noticeable.
  - **<Another fix>** — ...

</Update>

## Section rules

- **Prioritized top-down**: New before Changed before Fixed. Omit any section that would be empty — do not write "None" placeholders.
- **New**: substantive net-new capabilities. Beta or limited rollouts allowed IF a customer can actually be enabled today (label them e.g. \`_Beta customers · Providers_\`).
- **Changed**: behavior changes to existing features. Reader needs to know if their workflow just shifted.
- **Fixed**: bug fixes noticeable to customers. Collapse to one-line bullets — do not give a small fix a paragraph.
- **Rollout state**: pick one of \`Live now\`, \`Rolls out with next release\`, \`Beta customers\`. If you cannot infer it confidently, use \`Rolls out with next release\` (these are develop-branch merges, so that is the safe default).
- **Affected role or area**: use \`All users\`, \`Providers\`, \`Front desk\`, \`Admins\`, \`Billers\`, \`Patients (portal)\` — or a specific area like \`Providers, in Flowsheets\`.
- **Where to find it**: only include when the location is non-obvious. Skip for fixes and for changes to something the user is already staring at.

## Classification & filtering

For every input Change below, decide:
1. Is this **user-facing**? (Renders differently, behaves differently, or enables a workflow. NOT: refactors, tests, CI, dependency bumps, internal telemetry, developer tooling.) If no → SKIP silently.
2. Is the description **rich enough** to write something concrete and true? A one-line title with no body is usually NOT rich enough. When in doubt → SKIP.
3. Is this a **new capability**, a **behavior change**, or a **fix**? Route to the matching section.
4. Can this be **grouped** with another Change? Multiple PRs on the same feature should combine into one entry, not appear separately.

Be RUTHLESS. A digest with 3 crisp entries beats one with 12 padded ones. If literally nothing is worth writing, output EXACTLY the text \`NO_MEANINGFUL_CHANGES\` (nothing else) so the pipeline skips distribution.

## Input — Changes merged to \`develop\` in the last ${LOOKBACK} hours

${prSummaries || '(no changes)'}
`;

  console.log(`Spawning Cursor agent on ${OWN_REPO} branch ${branchName}…`);
  const spawnRes = await fetch('https://api.cursor.com/v0/agents', {
    method: 'POST',
    headers: cursorAuth(),
    body: JSON.stringify({
      prompt: { text: agentPrompt },
      source: { repository: OWN_REPO, ref: 'main' },
      target: { branchName, autoCreatePr: false },
    }),
  });
  if (!spawnRes.ok) {
    throw new Error(`Cursor spawn ${spawnRes.status}: ${(await spawnRes.text()).slice(0, 500)}`);
  }
  const agent = await spawnRes.json();
  const actualBranch = agent.target?.branchName || agent.branchName || branchName;
  console.log(`Agent ${agent.id} running (branch: ${actualBranch})`);

  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 30000));
    const statusRes = await fetch(`https://api.cursor.com/v0/agents/${agent.id}`, {
      headers: cursorAuth(),
    });
    const status = await statusRes.json();
    console.log(`  [${(i + 1) * 30}s] status=${status.status}`);
    if (status.status === 'FINISHED') break;
    if (status.status === 'FAILED' || status.status === 'ERRORED') {
      throw new Error(`Cursor agent failed: ${JSON.stringify(status).slice(0, 500)}`);
    }
    if (i === 23) throw new Error('Cursor agent timed out after 12 minutes');
  }

  await new Promise((r) => setTimeout(r, 5000)); // small grace for git push visibility

  console.log(`Fetching ${outputPath} from branch ${actualBranch}…`);
  const contentRes = await fetch(
    `https://api.github.com/repos/${OWN_REPO}/contents/${outputPath}?ref=${encodeURIComponent(actualBranch)}`,
    { headers: { Authorization: `Bearer ${OWN_REPO_TOKEN}`, Accept: 'application/vnd.github+json' } },
  );
  if (!contentRes.ok) {
    throw new Error(
      `Could not fetch ${outputPath} from branch ${actualBranch}: ${contentRes.status} ${await contentRes.text()}`,
    );
  }
  const contentData = await contentRes.json();
  const content = Buffer.from(contentData.content, 'base64').toString('utf8').trim();

  // Best-effort cleanup — leave the branch behind if delete fails (nightly runs
  // would leak branches otherwise but a failed delete shouldn't fail the run).
  const delRes = await fetch(
    `https://api.github.com/repos/${OWN_REPO}/git/refs/heads/${encodeURIComponent(actualBranch)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${OWN_REPO_TOKEN}` } },
  ).catch((err) => ({ ok: false, statusText: err.message }));
  console.log(delRes.ok ? `Deleted branch ${actualBranch}` : `Warning: could not delete ${actualBranch} (${delRes.status || delRes.statusText})`);

  return content;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

function renderInline(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((https?:[^\s)]+)\)/g, '<a href="$2" style="color:#F9345F;">$1</a>');
}

function markdownToEmailHtml(md, prCount) {
  // Strip Mintlify <Update> wrapper — email clients don't render it.
  const stripped = md
    .replace(/<Update[^>]*>/g, '')
    .replace(/<\/Update>/g, '')
    .trim();

  const bodyHtml = stripped
    .split(/\n{2,}/)
    .map((para) => {
      const p = para.trim();
      if (/^###\s/.test(p))
        return `<h3 style="color:#F9345F;margin:24px 0 8px;font-size:16px;">${renderInline(p.replace(/^###\s+/, ''))}</h3>`;
      if (/^##\s/.test(p))
        return `<h2 style="color:#F9345F;margin:24px 0 8px;font-size:18px;">${renderInline(p.replace(/^##\s+/, ''))}</h2>`;
      if (/^---$/.test(p))
        return `<hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />`;
      if (/^-\s/.test(p)) {
        const items = p
          .split(/\n/)
          .filter((l) => /^-\s/.test(l))
          .map((l) => `<li style="margin:4px 0;">${renderInline(l.replace(/^-\s+/, ''))}</li>`)
          .join('');
        return `<ul style="margin:8px 0;padding-left:20px;">${items}</ul>`;
      }
      return `<p style="margin:8px 0;line-height:1.5;">${renderInline(p)}</p>`;
    })
    .join('\n');

  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#222;background:#fff;">
<h1 style="color:#F9345F;border-bottom:2px solid #F9345F;padding-bottom:8px;font-size:22px;">sense_frontend daily digest — ${DATE_LABEL}</h1>
<p style="color:#666;font-size:13px;margin:8px 0 24px;">${prCount} PR${prCount === 1 ? '' : 's'} merged to master in the last ${LOOKBACK}h. Drafted by a Cursor Cloud Agent; verify before forwarding.</p>
${bodyHtml}
</body></html>`;
}

async function writeOutput(kv) {
  if (!GITHUB_OUTPUT) return;
  const lines = Object.entries(kv)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  await fs.appendFile(GITHUB_OUTPUT, lines + '\n');
}

async function main() {
  console.log(`Fetching PRs merged to ${REPO}:${BASE_BRANCH} since ${SINCE.toISOString()}`);
  const prs = await fetchMergedPRs();
  console.log(`Found ${prs.length} PR(s)`);

  const digestDir = '_digests';
  await fs.mkdir(digestDir, { recursive: true });
  const mdPath = path.join(digestDir, `sense-frontend-${DATE_LABEL}.md`);
  const htmlPath = path.join(digestDir, `sense-frontend-${DATE_LABEL}.html`);

  if (prs.length === 0) {
    await fs.writeFile(mdPath, `NO_MERGES\n\nNo PRs merged to ${REPO}:${BASE_BRANCH} in the last ${LOOKBACK}h.\n`);
    console.log('No PRs — skipping delivery.');
    await writeOutput({ skip_email: 'true', digest_date: DATE_LABEL, pr_count: '0' });
    return;
  }

  console.log(`Drafting digest via Cursor Cloud Agent…`);
  const draft = await draftDigest(prs);
  console.log(`Draft length: ${draft.length} chars`);

  if (draft === 'NO_MEANINGFUL_CHANGES') {
    await fs.writeFile(
      mdPath,
      `NO_MEANINGFUL_CHANGES\n\n${prs.length} PRs merged, none met the customer-facing signal bar.\n`,
    );
    console.log('Agent reported no meaningful customer-facing changes — skipping delivery.');
    await writeOutput({ skip_email: 'true', digest_date: DATE_LABEL, pr_count: String(prs.length) });
    return;
  }

  await fs.writeFile(mdPath, draft + '\n');
  await fs.writeFile(htmlPath, markdownToEmailHtml(draft, prs.length));
  console.log(`Wrote ${mdPath} and ${htmlPath}`);

  await writeOutput({
    skip_email: 'false',
    digest_date: DATE_LABEL,
    pr_count: String(prs.length),
    md_path: mdPath,
    html_path: htmlPath,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
