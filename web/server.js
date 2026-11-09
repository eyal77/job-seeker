// Local web UI for the job-seeker skill. Runs `claude -p "/job-seeker ..."` headless and streams progress.
// Start: npm start  ->  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;
const CV_EXTS = ['.docx', '.md', '.txt'];
const LAST_RUN = 'output/.last_run.json';
const DEFAULT_BUDGET = Number(process.env.JOB_SEEKER_BUDGET_USD) || 3; // USD per run
const rel = (p) => path.relative(ROOT, path.resolve(ROOT, p)).split(path.sep).join('/');

// Tools the headless run may use. Anything else is denied (print mode cannot prompt).
const ALLOWED_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'Skill', 'mcp__chrome-devtools',
  'Bash(python:*)', 'Bash(node:*)', 'Bash(npm install:*)', 'Bash(mkdir:*)', 'Bash(ls:*)', 'Bash(cp:*)', 'Bash(mv:*)', 'Bash(date:*)'];

// Map a tool call to the pipeline step it belongs to (mirrors the steps in SKILL.md).
function stepOf(name, input = {}) {
  const f = rel(input.file_path || input.path || '.');
  const cmd = input.command || '';
  if (cmd.includes('docx2md') || f === 'cv/original_cv.md') return 'cv';
  if (cmd.includes('md2docx')) return 'docx';
  if (name.startsWith('mcp__chrome-devtools') || name === 'WebFetch' || f.startsWith('jobs/') || f.startsWith('input/')) return 'job';
  if (!['Write', 'Edit'].includes(name)) return null; // reading old outputs is not progress
  if (/\/validation\.md$/.test(f)) return 'validate';
  if (/\/cover_letter(\.round\d+)?\.md$/.test(f)) return 'letter';
  if (/\/cv(\.round\d+)?\.md$/.test(f)) return 'tailor';
  if (f === 'output/recommendation.md') return 'recommend';
  return null;
}

function describe(name, input = {}) {
  if (input.file_path) return `${name} ${rel(input.file_path)}`;
  if (input.command) return `${name}: ${input.command.slice(0, 120)}`;
  if (input.url) return `${name} ${input.url}`;
  return name.replace(/^mcp__chrome-devtools__/, 'browser: ');
}

let running = null; // ponytail: one run at a time, it's a single-user local tool

function startRun(body, res) {
  // Cost control (PRD NFR): hard spending cap per run, enforced by the claude CLI.
  const budget = Math.min(20, Math.max(0.5, Number(body.budget) || DEFAULT_BUDGET));
  const rounds = Math.min(3, Math.max(1, parseInt(body.rounds, 10) || 2));

  // Refine (PRD 5.5 "new user prompt"): change an existing job's outputs.
  if (body.refine) {
    const slug = String(body.refine.slug || '');
    const text = String(body.refine.text || '').trim();
    if (!/^[\w.-]+$/.test(slug) || !fs.existsSync(path.join(ROOT, 'output', slug))) return json(res, 400, { error: 'That job folder was not found.' });
    if (text.length < 3 || text.length > 2000) return json(res, 400, { error: 'Describe the change you want (up to 2,000 characters).' });
    let last = {}; try { last = JSON.parse(fs.readFileSync(path.join(ROOT, LAST_RUN), 'utf8')); } catch {}
    return launch(res, `/job-seeker refine ${slug}: ${text.replace(/\s+/g, ' ')} rounds ${rounds}`, budget, last.jobUrl || null);
  }

  // Job: either a URL, or the pasted description text (when the user has no link).
  let url = null;
  const jobText = typeof body.jobText === 'string' ? body.jobText.trim() : '';
  if (jobText) {
    if (jobText.length < 200) return json(res, 400, { error: 'The pasted job description is too short. Paste the full posting.' });
    if (jobText.length > 50000) return json(res, 400, { error: 'The pasted job description is too long (over 50,000 characters).' });
  } else {
    try { url = new URL(body.jobUrl); } catch { return json(res, 400, { error: 'Enter a valid job URL, or paste the job description text.' }); }
    if (!/^https?:$/.test(url.protocol)) return json(res, 400, { error: 'The job URL must start with http or https.' });
    // A LinkedIn search link with a selected job -> that job's own page.
    const jobId = url.hostname.endsWith('linkedin.com') && url.searchParams.get('currentJobId');
    if (jobId && /^\d+$/.test(jobId)) url = new URL(`https://www.linkedin.com/jobs/view/${jobId}/`);
  }
  fs.mkdirSync(path.join(ROOT, 'cv'), { recursive: true });

  let cv = '';
  if (body.cvBase64) {
    const ext = path.extname(body.cvName || '').toLowerCase();
    if (!CV_EXTS.includes(ext)) return json(res, 400, { error: 'The CV must be a .docx, .md or .txt file.' });
    const buf = Buffer.from(body.cvBase64, 'base64');
    if (buf.length > 5e6) return json(res, 400, { error: 'The CV file is larger than 5 MB.' });
    cv = path.join(ROOT, 'cv', 'uploaded' + ext);
    fs.writeFileSync(cv, buf);
  } else if (body.cvPath) {
    cv = body.cvPath.trim().replace(/^"|"$/g, '');
    if (!CV_EXTS.includes(path.extname(cv).toLowerCase()) || !fs.existsSync(cv)) return json(res, 400, { error: `No .docx, .md or .txt file found at ${cv}.` });
  } else if (!fs.existsSync(path.join(ROOT, 'cv/original_cv.md'))) {
    return json(res, 400, { error: 'Upload a CV or enter the path to one.' });
  }
  if (typeof body.profile === 'string') fs.writeFileSync(path.join(ROOT, 'cv/profile.md'), body.profile);

  let job = url && url.href;
  if (jobText) {
    fs.mkdirSync(path.join(ROOT, 'input'), { recursive: true });
    job = `job: ${path.join(ROOT, 'input', 'pasted_job.md')}`;
    fs.writeFileSync(path.join(ROOT, 'input', 'pasted_job.md'), jobText);
  }
  launch(res, `/job-seeker ${job}${cv ? ` cv: ${cv}` : ''} rounds ${rounds}`, budget, url ? url.href : null);
}

// Run the skill headless and stream progress to the browser as NDJSON.
function launch(res, prompt, budget, jobUrl) {
  const child = spawn('claude', ['-p', '--output-format', 'stream-json', '--verbose', '--max-budget-usd', String(budget),
    '--permission-mode', 'acceptEdits', '--mcp-config', path.join(ROOT, '.mcp.json'),
    '--append-system-prompt', 'This run comes from the web UI and is non-interactive. Do not ask questions. Use sensible defaults and note them in output/recommendation.md. Run commands with the Bash tool (PowerShell is not allowed), one command per call, with literal paths and no shell variables.',
    '--allowedTools', ...ALLOWED_TOOLS], { cwd: ROOT });
  child.stdin.end(prompt);
  running = child;

  res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });
  const send = (o) => res.write(JSON.stringify(o) + '\n');
  const written = new Set();
  let lastResult = null;
  send({ type: 'log', text: `> ${prompt}` });

  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d;
    const lines = buf.split('\n'); buf = lines.pop();
    for (const line of lines) {
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      if (ev.type === 'assistant') for (const c of ev.message.content || []) {
        if (c.type === 'text' && c.text.trim()) send({ type: 'log', text: c.text.trim() });
        if (c.type === 'tool_use') {
          const step = stepOf(c.name, c.input);
          if (step) send({ type: 'step', id: step });
          send({ type: 'log', text: '• ' + describe(c.name, c.input) });
          const f = c.input && c.input.file_path && rel(c.input.file_path);
          if (f && /^(jobs|output)\//.test(f)) written.add(f);
        }
      }
      if (ev.type === 'result') {
        lastResult = { type: 'result', ok: !ev.is_error, text: ev.result, cost: ev.total_cost_usd, ms: ev.duration_ms };
        send(lastResult);
      }
    }
  });
  child.stderr.on('data', (d) => send({ type: 'log', text: String(d).trim() }));
  child.on('error', (e) => { send({ type: 'result', ok: false, text: `Could not start claude: ${e.message}` }); });
  child.on('close', (code) => {
    running = null;
    // Include the current files of every job folder that was touched (e.g. .docx written by Bash),
    // plus its job posting. Older versions in history/ are left out.
    for (const slug of new Set([...written].map((f) => (f.match(/^output\/([^/]+)\//) || [])[1]).filter(Boolean))) {
      if (slug === 'history') continue;
      for (const n of fs.readdirSync(path.join(ROOT, 'output', slug))) written.add(`output/${slug}/${n}`);
      written.add(`jobs/${slug}.md`);
      written.add('output/recommendation.md');
    }
    const files = [...written].filter((f) => !f.includes('/history/') && !path.basename(f).startsWith('.')
      && fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).isFile()).sort();
    send({ type: 'done', code, files });
    res.end();
    // Remember the last run so the UI can show it again after a refresh or restart.
    fs.mkdirSync(path.join(ROOT, 'output'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, LAST_RUN), JSON.stringify({ at: new Date().toISOString(), jobUrl, result: lastResult, files }));
  });
  res.on('close', () => { if (running === child) child.kill(); });
}

function json(res, status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }

module.exports = { stepOf };
if (require.main !== module) return;

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && u.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }
  if (req.method === 'GET' && u.pathname === '/api/state') {
    const read = (p) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return null; } };
    let last = null; try { last = JSON.parse(read(LAST_RUN)); } catch {}
    return json(res, 200, { hasCv: !!read('cv/original_cv.md'), profile: read('cv/profile.md') || '', running: !!running, last });
  }
  if (req.method === 'GET' && u.pathname === '/api/file') {
    const f = path.resolve(ROOT, u.searchParams.get('p') || '');
    const ok = ['output', 'jobs'].some((d) => f.startsWith(path.join(ROOT, d) + path.sep));
    if (!ok || !fs.existsSync(f)) return json(res, 404, { error: 'not found' });
    const docx = f.endsWith('.docx');
    res.writeHead(200, {
      'Content-Type': docx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain; charset=utf-8',
      ...(u.searchParams.has('download') && { 'Content-Disposition': `attachment; filename="${path.basename(f)}"` }),
    });
    return fs.createReadStream(f).pipe(res);
  }
  if (req.method === 'POST' && u.pathname === '/api/run') {
    if (running) return json(res, 409, { error: 'A run is already in progress.' });
    let data = '';
    req.on('data', (d) => { data += d; if (data.length > 8e6) req.destroy(); });
    req.on('end', () => { try { startRun(JSON.parse(data), res); } catch (e) { json(res, 400, { error: e.message }); } });
    return;
  }
  json(res, 404, { error: 'not found' });
}).listen(PORT, '127.0.0.1', () => console.log(`Job Seeker UI: http://localhost:${PORT}`));
