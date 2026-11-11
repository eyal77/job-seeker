"""Build an Agensi ZIP from the canonical Claude Code skill. Requires Python 3."""
import argparse
import json
from pathlib import Path
import re
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / '.claude' / 'skills' / 'job-seeker'


def replace_section(text, start, end, replacement):
    """Fail on upstream layout changes instead of silently shipping stale instructions."""
    if text.count(start) != 1 or text.count(end) != 1:
        raise ValueError(f'Canonical skill layout changed near {start!r}')
    before, rest = text.split(start, 1)
    _, after = rest.split(end, 1)
    return before + replacement.rstrip() + '\n\n' + end + after


def portable_skill():
    text = (SKILL / 'SKILL.md').read_text(encoding='utf-8')
    text = re.sub(r'^argument-hint:.*\n', '', text, flags=re.MULTILINE)
    text = text.replace('or runs /job-seeker', 'or requests Job Seeker')
    text = text.replace('Request: $ARGUMENTS', 'Request: use the user\'s current message and supplied files. Interpret options such as `count`, `rounds`, `cv:` and `refine` from that message.')
    text = replace_section(text, '**Paths:**', '## Hard rules', '''## Runtime and files

- Use the user's chosen working directory as `<workspace>`. Ask for one if there is no writable workspace. Resolve all input, output and dependency paths to absolute paths before running commands.
- `cv/`, `jobs/` and `output/` are inside that workspace. The host agent needs file read/write and command execution tools. Python 3 is needed for DOCX import. Node.js and npm are needed for Word export.
- Agensi supplies the helper scripts as text. When needed, write the complete supplied `scripts/docx2md.py` or `scripts/md2docx.cjs` unchanged to a unique temporary file using the host's file tools. Keep the `.py` and `.cjs` extensions. Run each independently, then remove only that temporary script in a cleanup step, including on failure. Never assume an installed skill directory or other package files exist on disk.
- Use the host's native filesystem tools or platform-appropriate shell commands for directories, copies, version archives and timestamps. On Windows, use PowerShell equivalents of the POSIX commands below. Quote every user-supplied path as a separate argument.
- Before Word export, check Node.js, npm and the `docx` dependency. If needed, install the pinned dependency into `<workspace>/.job-seeker-runtime` with `npm install --prefix "<workspace>/.job-seeker-runtime" --no-audit --no-fund docx@DOCX_VERSION`, following the host's approval rules. Pass that absolute directory as the exporter's third argument.
- If a required tool, runtime or install permission is unavailable, explain the missing capability. Preserve completed Markdown outputs and clearly mark Word export as incomplete. Never claim files were created without a successful command and an existence check.
'''.replace('DOCX_VERSION', json.loads((SKILL / 'package-lock.json').read_text())['packages']['node_modules/docx']['version']))
    text = text.replace('The browser runs hidden (headless) by default, so suggest pasting the job description text instead. If the browser window is visible, the user can also log in there themselves.', 'Ask the user to paste the job description text when access is blocked.')
    text = text.replace('Write only inside `jobs/` and `output/`.', 'Write persistent job results only inside `jobs/` and `output/`. CV imports, temporary scripts and the runtime dependency directory described above are the explicit exceptions.')
    text = text.replace('run `python -I "<skill>/scripts/docx2md.py" "<path>" > cv/original_cv.md` (create `cv/` first if needed; use `python3` if `python` is not found)', 'materialize the supplied importer as described above and run `python -I "<temporary-docx2md.py>" "<absolute-input.docx>"`. Use Python 3 (`python3` or `py -3` where appropriate). Capture stdout as UTF-8 to a temporary Markdown file. Only after successful import, replace `cv/original_cv.md` with that file, preserving any previous CV if conversion fails')
    text = replace_section(text, '5. Unless the job text was provided,', '## Step 1: Scrape jobs', '''5. Unless the job text was provided, check the host's available browser, search or page-fetch tools. If none can read the posting, ask for its text. Follow the host's tool and approval rules. Never require Claude Code commands or an MCP configuration file.
''')
    text = replace_section(text, 'If the user gave job URLs,', '## Step 2–4: Per job, generate and validate', '''If the user gave job URLs, read each posting using available browser or page-fetch tools. Otherwise, use available search/browser tools to find matching jobs on the board the user names, or LinkedIn Jobs by default. Open the matching results and read the full descriptions. If access fails or only a snippet is available, ask for the full posting instead of inventing requirements. Save each posting to `jobs/<NN>_<company>_<title-slug>.md` with title, company, location, link, actual retrieval date and description text. Mark any paraphrased description explicitly.
''')
    text = replace_section(text, '**Word export:**', 'Supported markdown:', '''**Word export:** once final versions are ready, materialize the supplied exporter and ensure dependencies are available as described under Runtime and files. Run it for both documents, including on reruns:
- `node "<temporary-md2docx.cjs>" "<workspace>/output/<slug>/cv.md" "<workspace>/output/<slug>/cv.docx" "<workspace>/.job-seeker-runtime"`
- `node "<temporary-md2docx.cjs>" "<workspace>/output/<slug>/cover_letter.md" "<workspace>/output/<slug>/cover_letter.docx" "<workspace>/.job-seeker-runtime"`

Check both exit codes and output files. Record any failure in `validation.md` and the recommendation. Check all generated `.md` and `.docx` files exist before reporting completion.
''')
    for unsupported in ('$ARGUMENTS', '<skill>', 'chrome-devtools', '/mcp', '.mcp.json'):
        if unsupported in text:
            raise ValueError(f'Unadapted runtime reference: {unsupported}')
    return text


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist' / 'job-seeker-agensi.zip')
    args = parser.parse_args()
    files = {
        'SKILL.md': portable_skill(),
        'scripts/docx2md.py': (SKILL / 'scripts/docx2md.py').read_text(encoding='utf-8'),
        'scripts/md2docx.cjs': (SKILL / 'scripts/md2docx.js').read_text(encoding='utf-8'),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Replace the destination only after the complete archive passes its CRC check.
    with tempfile.TemporaryDirectory(dir=args.output.parent) as staging:
        archive = Path(staging) / 'package.zip'
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
            for name, content in files.items():
                bundle.writestr(name, content.encode('utf-8'))
        with zipfile.ZipFile(archive) as bundle:
            if bundle.testzip() is not None:
                raise ValueError('ZIP integrity check failed')
        archive.replace(args.output)
    print(f'Created {args.output.resolve()} ({args.output.stat().st_size} bytes)')
    for name in files:
        print(f'  {name}')


if __name__ == '__main__':
    main()
