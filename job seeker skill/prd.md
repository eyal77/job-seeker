# PRD: CV & Cover Letter Tailoring Agent

Source: whiteboard design from lesson 3 (mirrored photo). Items marked **[Assumption]** were hard to read and should be confirmed.

## 1. Problem
Job seekers must manually adapt their CV and write a cover letter for each posting. This is slow, inconsistent, and often misses what the job actually asks for.

## 2. Goal
Given a user prompt describing the job search, the agent finds matching jobs, tailors the user's original CV and a cover letter to each job, validates the result, and presents a recommendation the user can approve (send or save).

## 3. Users
- Primary: job seekers (the course students) who supply an original CV and search requirements.

## 4. Inputs
| Input | Description |
|---|---|
| User prompt | Free-text request, e.g. role, location, preferences |
| Job search requirements | Structured criteria extracted from the prompt |
| Company (and optionally job link/ID) | Target employer(s) **[Assumption: "IN (Company)" feeds the scraper]** |
| Original CV | The user's baseline CV |
| User profile requirements | Facts/constraints about the user the cover letter must respect |

## 5. System Components (pipeline)

### 5.1 Job Scraper
- Takes job search requirements (+ company) and returns job descriptions.
- Output: job description (JD) per match.

### 5.2 CV Generator (agent)
- Inputs: original CV, job description.
- Output: tailored CV for that job.
- Must not fabricate experience; only reorder, rephrase, and emphasize existing facts.

### 5.3 Cover Letter Generator (agent)
- Inputs: job description, tailored CV, user profile requirements.
- Output: cover letter for that job.

### 5.4 CV Critic / Validator
- Inputs: tailored CV, cover letter, job description/company attributes.
- Checks: fit to JD, factual consistency with original CV, tone, completeness.
- Output: validation reply, either pass or suggestions.
- On failure, suggestions loop back to the CV and cover letter generators (the **agent loop**), bounded by a max iteration count.

### 5.5 Output / Recommendation
- Presents the final CV, cover letter, and a recommendation summary (why this job fits).
- User actions: **Save** it, or give a **new user prompt** to refine and rerun.
- **Decision:** the application never sends anything. Only the user sends, outside the tool, using the saved files.

## 6. Flow
1. User submits prompt + original CV + profile.
2. Scraper retrieves jobs matching requirements.
3. For each job: CV Generator → Cover Letter Generator.
4. Validator scores and critiques. If it fails, loop back with suggestions (max N rounds).
5. Recommendation shown to the user. User sends, saves, or re-prompts.

## 7. Functional Requirements
- FR1: Parse the user prompt into job search requirements.
- FR2: Retrieve at least K job descriptions per query (K configurable).
- FR3: Generate a tailored CV per job from the original CV only.
- FR4: Generate a cover letter per job using the JD, tailored CV, and profile.
- FR5: Validate every output pair before it is shown to the user.
- FR6: Support an iterative critic loop with a configurable iteration cap.
- FR7: Let the user save or re-prompt. The application never sends or submits; only the user does.
- FR8: Keep the original CV unchanged; store every generated version.

## 8. Non-Functional Requirements
- Truthfulness: no invented skills, employers, or dates (enforced by the validator).
- Latency: first recommendation in under ~2 minutes per job **[Assumption]**.
- Cost control: iteration cap and token budget per run.
- Privacy: CV and profile data are used only for the session and stored locally unless the user opts in.
- Observability: log each loop iteration with validator feedback.

## 9. Success Metrics
- Validator pass rate within 2 iterations ≥ 80%.
- Zero factual-consistency violations in user spot checks.
- User acceptance rate (sent or saved without manual edits) ≥ 60%.

## 10. Out of Scope (v1)
- Auto-applying without user approval.
- Interview prep, salary negotiation.
- Scraping behind logins or sites that forbid it.

## 11. Risks & Open Questions
- Scraper legality and reliability (ToS, rate limits). Consider APIs or provided datasets.
- Hallucination in the CV generator. The validator must compare against the original CV.
- Infinite or low-value critic loops. Needs a cap and a "good enough" threshold.
- Resolved: one job or a batch. A run takes one job (URL or pasted text) or a search that returns `count N` jobs, ranked by fit.
- Resolved: "user profile requirements" are the optional `cv/profile.md` file (tone, language, length, must-mention items, companies to avoid). The web UI edits it under *Preferences*.
