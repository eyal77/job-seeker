# job-seeker skill

A Claude Code skill that tailors your CV and a cover letter to job postings, validates them against your original CV, exports the CV and cover letter to Word, and ranks the jobs. It never applies or sends anything.

## Contents

```text
job-seeker/
├── SKILL.md            the skill (instructions Claude follows)
├── package.json        dependency for the Word export (docx)
└── scripts/
    ├── docx2md.py      Word CV to markdown (Python standard library only)
    └── md2docx.js      markdown CV to Word
```

## Install

1. Copy this folder to one of these locations:
   - `~/.claude/skills/job-seeker/` to use it in every project
   - `<project>/.claude/skills/job-seeker/` to use it in one project
2. Run `npm install` inside the folder. The skill also does this itself on first use.
3. Requirements: Node.js 20 or newer, Python 3, and Google Chrome.
4. Optional but recommended: add the Chrome browser tools so the skill can read full job postings:

   ```bash
   claude mcp add chrome-devtools --scope user -- npx chrome-devtools-mcp@latest
   ```

   Without them, the skill uses WebFetch, which may only return a paraphrase of the posting.

## Use

```text
/job-seeker https://www.linkedin.com/jobs/view/123 cv: C:\path\to\cv.docx
/job-seeker DevOps Engineer in Israel count 3 rounds 1
/job-seeker job: C:\path\to\job_description.txt
/job-seeker refine 01_acme_backend-engineer: make the cover letter shorter
```

- No job link? Use `job: <file>`, or paste the job description into the chat.
- `count N`: number of jobs to find (default 3). `rounds N`: maximum validator fix rounds (default 2).
- `refine`: changes an existing job's CV or letter. Earlier versions are moved to `output/<slug>/history/` and never deleted.
- Output for each job: `cv.md`, `cv.docx`, `cover_letter.md`, `cover_letter.docx`, `validation.md`, plus `output/recommendation.md` with the ranking.

The skill creates `cv/`, `jobs/`, and `output/` in the current project. These hold personal data, so add them to `.gitignore`.
