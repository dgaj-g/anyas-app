# Anya's App — handoff

A small web app for Anya (first year). Home screen of ten subjects; Maths has the first topic, Angles.
No build step: plain HTML, CSS and JavaScript, served by GitHub Pages. Scores go to a private Google Sheet.

## Where things are
- Repo on this Mac: ~/Sites/anyas-app (GitHub: dgaj-g/anyas-app, Pages from `main`).
- Resources Dad drops in: ~/Desktop/Claude Work/Anyas App/<Subject>/ (photos of her work stay there, never in the repo).
- Design record, progress log: ~/Desktop/Claude Work/Anyas App/_build/SPEC.md and PROGRESS.md.
- Keys: only in the `Keys` tab of the private Sheet "Anya's App scores" (and Script Properties). Never in the repo or in chat.

## Privacy rules (keep)
- The public site and repo carry her first name only. No surname, school, class, photos of her work.
- Every page has `noindex`.

## Files
- `index.html`, `css/app.css` — the pupil app shell and the "twilight rose" style. Fonts in `fonts/` (OFL).
- `js/config.js` — `version` and `api` (the Apps Script web-app address; empty = scores stay on the device). Keep `V` in `sw.js` the same as `version`.
- `js/intro.js`, `js/wordmark-data.js`, `js/fx.js` — the drawn "Anya's App" opening, sparkles, chimes.
- `js/app.js` — screens and routes: `#/` home, `#/s/<subject>`, `#/maths/angles`, `#/maths/angles/<lesson>/<see|try|quiz>`.
- `js/questions.js` — the question bank, checker and slip tags. `js/diagram.js` draws every picture from numbers. `js/ring.js` draws the adding-up ring.
- `js/lessons.js` — "See it" (drag, sort, find the twins). `js/player.js` — "Try it" and the Quiz. `js/store.js` — keys, saving, offline queue.
- `admin/` — Dad's page. `backend/Code.gs` — the Apps Script. `tools/` — icon and wordmark makers, mock server, gates.

## Run it locally
    cd ~/Sites/anyas-app && nohup node tools/mock-server.js 8787 > /dev/null 2>&1 &
Open http://localhost:8787/?fast=1&api=http://localhost:8787/api#k=test-anya (Dad: `#k=test-dad`). `?seed=7` fixes the questions; `?fast=1` skips the intro.

## Gates (run before every deploy)
    cd ~/Sites/anyas-app && node tools/gates/g1-questions.js
    cd ~/Sites/anyas-app && NODE_PATH=$(npm root -g) node tools/gates/walk.js walk-out 390x844 375x667 820x1180 1180x820
- G1 checks every question kind: the answer is right, the picture matches, options are sound; its planted faults must be caught.
- The walk plays every lesson and quiz as a pupil at four screen sizes, checks nothing scrolls or spills, word limits, help steps, score saving, the offline case and Dad's page; its planted faults must be caught. Screenshots land in `walk-out/<size>/`. Look at them.

## Deploy
- Front end: commit, push `main`; Pages rebuilds in about a minute. Bump `version` in `js/config.js` and `V` in `sw.js` together so phones pick up the new files.
- Backend (only when `backend/Code.gs` changes): paste into the Apps Script project "Anya's App scores backend", Deploy → Manage deployments → edit → New version. The web-app address stays the same.
- First-time backend setup: run `setup()` once in the editor (it makes the Sheet and the keys), deploy as web app (Execute as: Me; Access: Anyone), put the `/exec` address in `js/config.js`.

## Adding to it
- New topic in Maths: add question kinds + lessons in `js/questions.js`, See-it activities in `js/lessons.js`, a card in `subject()` in `js/app.js`; extend G1.
- New subject: it already has a home button and an "on its way" page; give it a topic list in `js/app.js` and its own lesson files.
- Pupil-screen rules: job line of 14 words or fewer; 25 words of prose at most; a labelled "Stuck? Show me" that shows what to do; nothing scrolls on a work screen; every waiting button shows it is busy.
