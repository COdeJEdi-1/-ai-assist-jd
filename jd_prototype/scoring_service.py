"""
scoring_service.py — Candidate Scorecard: JD-based matching & ranking.

Pipeline:
  1. extractJdRequirements(darwinbox_job_id)  — Groq LLM, cached in darwinbox_jobs.json
  2. extractResumeProfile(candidate_id)        — Groq LLM, cached in candidates.json
  3. computeCandidateScore(candidate_id, darwinbox_job_id) — deterministic, no LLM
  4. scoreCandidateOnSubmit(candidate_id)      — orchestrator, fire-and-forget
  5. rescoreCandidate(candidate_id, darwinbox_job_id) — manual re-score, forces re-extract
"""

import json
import math
import os
import re
import uuid
from datetime import datetime
from pathlib import Path

import requests

# ── Storage ───────────────────────────────────────────────────────────────────
_DATA_DIR = Path(__file__).parent / "darwin_data"
_DARWIN_JOBS_FILE = _DATA_DIR / "darwinbox_jobs.json"
_CANDIDATES_FILE = _DATA_DIR / "candidates.json"
_SCORES_FILE = _DATA_DIR / "candidate_scores.json"
_VOICE_AGENT_PUSHES_FILE = _DATA_DIR / "voice_agent_pushes.json"

# ── Voice-agent auto-screening handoff ────────────────────────────────────────
VOICE_AGENT_SCORE_THRESHOLD = 80

# ── Scoring weights (configurable) ────────────────────────────────────────────
WEIGHTS = {
    "skills":     0.40,
    "experience": 0.20,
    "education":  0.15,
    "title":      0.15,
    "domain":     0.10,
}
# Within skills: required vs preferred split
REQUIRED_SKILL_WEIGHT = 0.70
PREFERRED_SKILL_WEIGHT = 0.30

# Experience taper: below min, score tapers linearly (0 at min - TAPER_YEARS)
EXPERIENCE_TAPER_YEARS = 5


# ── File helpers ──────────────────────────────────────────────────────────────
def _load(path: Path) -> list:
    _DATA_DIR.mkdir(exist_ok=True)
    if not path.exists():
        path.write_text("[]", encoding="utf-8")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save(path: Path, data: list):
    _DATA_DIR.mkdir(exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def _update_job(darwinbox_job_id: str, updates: dict):
    jobs = _load(_DARWIN_JOBS_FILE)
    for j in jobs:
        if j["darwinbox_job_id"] == darwinbox_job_id:
            j.update(updates)
    _save(_DARWIN_JOBS_FILE, jobs)


def _update_candidate(candidate_id: str, updates: dict):
    candidates = _load(_CANDIDATES_FILE)
    for c in candidates:
        if c["candidate_id"] == candidate_id:
            c.update(updates)
    _save(_CANDIDATES_FILE, candidates)


def _get_job(darwinbox_job_id: str) -> dict | None:
    for j in _load(_DARWIN_JOBS_FILE):
        if j["darwinbox_job_id"] == darwinbox_job_id:
            return j
    return None


def _get_candidate(candidate_id: str) -> dict | None:
    for c in _load(_CANDIDATES_FILE):
        if c["candidate_id"] == candidate_id:
            return c
    return None


def _maybe_push_to_voice_agent(candidate: dict, job: dict, score_record: dict):
    """
    Auto-handoff: candidates scoring >= VOICE_AGENT_SCORE_THRESHOLD get pushed to the
    AI_VoiceAgent backend, which dispatches a screening call on its own. Dedup'd via
    _VOICE_AGENT_PUSHES_FILE so a rescore never re-triggers a duplicate call.
    """
    if score_record["overall_score"] < VOICE_AGENT_SCORE_THRESHOLD:
        return

    pushed = _load(_VOICE_AGENT_PUSHES_FILE)
    if candidate["candidate_id"] in pushed:
        return

    webhook_url = os.environ.get(
        "VOICE_AGENT_WEBHOOK_URL", "http://localhost:3001/api/candidates/inbound"
    )
    webhook_secret = os.environ.get("WEBHOOK_SECRET", "")

    payload = {
        "candidateId": candidate["candidate_id"],
        "name": candidate.get("name", ""),
        "phone": candidate.get("phone", ""),
        "email": candidate.get("email", ""),
        "score": score_record["overall_score"],
        "roleTitle": job.get("role_title", ""),
        "darwinboxJobId": candidate.get("darwinbox_job_id", ""),
    }

    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={"X-Webhook-Secret": webhook_secret} if webhook_secret else {},
            timeout=5,
        )
        if response.ok:
            pushed.append(candidate["candidate_id"])
            _save(_VOICE_AGENT_PUSHES_FILE, pushed)
        else:
            print(
                f"[voice-agent] push failed for {candidate['candidate_id']}: "
                f"HTTP {response.status_code} {response.text[:200]}"
            )
    except Exception as e:
        print(f"[voice-agent] push error for {candidate['candidate_id']}: {e}")


# ── Resume text extraction ────────────────────────────────────────────────────
def _extract_resume_text(resume_file: str) -> str:
    """Extract plain text from uploaded resume (PDF or DOCX)."""
    path = Path(__file__).parent / "static" / resume_file
    if not path.exists():
        return ""
    suffix = path.suffix.lower()
    try:
        if suffix == ".pdf":
            import fitz  # PyMuPDF
            doc = fitz.open(str(path))
            return "\n".join(page.get_text() for page in doc)
        elif suffix in (".docx", ".doc"):
            from docx import Document
            doc = Document(str(path))
            return "\n".join(p.text for p in doc.paragraphs)
    except Exception as e:
        print(f"[scoring] Resume text extraction failed: {e}")
    return ""


# ── Groq LLM caller ───────────────────────────────────────────────────────────
def _groq_json(system_prompt: str, user_content: str) -> dict:
    """Call Groq and parse JSON response. Raises on failure."""
    from groq import Groq
    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.0,
        max_tokens=1024,
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)


# ── Step 1a: Extract JD requirements ─────────────────────────────────────────
def extractJdRequirements(darwinbox_job_id: str, force: bool = False) -> dict | None:
    job = _get_job(darwinbox_job_id)
    if not job:
        return None
    if not force and job.get("jd_requirements"):
        return job["jd_requirements"]

    system = (
        "You are a structured data extractor. Given a job description, extract key fields "
        "and return ONLY valid JSON with these exact keys:\n"
        "  required_skills: list[str]\n"
        "  preferred_skills: list[str]\n"
        "  min_years_experience: int (0 if not specified)\n"
        "  max_years_experience: int (99 if not specified)\n"
        "  required_education: str (e.g. 'Bachelor', 'Master', 'PhD', 'Any', '')\n"
        "  target_titles: list[str]  (job titles this role is equivalent to)\n"
        "  domain_tags: list[str]  (e.g. 'fintech', 'ecommerce', 'data', 'product')\n"
        "Return only the JSON object — no explanation."
    )
    try:
        req = _groq_json(system, f"Job Description:\n\n{job['jd_text']}")
        _update_job(darwinbox_job_id, {
            "jd_requirements": req,
            "jd_requirements_extracted_at": datetime.now().isoformat(),
        })
        return req
    except Exception as e:
        print(f"[scoring] extractJdRequirements failed: {e}")
        return None


# ── Step 1b: Extract resume profile ──────────────────────────────────────────
def extractResumeProfile(candidate_id: str, force: bool = False) -> dict | None:
    candidate = _get_candidate(candidate_id)
    if not candidate:
        return None
    if not force and candidate.get("resume_profile"):
        return candidate["resume_profile"]

    resume_text = _extract_resume_text(candidate.get("resume_file", ""))
    if not resume_text.strip():
        # No readable resume — return empty profile
        profile = {
            "candidate_skills": [], "total_years_experience": 0,
            "education": [], "past_titles": [], "domain_tags": [],
        }
        _update_candidate(candidate_id, {
            "resume_profile": profile,
            "resume_profile_extracted_at": datetime.now().isoformat(),
        })
        return profile

    system = (
        "You are a structured data extractor. Given resume text, extract key fields "
        "and return ONLY valid JSON with these exact keys:\n"
        "  candidate_skills: list[str]  (technical and soft skills)\n"
        "  total_years_experience: int  (total years of professional experience, 0 if unclear)\n"
        "  education: list[str]  (e.g. ['B.Tech Computer Science', 'MBA Finance'])\n"
        "  past_titles: list[str]  (job titles held, most recent first)\n"
        "  domain_tags: list[str]  (e.g. 'fintech', 'ecommerce', 'data', 'product')\n"
        "Return only the JSON object — no explanation."
    )
    try:
        profile = _groq_json(system, f"Resume:\n\n{resume_text[:6000]}")
        _update_candidate(candidate_id, {
            "resume_profile": profile,
            "resume_profile_extracted_at": datetime.now().isoformat(),
        })
        return profile
    except Exception as e:
        print(f"[scoring] extractResumeProfile failed: {e}")
        return None


# ── Step 2: Deterministic weighted scoring ────────────────────────────────────
def _normalise(s: str) -> str:
    return re.sub(r"[^a-z0-9]", " ", s.lower()).strip()


def _skill_overlap(candidate_skills: list, jd_skills: list) -> float:
    """Fraction of jd_skills present in candidate_skills (case-insensitive substring)."""
    if not jd_skills:
        return 1.0
    c_norm = [_normalise(s) for s in candidate_skills]
    matched = 0
    for skill in jd_skills:
        s_norm = _normalise(skill)
        if any(s_norm in c or c in s_norm for c in c_norm):
            matched += 1
    return matched / len(jd_skills)


def _experience_score(candidate_yoe: int, min_yoe: int, max_yoe: int) -> float:
    """Return 0–1. Full inside range, taper below min, no penalty above max."""
    min_yoe = min_yoe or 0
    max_yoe = max_yoe if max_yoe and max_yoe < 99 else 999
    if candidate_yoe >= min_yoe:
        return 1.0
    gap = min_yoe - candidate_yoe
    score = max(0.0, 1.0 - gap / EXPERIENCE_TAPER_YEARS)
    return score


def _education_score(candidate_edu: list, required_edu: str) -> float:
    """Broad match: PhD>Master>Bachelor>Diploma>Any."""
    if not required_edu or required_edu.lower() in ("any", ""):
        return 1.0
    edu_rank = {"phd": 4, "doctor": 4, "master": 3, "mba": 3, "bachelor": 2,
                "b.tech": 2, "b.e": 2, "diploma": 1}
    req_rank = 0
    for k, v in edu_rank.items():
        if k in required_edu.lower():
            req_rank = v
            break
    candidate_rank = 0
    for edu in candidate_edu:
        for k, v in edu_rank.items():
            if k in edu.lower():
                candidate_rank = max(candidate_rank, v)
    if candidate_rank == 0:
        return 0.5  # Can't tell — give half credit
    return 1.0 if candidate_rank >= req_rank else max(0.0, candidate_rank / req_rank)


def _title_score(past_titles: list, target_titles: list, role_title: str) -> float:
    """Keyword overlap between candidate titles and JD target titles + role_title."""
    all_targets = [_normalise(t) for t in (target_titles or [])] + [_normalise(role_title)]
    if not all_targets:
        return 0.5
    if not past_titles:
        return 0.0
    c_titles_norm = [_normalise(t) for t in past_titles]
    score = 0.0
    for target in all_targets:
        target_words = set(target.split())
        for ct in c_titles_norm:
            ct_words = set(ct.split())
            overlap = len(target_words & ct_words)
            score = max(score, overlap / max(len(target_words), 1))
    return min(score, 1.0)


def computeCandidateScore(candidate_id: str, darwinbox_job_id: str) -> dict | None:
    """
    Pure deterministic scoring — no LLM call.
    Reads cached profiles from JSON files.
    Returns score dict and upserts into candidate_scores.json.
    """
    candidate = _get_candidate(candidate_id)
    job = _get_job(darwinbox_job_id)
    if not candidate or not job:
        return None

    req = job.get("jd_requirements")
    profile = candidate.get("resume_profile")
    if not req or not profile:
        return None

    # ── Sub-scores ────────────────────────────────────────────────────────────
    req_skills = req.get("required_skills", [])
    pref_skills = req.get("preferred_skills", [])
    c_skills = profile.get("candidate_skills", [])

    req_overlap = _skill_overlap(c_skills, req_skills)
    pref_overlap = _skill_overlap(c_skills, pref_skills) if pref_skills else 1.0
    skills_raw = (req_overlap * REQUIRED_SKILL_WEIGHT + pref_overlap * PREFERRED_SKILL_WEIGHT)

    exp_raw = _experience_score(
        profile.get("total_years_experience", 0),
        req.get("min_years_experience", 0),
        req.get("max_years_experience", 99),
    )

    edu_raw = _education_score(
        profile.get("education", []),
        req.get("required_education", ""),
    )

    title_raw = _title_score(
        profile.get("past_titles", []),
        req.get("target_titles", []),
        job.get("role_title", ""),
    )

    domain_overlap = _skill_overlap(
        profile.get("domain_tags", []),
        req.get("domain_tags", []),
    )

    # ── Weighted total ─────────────────────────────────────────────────────────
    overall = round(
        skills_raw     * WEIGHTS["skills"]     * 100 +
        exp_raw        * WEIGHTS["experience"] * 100 +
        edu_raw        * WEIGHTS["education"]  * 100 +
        title_raw      * WEIGHTS["title"]      * 100 +
        domain_overlap * WEIGHTS["domain"]     * 100,
        1
    )

    # ── Breakdown detail ──────────────────────────────────────────────────────
    matched_req = [s for s in req_skills if any(
        _normalise(s) in _normalise(cs) or _normalise(cs) in _normalise(s)
        for cs in c_skills
    )]
    missing_req = [s for s in req_skills if s not in matched_req]
    matched_pref = [s for s in pref_skills if any(
        _normalise(s) in _normalise(cs) or _normalise(cs) in _normalise(s)
        for cs in c_skills
    )]
    exp_gap = max(0, req.get("min_years_experience", 0) - profile.get("total_years_experience", 0))

    score_record = {
        "score_id": str(uuid.uuid4()),
        "candidate_id": candidate_id,
        "darwinbox_job_id": darwinbox_job_id,
        "overall_score": overall,
        "skills_score": round(skills_raw * 100, 1),
        "experience_score": round(exp_raw * 100, 1),
        "education_score": round(edu_raw * 100, 1),
        "title_relevance_score": round(title_raw * 100, 1),
        "domain_score": round(domain_overlap * 100, 1),
        "score_breakdown": {
            "matched_required_skills": matched_req,
            "missing_required_skills": missing_req,
            "matched_preferred_skills": matched_pref,
            "experience_gap_years": exp_gap,
            "candidate_yoe": profile.get("total_years_experience", 0),
            "required_yoe_range": f"{req.get('min_years_experience',0)}–{req.get('max_years_experience',99)}",
            "candidate_education": profile.get("education", []),
            "candidate_titles": profile.get("past_titles", []),
        },
        "scored_at": datetime.now().isoformat(),
    }

    # Upsert — replace existing score for same candidate+job
    scores = _load(_SCORES_FILE)
    scores = [s for s in scores
              if not (s["candidate_id"] == candidate_id and s["darwinbox_job_id"] == darwinbox_job_id)]
    scores.append(score_record)
    _save(_SCORES_FILE, scores)

    _maybe_push_to_voice_agent(candidate, job, score_record)

    return score_record


# ── Step 4: Orchestrator — called on submit (fire-and-forget) ─────────────────
def scoreCandidateOnSubmit(candidate_id: str):
    """
    Full pipeline: extract JD reqs (cached) → extract resume profile → compute score.
    Safe to call in a background thread.
    """
    try:
        candidate = _get_candidate(candidate_id)
        if not candidate:
            return
        job_id = candidate["darwinbox_job_id"]
        extractJdRequirements(job_id, force=False)
        extractResumeProfile(candidate_id, force=False)
        computeCandidateScore(candidate_id, job_id)
    except Exception as e:
        print(f"[scoring] scoreCandidateOnSubmit error for {candidate_id}: {e}")


# ── Step 5: Manual re-score ───────────────────────────────────────────────────
def rescoreCandidate(candidate_id: str, darwinbox_job_id: str) -> dict | None:
    """Force re-extract JD reqs + resume profile, then recompute score."""
    try:
        extractJdRequirements(darwinbox_job_id, force=True)
        extractResumeProfile(candidate_id, force=True)
        return computeCandidateScore(candidate_id, darwinbox_job_id)
    except Exception as e:
        print(f"[scoring] rescoreCandidate error: {e}")
        return None


# ── Public: fetch scores ──────────────────────────────────────────────────────
def get_score(candidate_id: str, darwinbox_job_id: str) -> dict | None:
    for s in _load(_SCORES_FILE):
        if s["candidate_id"] == candidate_id and s["darwinbox_job_id"] == darwinbox_job_id:
            return s
    return None


def get_scores_for_job(darwinbox_job_id: str) -> dict:
    """Return {candidate_id: score_record} for all scored candidates of a job."""
    return {
        s["candidate_id"]: s
        for s in _load(_SCORES_FILE)
        if s["darwinbox_job_id"] == darwinbox_job_id
    }
