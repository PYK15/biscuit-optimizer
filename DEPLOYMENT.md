# Deployment Guide

Step-by-step instructions to put this dashboard on the public internet, for
free, on a permanent URL. No prior deployment experience assumed.

The backend (FastAPI) and frontend (React/Vite) deploy to **two separate
platforms**. This guide uses **Render** for the backend and **Vercel** for the
frontend (both have generous free tiers and a pure web-dashboard workflow -
no CLI required). Railway and Netlify work almost identically if you prefer
them; the environment variables are the same either way.

**Public deployments run with zero AI API keys and zero LLM calls.** The
rule-based rationale (already well-formed executive prose - see the "Rule"
badge in the dashboard) is the only active path. Ollama/Anthropic/OpenAI stay
fully wired up in the code for your own local use; they're just not enabled
in the deployed configuration by default. See "Does this need an AI API key?"
near the bottom.

---

## 0. Before you start: where is "the repo root"?

Everything this guide deploys lives inside the `biscuit-optimizer/` folder
(backend code, `frontend/`, `requirements.txt`, `Procfile`, this file). The
two loose `.xlsx` files one level up, next to `biscuit-optimizer/`, are
duplicates of copies already inside `biscuit-optimizer/data/` and are **not**
needed for deployment.

**Push `biscuit-optimizer/` itself as the GitHub repo root.** That way Render
and Vercel can both point at the repo with no extra "root directory"
configuration.

---

## 1. Push the repo to GitHub

1. Install Git if you don't have it: https://git-scm.com/downloads
2. Create a new, empty repository on GitHub (github.com -> "+" in the top
   right -> "New repository"). Name it whatever you like, e.g.
   `biscuit-optimizer`. Do **not** check "Add a README" - you already have
   one. Click "Create repository" and leave the resulting page open; you'll
   need the URL it shows (something like
   `https://github.com/<your-username>/biscuit-optimizer.git`).
3. On your machine, open a terminal **inside the `biscuit-optimizer` folder**
   (not its parent) and run:
   ```bash
   cd "path/to/biscuit-optimizer"
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/biscuit-optimizer.git
   git push -u origin main
   ```
4. Refresh the GitHub page - you should see all the project files there
   (`api/`, `frontend/`, `agents/`, `README.md`, `Procfile`, etc.). The
   `.gitignore` already excludes `.venv/`, `node_modules/`, `.env`, and
   generated report files, so none of those get pushed.

---

## 2. Deploy the backend to Render

1. Go to https://render.com and sign up / log in (GitHub login is easiest -
   it also grants Render permission to see your repos).
2. Click **New +** -> **Web Service**.
3. Choose **Build and deploy from a Git repository**, then select the
   `biscuit-optimizer` repo you just pushed. Click **Connect**.
4. Fill in the service settings:
   - **Name**: anything, e.g. `biscuit-optimizer-api`
   - **Region**: closest to you
   - **Branch**: `main`
   - **Root Directory**: leave blank (the repo root *is*
     `biscuit-optimizer/`, per step 0)
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
     (this matches the `Procfile` already in the repo - Render also
     auto-detects the `Procfile` if you leave Start Command blank, but
     setting it explicitly avoids ambiguity)
   - **Instance Type**: `Free`
5. Under **Environment Variables**, add these (click "Add Environment
   Variable" for each):

   | Key | Value | Notes |
   |---|---|---|
   | `LLM_PROVIDER` | `none` | Disables all LLM calls; rule-based rationale only. No API key needed. |
   | `SYNTHETIC_VARIABILITY` | `True` | Keeps the documented demo demand drivers on (recommended - see the footer/"How This Works" panel for why). |
   | `ALLOWED_ORIGINS` | `*` | Temporary - allow all origins until you have the frontend's real URL (step 4). |

   You do **not** need to set `PORT` - Render injects it automatically, and
   the start command already reads `$PORT`.
6. Click **Create Web Service**. Render will build and deploy; watch the
   **Logs** tab. First deploy takes a few minutes (installing pandas/
   scikit-learn/FastAPI etc.).
7. Once it shows **Live**, note the public URL Render gives you, e.g.
   `https://biscuit-optimizer-api.onrender.com`. Test it by opening
   `https://biscuit-optimizer-api.onrender.com/` in a browser - you should
   see JSON like `{"status":"ok","data_source":"...","synthetic_variability":true,"llm_provider":"none"}`.

   **Read "Free-tier cold starts and first-request timing" below before you
   move on** - the first real request after a deploy or after idling is
   noticeably slower than normal, and that's expected.

### Using Railway instead of Render
The steps are the same in spirit: **New Project -> Deploy from GitHub repo**,
set the same three environment variables, and either let Railway auto-detect
the `Procfile` or set the start command explicitly to
`uvicorn api.main:app --host 0.0.0.0 --port $PORT` under Settings ->
Deploy. Railway assigns a public URL under Settings -> Networking ->
"Generate Domain".

---

## 3. Deploy the frontend to Vercel

1. Go to https://vercel.com and sign up / log in (GitHub login recommended).
2. Click **Add New...** -> **Project**, then **Import** the same
   `biscuit-optimizer` GitHub repo.
3. Vercel will ask to configure the project:
   - **Root Directory**: click "Edit" and set it to `frontend` (this is the
     one place the frontend's location matters - the repo root is
     `biscuit-optimizer/`, but the actual Vite app is in the `frontend/`
     subfolder).
   - **Framework Preset**: Vercel should auto-detect **Vite**. If not, set
     Build Command to `npm run build` and Output Directory to `dist`.
4. Expand **Environment Variables** and add:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | the Render backend URL from step 2.7, e.g. `https://biscuit-optimizer-api.onrender.com` (no trailing slash) |

5. Click **Deploy**. Vercel builds and deploys in under a minute; you'll get
   a public URL like `https://biscuit-optimizer.vercel.app`.
6. Open that URL. The page should load, but data won't appear yet - that's
   expected until step 4 below, because Render is still only allowing CORS
   from `*`... actually `*` already permits this. If nothing loads, open
   your browser's DevTools -> Console/Network tab and check for CORS or
   connection errors before proceeding; see "Troubleshooting" at the bottom.

### Using Netlify instead of Vercel
**Add new site -> Import an existing project** from the same repo. Set
**Base directory** to `frontend`, **Build command** to `npm run build`,
**Publish directory** to `frontend/dist` (Netlify needs the path relative to
the repo root, not the base directory, for this field specifically - if that
trips you up, set Base directory to `frontend` and Publish directory to
`dist`, both work depending on Netlify's UI version). Add the same
`VITE_API_BASE_URL` environment variable. The included `frontend/netlify.toml`
already sets the SPA fallback redirect and build settings, so Netlify should
pick most of this up automatically once Base directory is set.

---

## 4. Lock CORS down to your real frontend URL

Now that you know the frontend's real deployed URL (from step 3.5), go back
and tighten the backend's CORS setting so it only trusts that origin instead
of `*`:

1. In the Render dashboard, open your backend service -> **Environment**.
2. Edit `ALLOWED_ORIGINS` and set it to your frontend's exact URL, e.g.:
   ```
   https://biscuit-optimizer.vercel.app
   ```
   If Vercel also gives you a preview/branch URL you want to keep working
   (e.g. `https://biscuit-optimizer-git-main-yourname.vercel.app`), list both,
   comma-separated, no spaces:
   ```
   https://biscuit-optimizer.vercel.app,https://biscuit-optimizer-git-main-yourname.vercel.app
   ```
3. Save - Render redeploys automatically with the new value. Wait for the
   **Live** status again.

You can leave `ALLOWED_ORIGINS=*` indefinitely if you don't mind other sites
being able to call your public API; tightening it to your real frontend
domain is the more locked-down option and costs nothing to do.

---

## 5. Verify the live public link end-to-end

Open your Vercel URL on any device (including your phone, to prove it's
really public) and check all six tabs:

1. **Overview** - next-day cost, model accuracy badge, sustainability score,
   and "Method of the Day" all show real numbers (not "-" or blank).
2. **Forecast** - the chart renders with an actual/forecast line and a
   shaded prediction band; switching the target buttons changes the chart.
3. **Cost Optimization** - the table has rows with a stage, method, priority,
   and rationale text. The rationale's badge should say **Rule** (not LLM) -
   confirming the zero-LLM-calls configuration described below.
4. **Sustainability** - the emissions chart and reduction-lever list render.
5. **Model Scorecard** - the backtest table has numeric MAE/RMSE/MAPE/R2
   values per target.
6. **Roadmap** - a ranked, numbered action list renders with "Why now" and
   "Expected impact" text on each item.

Also:
- Drag the **Forecast horizon** slider in the header and confirm the charts
  and tables on Forecast/Cost Optimization/Sustainability/Roadmap all update
  together (this is the shared-horizon sync - it should still work exactly
  as it does locally, since none of this deployment work touched that code).
- Click **How This Works** in the header and confirm the panel opens with
  text.
- Scroll to the footer and confirm it shows `LLM provider: none` and the
  synthetic variability status.

If every tab shows real data and nothing is blank/erroring, the deployment
is working end to end.

---

## Free-tier cold starts and first-request timing

Two separate kinds of "slow" can happen on a free tier, and it's worth
knowing which one you're seeing:

1. **Platform cold start**: Render's free tier spins your service down after
   ~15 minutes of no traffic, and the next request takes 30-60+ seconds just
   to boot the container again. This is normal free-tier behavior, not
   specific to this app - the fix (if it bothers you) is a paid "always on"
   tier, or an external uptime pinger that hits `/` every 10 minutes to keep
   it warm.
2. **First-request model training**: independent of the above, this app
   trains its forecasting models lazily on first use per forecast horizon
   (there's no training step at process startup - see `api/main.py`'s
   `@lru_cache`-wrapped `_cached_forecast`/`_cached_plan` functions). Measured
   locally on a freshly started process: `/forecast` took **~15s** and
   `/recommendations` took **~10s** on their first call for a given horizon
   (14 targets, each fit as 3 quantile models plus a 7-day walk-forward
   backtest); `/sustainability` and `/scorecard` were near-instant once
   `/forecast` had already warmed the cache. Every subsequent request for the
   *same* horizon is served from the in-process cache and returns in
   milliseconds - but a fresh Render container (after any deploy or cold
   start) starts with an empty cache, and moving the horizon slider to a
   value nobody has requested yet on that container will pay the ~15s cost
   again.

Combined, a user's very first visit after a deploy or a long idle period
could see the dashboard take **20-40+ seconds** to fully populate, which is
enough to look "broken" if you're not expecting it. This is a real
consideration, not a hypothetical:

- **If this is acceptable for your use case** (a demo/portfolio link people
  click occasionally), no action needed - it self-heals into fast responses
  after the first load, and the frontend already shows a loading state
  rather than an error while it waits.
- **If you want the first visit to always be fast**, the change worth making
  (not done here, since it's a behavior change beyond "deployment
  configuration" and wasn't requested) is to pre-train the default horizon's
  model at process startup (a FastAPI `@app.on_event("startup")` hook calling
  `_cached_forecast(config.DEFAULT_HORIZON_DAYS)` once) and/or persist the
  fitted forecast result to a file in `reports/` the way
  `models/forecaster.py::write_scorecard` already does for the scorecard, so
  a fresh container can load a warm cache from disk instead of retraining.
  Flagging this as a follow-up rather than implementing it, since it touches
  the forecasting module's behavior and wasn't part of this deployment pass.

---

## Does this need an AI API key?

**No.** The deployed configuration (`LLM_PROVIDER=none`) never attempts an
LLM call:

- Every agent (`agents/classifier.py`, `agents/insight.py`,
  `agents/sustainability.py`) already defaults its API calls to
  `use_llm=false` at the FastAPI route level (`api/main.py`), and the
  frontend never sends `use_llm=true`.
- Even if something did request `use_llm=true`, `agents/providers.py`'s
  `get_model()` raises immediately (no network attempt, no timeout wait) when
  `LLM_PROVIDER=none`, and every agent function wraps that call in a
  try/except that falls back to its templated, rule-based rationale.
- The result: rationale text throughout the app carries a **Rule** badge
  instead of an **LLM** badge, and is still specific, well-formed executive
  prose - it's generated from a template filled in with the real numbers
  from the rule engine, not a generic placeholder.

To switch a deployment to a live LLM later (optional, not required for the
app to work), set `LLM_PROVIDER=anthropic` or `LLM_PROVIDER=openai` plus the
matching `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` on Render - no code changes
needed. Ollama itself (`LLM_PROVIDER=ollama`) only makes sense for local use,
since it requires a local Ollama server that a cloud container doesn't have.

---

## Troubleshooting

- **Frontend loads but every tab is blank / shows "-"**: open DevTools ->
  Network tab, reload, and look at the failing request. A CORS error in the
  Console (something like "has been blocked by CORS policy") means
  `ALLOWED_ORIGINS` on Render doesn't include your Vercel URL yet - see
  step 4. A "Failed to fetch" / connection error usually means
  `VITE_API_BASE_URL` on Vercel is wrong or missing a redeploy - check
  Vercel -> Project -> Settings -> Environment Variables, fix it, then
  Vercel -> Deployments -> "Redeploy" (env var changes need a redeploy to
  take effect, they don't apply retroactively to an existing build).
- **Backend takes a long time / times out on first load**: see "Free-tier
  cold starts and first-request timing" above - this is expected, reload
  after ~30-60s.
- **Render build fails on `pip install`**: check the Render build log for
  the specific package that failed; `requirements.txt` is pinned to versions
  confirmed to work together, so this usually means the Render Python
  runtime version differs from what was tested locally (Python 3.11+) -
  set the Python version explicitly under Render -> Environment ->
  `PYTHON_VERSION=3.11.9` if needed.
- **Vercel build fails on `tsc -b`**: this means a real TypeScript error
  slipped in - run `npm run build` locally inside `frontend/` first and fix
  whatever it reports before pushing.
