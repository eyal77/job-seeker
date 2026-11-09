// Run: node web/server.test.js. Checks that tool calls map to the right pipeline step.
const assert = require('assert');
const path = require('path');
const { stepOf } = require('./server');
const R = path.resolve(__dirname, '..');

assert.equal(stepOf('Bash', { command: 'python -I "C:/x/.claude/skills/job-seeker/scripts/docx2md.py" "x.docx" > cv/original_cv.md' }), 'cv');
assert.equal(stepOf('Read', { file_path: path.join(R, 'cv', 'original_cv.md') }), 'cv');
assert.equal(stepOf('mcp__chrome-devtools__navigate_page', { url: 'https://x' }), 'job');
assert.equal(stepOf('Write', { file_path: path.join(R, 'jobs', '01_a_b.md') }), 'job');
assert.equal(stepOf('Read', { file_path: path.join(R, 'input', 'pasted_job.md') }), 'job');
assert.equal(stepOf('Write', { file_path: path.join(R, 'output', '01_a_b', 'cv.md') }), 'tailor');
assert.equal(stepOf('Write', { file_path: path.join(R, 'output', '01_a_b', 'cv.round1.md') }), 'tailor');
assert.equal(stepOf('Write', { file_path: path.join(R, 'output', '01_a_b', 'cover_letter.md') }), 'letter');
assert.equal(stepOf('Write', { file_path: path.join(R, 'output', '01_a_b', 'validation.md') }), 'validate');
assert.equal(stepOf('Bash', { command: 'node "C:/x/.claude/skills/job-seeker/scripts/md2docx.js" output/a/cv.md output/a/cv.docx' }), 'docx');
assert.equal(stepOf('Write', { file_path: 'output/recommendation.md' }), 'recommend');
assert.equal(stepOf('Glob', { pattern: '*' }), null);
assert.equal(stepOf('Read', { file_path: 'output/recommendation.md' }), null);
assert.equal(stepOf('Read', { file_path: path.join(R, 'output', '01_a_b', 'cv.md') }), null);
console.log('ok');
