# Package Job Seeker for Agensi

The Claude Code skill in `.claude/skills/job-seeker/` is the source of truth. The builder generates the Agensi instructions and packages only the skill and its two helpers. It adapts input handling, browser tools, temporary scripts and Word dependency resolution.

## Build on your laptop

From the repository root, run with Python 3 (no extra Python dependencies):

```powershell
py -3 tools/package_agensi.py
```

On macOS/Linux:

```bash
python3 tools/package_agensi.py
```

Upload `dist/job-seeker-agensi.zip` at https://www.agensi.io/dashboard/submit. Upload this generated ZIP, which contains exactly one SKILL.md. Rebuild after changing the canonical skill or helpers. The builder fails if expected sections have changed so the adaptations can be reviewed.

## Listing requirements

State that the buyer needs an agent with writable workspace and command execution. Job discovery needs browser/search access, with pasted job descriptions supported. DOCX import needs Python 3. Word export needs Node.js, npm and permission to download the pinned `docx` package. The buyer uses their own agent/model access.

The package supplies instructions and scripts. It does not host the web interface or supply an API key. Only claim compatibility with agents you have tested. Use synthetic CV data for listing examples. Choose your price and connect a payout method in Agensi before submitting a paid listing.

## Pre-publication verification

Run the generated skill through the intended agent with a sample CV and pasted posting, then check the Markdown, validation report and both Word files. Also test a job URL, blocked browsing, refinement and unavailable Word dependencies. Actual delivery through Agensi still needs verification after publication.

Packaging rules checked against https://www.agensi.io/docs/packaging on 2026-11-11.
