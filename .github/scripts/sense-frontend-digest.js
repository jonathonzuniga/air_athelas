/**
 * Daily changelog digest for sense_frontend.
 *
 * Fetches PRs merged to getathelas/sense_frontend:master in the last N hours,
 * asks a model on GitHub Models to draft a Mintlify <Update> block in the
 * voice defined by .cursor/rules/doc_writer.mdc, and writes the digest to
 * _digests/ so the workflow can email it and upload it as an artifact.
 *
 * Env:
 *   GITHUB_MODELS_TOKEN         - required, workflow's GITHUB_TOKEN (with
 *                                 permissions.models: read) or a PAT with
 *                                 the models:read scope
 *   SENSE_FRONTEND_GITHUB_TOKEN - required, PAT with read on getathelas/sense_frontend
 *   LOOKBACK_HOURS              - default 24
 *   DIGEST_DATE                 - optional YYYY-MM-DD override for the label
 *   MODEL                       - optional GH Models model id, default openai/gpt-4o
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const {
  GITHUB_MODELS_TOKEN,
  SENSE_FRONTEND_GITHUB_TOKEN,
  LOOKBACK_HOURS = '24',
  DIGEST_DATE,
  GITHUB_OUTPUT,
  MODEL = 'openai/gpt-4o',
} = process.env;

if (!GITHUB_MODELS_TOKEN) throw new Error('GITHUB_MODELS_TOKEN not set');
if (!SENSE_FRONTEND_GITHUB_TOKEN) throw new Error('SENSE_FRONTEND_GITHUB_TOKEN not set');

const REPO = 'getathelas/sense_frontend';
const BASE_BRANCH = 'master';
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
  // First, sanity-check that the token can see the repo at all. This gives a
  // much clearer error than paginating /pulls and getting a 404 mid-loop.
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

  // Walk /pulls sorted by updated desc, stopping when we cross the SINCE boundary.
  // per_page=100 is the max; we cap at 5 pages (500 PRs) as a safety limit for
  // very long lookback windows.
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
          html_url: pr.html_url,
          user: pr.user?.login || 'unknown',
          body: pr.body || '',
        });
      }
    }
    // The list is sorted by updated_at desc. If the oldest item on this page
    // is already older than SINCE, no later page can contain a fresher merge.
    const oldest = items[items.length - 1];
    if (oldest.updated_at < sinceIso) break;
  }
  return merged;
}

function trimBody(body, max = 1500) {
  if (!body) return '';
  const cleaned = body.replace(/<!--[\s\S]*?-->/g, '').trim();
  return cleaned.length > max ? cleaned.slice(0, max) + '…' : cleaned;
}

async function draftDigest(prs) {
  const skill = await fs.readFile('.cursor/rules/doc_writer.mdc', 'utf8');
  const humanDate = new Date(DATE_LABEL).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const prSummaries = prs
    .map(
      (pr) =>
        `- #${pr.number} "${pr.title}" by @${pr.user}\n  URL: ${pr.html_url}\n  Body: ${trimBody(pr.body)}`,
    )
    .join('\n\n');

  const prompt = `You are drafting an internal daily changelog digest for the sense_frontend repository (the Air EHR web app). It will be emailed to one internal reader — it is NOT published to docs.athelas.com and does NOT need images.

Follow the tone and structural rules in the attached doc_writer skill file. In particular:
- Use canonical product names (Air, Insights) — never "Air Clinical" / "Air Billing" / "Athelas EHR".
- No pricing, no dated roadmap commitments, no internal codenames, no sales-enablement asides.
- Ownership voice, not deficit voice. Second-person, present tense, active voice.
- Bold UI labels and key terms.

Output format — return EXACTLY one Mintlify <Update> block and nothing else:

<Update label="${humanDate}" tags={["Air"]}>

  ### <User-facing theme heading>

  <bulleted summary of what changed for the end user, not the diff>

  ### <Another theme>

  ...

  ### Bug Fixes and Improvements

  **<sub-area>:**
  - <fix in one line>

  ---

  **PRs included:**
  - [#123](url) — title
  - [#124](url) — title

</Update>

Grouping rules:
- Group by user-facing theme (Chart Notes, Scheduling, Reports, Messaging, Bug Fixes and Improvements, etc.), NOT by PR.
- SKIP infrastructure / CI / dependency / lint-only / test-only PRs from the themed sections, but list every PR in the "PRs included" appendix regardless so the reader can drill in.
- If the appendix is the only thing that would be non-empty (i.e. no user-facing changes at all), return exactly the string NO_USER_FACING_CHANGES with no other output.

--- doc_writer skill (must follow) ---
${skill}

--- PRs merged in the last ${LOOKBACK}h on ${REPO} base:${BASE_BRANCH} ---
${prSummaries || '(no PRs)'}
`;

  // Shell out to `gh models run` — the official GH CLI extension owns the
  // correct endpoint / auth / model-id conventions, so we don't have to guess.
  // The workflow installs it via `gh extension install github/gh-models`.
  return new Promise((resolve, reject) => {
    const child = spawn('gh', ['models', 'run', MODEL], {
      env: { ...process.env, GH_TOKEN: GITHUB_MODELS_TOKEN },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`gh models run exited ${code}\nstderr: ${stderr}\nstdout: ${stdout.slice(0, 500)}`));
        return;
      }
      resolve(stdout.trim());
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
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
<p style="color:#666;font-size:13px;margin:8px 0 24px;">${prCount} PR${prCount === 1 ? '' : 's'} merged to master in the last ${LOOKBACK}h. Drafted by ${MODEL} via GitHub Models; verify before forwarding.</p>
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

  console.log(`Drafting digest with ${MODEL} via GitHub Models…`);
  const draft = await draftDigest(prs);
  console.log(`Draft length: ${draft.length} chars`);

  if (draft === 'NO_USER_FACING_CHANGES') {
    await fs.writeFile(
      mdPath,
      `NO_USER_FACING_CHANGES\n\n${prs.length} PRs merged, all infra/refactor.\n\n${prs.map((p) => `- #${p.number} ${p.title}`).join('\n')}\n`,
    );
    console.log('Model reported no user-facing changes — skipping delivery.');
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
