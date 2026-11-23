# Anya's App — handoff

A small web app for Anya (first year). Home screen of ten subjects; Maths has three topics: Angles, Minus numbers, and Times and divide.
No build step: plain HTML, CSS and JavaScript, served by GitHub Pages. Scores go to a private Google Sheet.

## Where things are
- Repo on this Mac: ~/Sites/anyas-app (GitHub: dgaj-g/anyas-app, Pages from `main`).
- Resources Dad drops in: ~/Desktop/Claude Work/Anyas App/<Subject>/ (photos of her work stay there, never in the repo).
- Design record, progress log: ~/Desktop/Claude Work/Anyas App/_build/SPEC.md and PROGRESS.md.
- Keys: only in the `Keys` tab of the private Sheet "Anya's App scores" (and Script Properties). Never in the repo or in chat.
- The Sheet and the Apps Script project "Anyas App scores backend" live in Dad's school Google Drive (his choice, 15 Nov 2026). Web app: Version 1, Execute as Me, access Anyone.

## Privacy rules (keep)
- The public site and repo carry her first name only. No surname, school, class, photos of her work.
- Every page has `noindex`.

## Files
- `index.html`, `css/app.css` — the pupil app shell and the "twilight rose" style. Fonts in `fonts/` (OFL).
- `js/config.js` — `version` and `api` (the Apps Script web-app address; empty = scores stay on the device). Keep `V` in `sw.js` the same as `version`.
- `js/intro.js`, `js/wordmark-data.js`, `js/fx.js` — the drawn "Anya's App" opening, sparkles, chimes.
- `js/app.js` — screens and routes: `#/` home, `#/s/<subject>`, `#/maths/angles`, `#/maths/angles/<lesson>/<see|try|quiz>`. The lesson `plan` is "Add or take away?" (`#/maths/angles/plan/quiz`): a lesson with a `plan` list opens `Player.plan` instead of the Quiz. Minus numbers: `#/maths/minus`, `#/maths/minus/cheats` (the two cheats card), `#/maths/minus/<m1|m2|m3|mmix>/<see|try|quiz>`.
- `js/minus.js` — the Minus numbers bank: every kind of sum, the checker, the slips, the help steps and the two cheats in their fixed words (runs in Node for its gate). `js/minusplay.js` — its screens (signs that join, coloured number chips, dots, warm-up taps before a quiz). Scores save under topic `minus`, lessons `m1`, `m2`, `m3`, `mmix`; the backend needed no change.
- `js/times.js` — the Times and divide bank (version 5): times and divide with minus numbers, brackets, three numbers, squares and sums with an empty box, each with its checker, slips, help steps and cheats in fixed words (`Times.SAY`); it borrows the add and take-away sums from `js/minus.js` for the Mixed quiz. `js/timesplay.js` — its screens (sign chips, pairs of minus signs, the box, the number that hops across the equals) and the five cheats cards. Routes `#/maths/times`, `#/maths/times/cheats`, `#/maths/times/<t1|t2|t3|t4|t5|tmix>/<see|try|quiz>`. Scores save under topic `times`, lessons `t1` to `t5` and `tmix`; the backend needed no change.
- `js/questions.js` — the question bank, checker and slip tags. `js/diagram.js` draws every picture from numbers. `js/ring.js` draws the adding-up ring.
- `js/lessons.js` — "See it" (drag, sort, find the twins). `js/player.js` — "Try it", the Quiz, "Add or take away?" (she picks what to do; the app does the sums) and the score screen they share. `js/store.js` — keys, saving, offline queue.
- `admin/` — Dad's page. `backend/Code.gs` — the Apps Script. `tools/` — icon and wordmark makers, mock server, gates.

## Run it locally
    cd ~/Sites/anyas-app && nohup node tools/mock-server.js 8787 > /dev/null 2>&1 &
Open http://localhost:8787/?fast=1&api=http://localhost:8787/api#k=test-anya (Dad: `#k=test-dad`). `?seed=7` fixes the questions; `?fast=1` skips the intro.

## Gates (run before every deploy)
    cd ~/Sites/anyas-app && node tools/gates/g1-questions.js
    cd ~/Sites/anyas-app && node tools/gates/g1-minus.js
    cd ~/Sites/anyas-app && node tools/gates/g1-times.js
    cd ~/Sites/anyas-app && NODE_PATH=$(npm root -g) node tools/gates/walk.js walk-out 390x844 375x667 820x1180 1180x820
    cd ~/Sites/anyas-app && node tools/gates/g2-backend.js
- G1 checks every question kind: the answer is right, the picture matches, options are sound; the add-or-take-away slips ("mixed", "added", too big) are named; every "Add or take away?" round has one right choice, true sums and a reason on each wrong choice; its planted faults must be caught.
- G1 minus works every sum a second way, checks each help step and each slip reason is true for its sum, that no help prints the answer, and that the help and the working say each cheat in its fixed words; its planted faults must be caught.
- G1 times does the same for Times and divide, and also checks that every one of the 74 questions on Anya's two class sheets (Practice D and E, 23 Nov) is a kind the bank can make and marks right, that every lesson's set has every kind it promises, and that no after-answer screen goes over 25 words; its planted faults must be caught.
- The walk plays every lesson and quiz, "Add or take away?", all of Minus numbers and all of Times and divide, right and wrong, as a pupil at four screen sizes, checks nothing scrolls or spills, word limits, help steps (a sum with her numbers, the last one left as "= ?"), score saving, the offline case and Dad's page; its planted faults must be caught. Screenshots land in `walk-out/<size>/`. Look at them. It takes about 40 minutes. `ONLY=times` in front of the command walks Times and divide alone.
- G2 runs `backend/Code.gs` against stand-in Google services: setup, keys, saving once only, formula-safe text, Dad-only detail, the wrong-key lock. Run it whenever `Code.gs` changes.

## Deploy
- Front end: commit, push `main`; Pages rebuilds in about a minute. Bump `version` in `js/config.js` and `V` in `sw.js` together so phones pick up the new files.
- Backend (only when `backend/Code.gs` changes): paste into the Apps Script project "Anyas App scores backend", Deploy → Manage deployments → edit → New version. The web-app address stays the same.
- First-time backend setup, in this order:
  1. Name the project first: `Anyas App scores backend` (plain letters only; a dash or apostrophe in the name breaks Google's permission screen).
  2. Paste `backend/Code.gs`, save.
  3. Run `setup` once (it is the first function, so Run picks it). It makes the Sheet "Anya's App scores" and the keys. The permission click is Dad's.
  4. Deploy → New deployment → Web app (Execute as: Me; Who has access: Anyone). Put the `/exec` address in `api` in `js/config.js`, bump the version, push.
- Keys and links are in the `Keys` tab of the Sheet. `newKeys()` makes fresh ones (old ones stop working).
- While `api` is empty the app still works: scores stay on her device and send themselves once `api` and her key are in place.
- On this Mac (`localhost`) `api` is always empty unless the address carries `?api=`: tests never write to the real Sheet.

## Getting in
- Anya: open her ready-made link once, or type her key on the key screen. Spaces, dashes and capitals do not matter.
- An iPhone or iPad Home Screen app keeps its own storage, apart from Safari. After "Add to Home Screen" she types her key once inside the Home Screen app.
- Dad: `admin/` has a "Dad's key" box; his ready-made link fills it. Typing Dad's key on Anya's key screen also opens his page.

## Adding to it
- New topic in Maths: add question kinds + lessons in `js/questions.js`, See-it activities in `js/lessons.js`, a card in `subject()` in `js/app.js`; extend G1.
- New subject: it already has a home button and an "on its way" page; give it a topic list in `js/app.js` and its own lesson files.
- Pupil-screen rules: job line of 14 words or fewer; 25 words of prose at most; a labelled "Stuck? Show me" that shows what to do; nothing scrolls on a work screen; every waiting button shows it is busy.
- "Stuck? Show me" (version 4): each step is 10 words or fewer plus the sum with her own numbers; every sum is worked except the last, which ends "= ?"; the picture marks what to look at. Three steps at most.
- A topic that needs remembering (like Minus numbers): pick the fewest rules, fix their words once in the bank, and use those exact words in the help, the reasons, the warm-up taps and the end screens.
- Minus numbers, fixed words (in `js/minus.js` `SAY`): "Same signs make a plus. Different signs make a minus." / "Same signs: add. Different signs: take away. Bigger wins the sign." / "Cover the signs to see which is bigger." Never say a minus number "is bigger"; the gate fails any help, reason or warm-up that words a cheat another way.
- Times and divide, fixed words (in `js/times.js` `SAY`): "Same signs make a plus. Different signs make a minus." / "Cover the signs. Times the numbers." / "Pair up the minus signs. A pair makes a plus. One left over makes a minus." / "The answer is minus, so the signs are different. The answer is plus, so the signs are the same." / "Change side, change sign." / "Do the brackets first." / "No × or ÷? Add or take away." The sign rule is the same sentence as the touching-signs cheat in Minus numbers on purpose: one sentence to remember, and the last line tells her when it does NOT apply.
- The class sheets and exit tickets live in `Claude Work/Anyas App/Maths/`. They never go in this repo.
