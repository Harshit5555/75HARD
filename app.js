/* =========================================================
   75 Hard — Notion-style tracker
   All data lives in localStorage under STORE_KEY.
   Every date on the page is derived from state.startDate, so
   resetting or moving the start date re-times everything.
   ========================================================= */
(() => {
  "use strict";

  const STORE_KEY = "seventyFiveHard.v1";
  const TOTAL_DAYS = 75;

  // Photos ship with the site (assets/photos) so they show everywhere, offline included.
  const P = (name) => `assets/photos/${name}.jpg`;

  const PHOTOS = {
    cover: P("cover"),
    book: P("book"),
    piercing: P("piercing"),
    tattoo: P("tattoo"),
    lulu: P("activewear"),
    omakase: P("omakase"),
  };

  // Rotating photos for day cards
  const DAY_PHOTOS = Array.from({ length: 9 }, (_, i) => P(`day${i + 1}`));

  const PRESET_PHOTOS = [
    P("cover"), P("scene-studio"), P("scene-sunset"), P("scene-forest"),
    P("day2"), P("day7"), P("day8"), P("day4"),
  ];

  const DEFAULT_TASKS = [
    { icon: "🏋️", text: "Workout #1 — 45 minutes" },
    { icon: "🌤️", text: "Workout #2 — 45 minutes, outdoors" },
    { icon: "🥗", text: "Follow the diet — no cheat meals, no alcohol" },
    { icon: "💧", text: "Drink a gallon of water" },
    { icon: "📖", text: "Read 10 pages of non-fiction" },
    { icon: "📸", text: "Take a progress photo" },
  ];

  const DEFAULT_REWARDS = [
    { id: "r1", day: 15, emoji: "📚", title: "A new book", img: PHOTOS.book,
      link: "https://www.goodreads.com/", desc: "Two weeks strong. Pick the book you've been eyeing." },
    { id: "r2", day: 30, emoji: "💎", title: "Piercing + a book", img: PHOTOS.piercing,
      link: "https://www.google.com/maps/search/piercing+studio+near+me", desc: "A month of discipline deserves some sparkle." },
    { id: "r3", day: 45, emoji: "🖋️", title: "Tattoo + a book", img: PHOTOS.tattoo,
      link: "https://www.google.com/maps/search/tattoo+studio+near+me", desc: "Make it permanent — you've earned it." },
    { id: "r4", day: 60, emoji: "👚", title: "Lululemon top + a book", img: PHOTOS.lulu,
      link: "https://shop.lululemon.com/c/women-tops/_/N-1z0xcmkZ7z5", desc: "New fit for the final stretch." },
    { id: "r5", day: 75, emoji: "🍣", title: "Omakase dinner + a book", img: PHOTOS.omakase,
      link: "https://www.google.com/maps/search/omakase+near+me", desc: "Seventy-five days. Celebrate like it." },
  ];

  const MOODS = ["😩", "😕", "😐", "🙂", "😄", "🔥"];

  /* ---------- Date helpers (all local time, ISO yyyy-mm-dd) ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const todayISO = () => toISO(new Date());
  const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 864e5);
  const fmt = (iso, opts = { month: "short", day: "numeric" }) => fromISO(iso).toLocaleDateString(undefined, opts);
  const fmtLong = (iso) => fmt(iso, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- State ---------- */
  const freshState = () => ({
    version: 1,
    startDate: todayISO(),
    cover: PHOTOS.cover,
    days: {},        // { [dayNumber]: { tasks:[{id,icon,text,done}], note, photo } }
    reports: [],     // [{id,date,title,weight,mood,text,photo}]
    attempts: [],    // [{start,end,completed}]
    rewards: DEFAULT_REWARDS.map((r) => ({ ...r })),
    ui: { calOpen: true, reportsOpen: true, daysOpen: false },
  });

  let state = load();
  const ui = { peekDay: null, calMonth: null, modal: null };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const base = freshState();
        const merged = { ...base, ...s, ui: { ...base.ui, ...(s.ui || {}) } };
        return migratePhotos(merged);
      }
    } catch (e) { /* fall through to fresh */ }
    return freshState();
  }

  // Earlier versions pointed at Unsplash; swap those defaults for the bundled photos.
  function migratePhotos(s) {
    const old = (u) => typeof u === "string" && u.includes("images.unsplash.com");
    if (old(s.cover)) s.cover = PHOTOS.cover;
    s.rewards.forEach((r) => {
      const def = DEFAULT_REWARDS.find((d) => d.id === r.id);
      if (old(r.img) && def) r.img = def.img;
    });
    return s;
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      toast("⚠️ Browser storage is full — try smaller photos or export a backup.");
    }
  }

  /* ---------- Derived values ---------- */
  const dateOf = (n) => addDays(state.startDate, n - 1);
  const endDate = () => dateOf(TOTAL_DAYS);
  const currentDayNum = () => diffDays(state.startDate, todayISO()) + 1;
  const dayNumOf = (iso) => diffDays(state.startDate, iso) + 1;

  const isComplete = (day) => !!day && day.tasks.length > 0 && day.tasks.every((t) => t.done);
  const dayProgress = (day) => {
    if (!day || !day.tasks.length) return { done: 0, total: 0, pct: 0 };
    const done = day.tasks.filter((t) => t.done).length;
    return { done, total: day.tasks.length, pct: Math.round((done / day.tasks.length) * 100) };
  };
  const completedCount = () => Object.values(state.days).filter(isComplete).length;
  const streak = () => { let n = 0; while (isComplete(state.days[n + 1])) n++; return n; };
  const rewardUnlocked = (r) => streak() >= r.day;

  function firstMissedDay() {
    const cur = Math.min(currentDayNum(), TOTAL_DAYS + 1);
    for (let n = 1; n < cur; n++) if (!isComplete(state.days[n])) return n;
    return null;
  }

  const dayPhoto = (n) => state.days[n]?.photo || DAY_PHOTOS[(n - 1) % DAY_PHOTOS.length];
  const nextReward = () => state.rewards.slice().sort((a, b) => a.day - b.day).find((r) => !rewardUnlocked(r));

  /* ---------- Small render helpers ---------- */
  const $ = (sel) => document.querySelector(sel);

  function photo(url, emoji = "✨", cls = "", g = 1) {
    const img = url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : "";
    return `<div class="photo g${g} ${cls}"><span class="ph-emoji">${emoji}</span>${img}</div>`;
  }
  const pbar = (pct, cls = "") => `<div class="pbar ${cls}"><div style="width:${pct}%"></div></div>`;

  function statusTag(n) {
    const day = state.days[n];
    const cur = currentDayNum();
    if (isComplete(day)) return `<span class="tag pink">✓ Complete</span>`;
    if (n < cur) return `<span class="tag red">Missed</span>`;
    if (day && dayProgress(day).done > 0) return `<span class="tag yellow">In progress</span>`;
    if (n === cur) return `<span class="tag">Today</span>`;
    return `<span class="tag">Not started</span>`;
  }

  /* =========================================================
     RENDER
     ========================================================= */
  function render() {
    renderSidebar();
    renderHeader();
    renderStats();
    renderJourney();
    renderToday();
    renderRewards();
    renderBoard();
    renderReports();
    renderAttempts();
    if (ui.peekDay != null) renderPeek();
    if (window.HardScene) window.HardScene.update(snapshot());
  }

  // Everything the 3D cover needs, recomputed on every render so resets and edits show up instantly.
  function snapshot() {
    const cur = currentDayNum();
    const days = [];
    for (let n = 1; n <= TOTAL_DAYS; n++) {
      const day = state.days[n];
      const p = dayProgress(day);
      const status = isComplete(day) ? "done"
        : n < cur ? "missed"
        : n === cur ? "today"
        : p.done > 0 ? "progress" : "future";
      days.push({ n, status, pct: p.pct, date: fmt(dateOf(n), { weekday: "short", month: "short", day: "numeric" }) });
    }
    return {
      current: cur,
      streak: streak(),
      days,
      rewards: state.rewards.map((r) => ({ day: r.day, title: r.title, emoji: r.emoji, unlocked: rewardUnlocked(r) })),
    };
  }

  function renderSidebar() {
    document.querySelectorAll(".sb-section").forEach((sec) => {
      const key = { cal: "calOpen", reports: "reportsOpen", days: "daysOpen" }[sec.dataset.section];
      sec.classList.toggle("open", !!state.ui[key]);
    });
    renderCalendar();

    // reports list
    const reports = state.reports.slice().sort((a, b) => b.date.localeCompare(a.date));
    $("#sbReports").innerHTML =
      `<button class="sb-row sb-add" data-action="new-report">＋ New progress report</button>` +
      (reports.length
        ? reports.map((r) => `
          <button class="sb-row" data-action="edit-report" data-id="${r.id}">
            ${r.photo ? `<img class="sb-thumb" src="${esc(r.photo)}" alt="" onerror="this.style.visibility='hidden'">` : `<span>${r.mood || "📝"}</span>`}
            <span class="grow">${esc(r.title || "Progress report")}</span>
            <span class="tiny">${fmt(r.date)}</span>
          </button>`).join("")
        : `<div class="sb-empty">No reports yet — log how you feel, weight, photos.</div>`);

    // days list
    const nums = Object.keys(state.days).map(Number).sort((a, b) => a - b);
    $("#sbDays").innerHTML =
      `<button class="sb-row sb-add" data-action="new-day">＋ New day</button>` +
      (nums.length
        ? nums.map((n) => `
          <button class="sb-row ${isComplete(state.days[n]) ? "done" : ""}" data-action="open-day" data-day="${n}">
            <span>${isComplete(state.days[n]) ? "●" : "○"}</span>
            <span class="grow">Day ${n}</span>
            <span class="tiny">${fmt(dateOf(n))}</span>
          </button>`).join("")
        : `<div class="sb-empty">No days yet.</div>`);
  }

  function renderCalendar() {
    const start = state.startDate;
    const end = endDate();
    if (!ui.calMonth) {
      const t = fromISO(todayISO());
      ui.calMonth = { y: t.getFullYear(), m: t.getMonth() };
    }
    const { y, m } = ui.calMonth;
    const first = new Date(y, m, 1);
    const gridStart = new Date(y, m, 1 - first.getDay());
    const today = todayISO();
    const cur = currentDayNum();
    const rewardByDay = Object.fromEntries(state.rewards.map((r) => [r.day, r.emoji]));

    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
      const iso = toISO(d);
      const n = dayNumOf(iso);
      const inRange = n >= 1 && n <= TOTAL_DAYS;
      const cls = ["cal-cell"];
      if (d.getMonth() === m) cls.push("in-month");
      if (inRange) {
        cls.push("in-range");
        if (isComplete(state.days[n])) cls.push("done");
        else if (n < cur) cls.push("missed");
      }
      if (iso === start) cls.push("start");
      if (iso === end) cls.push("end");
      if (iso === today) cls.push("today");
      const rw = inRange && rewardByDay[n] ? `<span class="rw">${rewardByDay[n]}</span>` : "";
      const title = inRange ? `Day ${n} · ${fmtLong(iso)}` : fmtLong(iso);
      cells += `<button class="${cls.join(" ")}" title="${esc(title)}" ${inRange ? `data-action="open-day" data-day="${n}"` : "tabindex='-1'"}>${d.getDate()}${rw}</button>`;
    }

    const monthName = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const dayLabel = cur < 1 ? `Starts in ${1 - cur}d` : cur > TOTAL_DAYS ? "Finished 🎉" : `Day ${cur} of ${TOTAL_DAYS}`;

    $("#calBody").innerHTML = `
      <div class="cal">
        <div class="cal-head">
          <button class="icon-btn" data-action="cal-prev" aria-label="Previous month">‹</button>
          <span>${monthName}</span>
          <button class="icon-btn" data-action="cal-next" aria-label="Next month">›</button>
        </div>
        <div class="cal-grid">
          ${["S", "M", "T", "W", "T", "F", "S"].map((d) => `<div class="cal-dow">${d}</div>`).join("")}
          ${cells}
        </div>
        <div class="cal-legend">
          <span><i style="background:var(--accent)"></i>Done</span>
          <span><i style="background:var(--hatch);box-shadow:inset 0 0 0 1px var(--border)"></i>Missed</span>
          <span><i style="background:var(--bg-soft)"></i>75 days</span>
        </div>
        <dl class="cal-info">
          <dt>Today</dt><dd>${fmt(today, { weekday: "short", month: "short", day: "numeric" })}</dd>
          <dt>Started</dt><dd>${fmt(start, { month: "short", day: "numeric", year: "numeric" })}</dd>
          <dt>Finish line</dt><dd>${fmt(end, { month: "short", day: "numeric", year: "numeric" })}</dd>
          <dt>Status</dt><dd>${dayLabel}</dd>
        </dl>
        <div class="cal-actions">
          <button class="btn btn-sm" data-action="cal-today">Jump to today</button>
          <label>Start date <input type="date" id="startInput" value="${start}"></label>
          <button class="btn btn-sm btn-danger" data-action="reset">↺ I failed — reset to today</button>
        </div>
      </div>`;
  }

  function renderHeader() {
    const cur = currentDayNum();
    $("#crumbDay").textContent = cur < 1 ? "Not started" : cur > TOTAL_DAYS ? "Complete" : `Day ${Math.min(cur, TOTAL_DAYS)}`;
    $("#coverPhoto").innerHTML = photo(state.cover, "", "", 3);
    $("#coverChip").innerHTML = cur < 1
      ? `<b>Starts ${fmt(state.startDate)}</b><span>${1 - cur} days to go</span>`
      : cur > TOTAL_DAYS
        ? `<b>75 / 75</b><span>${streak() >= TOTAL_DAYS ? "Challenge complete 🏆" : "Challenge window over"}</span>`
        : `<b>Day ${cur} <i>/ ${TOTAL_DAYS}</i></b><span>${completedCount()} complete · ${streak()} in a row</span>`;

    const nr = nextReward();
    $("#props").innerHTML = `
      <dt>📅 Start</dt><dd>${fmtLong(state.startDate)}</dd>
      <dt>🏁 Finish</dt><dd>${fmtLong(endDate())}</dd>
      <dt>⏳ Status</dt><dd>${cur < 1 ? `<span class="tag">Starts in ${1 - cur} days</span>`
        : cur > TOTAL_DAYS ? `<span class="tag pink">Finished</span>`
        : `<span class="tag pink">Day ${cur} / ${TOTAL_DAYS}</span>`}</dd>
      <dt>🎁 Next reward</dt><dd>${nr ? `${nr.emoji} ${esc(nr.title)} <span class="muted">· Day ${nr.day} · ${fmt(dateOf(nr.day))}</span>` : `<span class="tag pink">All rewards unlocked 🎉</span>`}</dd>
      <dt>🔁 Attempt</dt><dd>#${state.attempts.length + 1}</dd>`;

    const missed = firstMissedDay();
    $("#banner").innerHTML = missed
      ? `<div class="banner red"><span style="font-size:20px">⚠️</span>
          <div class="grow"><strong>Day ${missed} (${fmt(dateOf(missed))}) wasn't finished.</strong> 75 Hard rules: miss a task, start over at Day 1.</div>
          <button class="btn btn-sm btn-danger" data-action="reset">↺ Reset to today</button></div>`
      : cur > TOTAL_DAYS && streak() >= TOTAL_DAYS
        ? `<div class="banner pink"><span style="font-size:20px">🏆</span><div class="grow"><strong>You did it. 75 days, no excuses.</strong></div></div>`
        : "";
  }

  function renderStats() {
    const cur = currentDayNum();
    const s = streak();
    const nr = nextReward();
    const daysToReward = nr ? Math.max(0, diffDays(todayISO(), dateOf(nr.day))) : 0;
    const items = [
      ["Current day", cur < 1 ? "—" : Math.min(cur, TOTAL_DAYS), `of ${TOTAL_DAYS}`],
      ["Days complete", completedCount(), `${Math.round((completedCount() / TOTAL_DAYS) * 100)}% of the journey`],
      ["Streak", s, s === 1 ? "day in a row" : "days in a row"],
      ["Next reward", nr ? `${daysToReward}d` : "🎉", nr ? `${nr.emoji} ${nr.title}` : "everything unlocked"],
    ];
    $("#stats").innerHTML = items.map(([l, v, sub]) => `
      <div class="stat"><div class="stat-label">${l}</div><div class="stat-value">${v}</div><div class="stat-sub">${esc(sub)}</div></div>`).join("");
  }

  function renderJourney() {
    const cur = currentDayNum();
    const fill = (streak() / TOTAL_DAYS) * 100;
    const todayPct = Math.max(0, Math.min(100, ((cur - 0.5) / TOTAL_DAYS) * 100));
    const marks = state.rewards.map((r) => `
      <div class="jmark ${rewardUnlocked(r) ? "on" : ""}" style="left:${(r.day / TOTAL_DAYS) * 100}%" title="${esc(r.title)} — Day ${r.day}">
        <small>Day ${r.day}</small>${r.emoji}
      </div>`).join("");
    const todayMark = cur >= 1 && cur <= TOTAL_DAYS ? `<div class="jtoday" style="left:${todayPct}%"><span>today</span></div>` : "";
    $("#journey").innerHTML = `<div class="jbar"><div class="jfill" style="width:${fill}%"></div>${todayMark}${marks}</div>`;
  }

  function tasksHTML(n) {
    const day = state.days[n];
    return `
      <ul class="tasks">
        ${day.tasks.map((t) => `
          <li class="task ${t.done ? "done" : ""}">
            <input type="checkbox" ${t.done ? "checked" : ""} data-action="toggle-task" data-day="${n}" data-id="${t.id}" aria-label="Done">
            <span class="t-icon">${t.icon || "•"}</span>
            <input class="t-text" value="${esc(t.text)}" data-edit="task" data-day="${n}" data-id="${t.id}" aria-label="Task">
            <button class="icon-btn del" data-action="del-task" data-day="${n}" data-id="${t.id}" title="Delete task">✕</button>
          </li>`).join("")}
      </ul>
      <form class="add-task" data-form="add-task" data-day="${n}">
        <input name="text" placeholder="＋ Add a task and press Enter" autocomplete="off">
      </form>`;
  }

  function renderToday() {
    const cur = currentDayNum();
    const el = $("#todayBlock");
    if (cur < 1) {
      el.innerHTML = `<div class="today-card"><div class="today-body today-empty">Your challenge starts <strong>${fmtLong(state.startDate)}</strong>. Rest up. 💤</div></div>`;
      return;
    }
    if (cur > TOTAL_DAYS) {
      el.innerHTML = `<div class="today-card"><div class="today-body today-empty">The 75 days are over. Reset from the calendar to start another round.</div></div>`;
      return;
    }
    const day = state.days[cur];
    if (!day) {
      el.innerHTML = `
        <div class="today-card">
          ${photo(dayPhoto(cur), "☀️", "", 2)}
          <div class="today-body today-empty">
            <h3>Day ${cur}</h3>
            <p class="muted">${fmtLong(todayISO())} — no page yet for today.</p>
            <button class="btn btn-primary" data-action="create-day" data-day="${cur}">＋ Start Day ${cur}</button>
          </div>
        </div>`;
      return;
    }
    const p = dayProgress(day);
    el.innerHTML = `
      <div class="today-card">
        ${photo(dayPhoto(cur), "☀️", "", 2)}
        <div class="today-body">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
            <h3>Day ${cur}</h3>${statusTag(cur)}
          </div>
          <div class="muted" style="font-size:13px;margin-bottom:8px">${fmtLong(dateOf(cur))} · ${p.done}/${p.total} tasks</div>
          ${pbar(p.pct)}
          ${tasksHTML(cur)}
          <div style="margin-top:10px"><button class="btn btn-sm" data-action="open-day" data-day="${cur}">Open page ↗</button></div>
        </div>
      </div>`;
  }

  function renderRewards() {
    const s = streak();
    $("#rewardsGrid").innerHTML = state.rewards.slice().sort((a, b) => a.day - b.day).map((r, i) => {
      const on = rewardUnlocked(r);
      const daysLeft = diffDays(todayISO(), dateOf(r.day));
      const pct = Math.round((Math.min(s, r.day) / r.day) * 100);
      return `
        <article class="reward ${on ? "unlocked" : "locked"}" data-action="edit-reward" data-id="${r.id}">
          ${photo(r.img, r.emoji, "", (i % 5) + 1).replace("</div>", `${on ? `<span class="tag pink shine">✨ Unlocked</span>` : `<div class="lock">🔒</div>`}</div>`)}
          <div class="reward-body">
            <div class="reward-title"><span>${r.emoji}</span><span>${esc(r.title)}</span></div>
            <div class="reward-meta">Day ${r.day} · ${fmt(dateOf(r.day), { weekday: "short", month: "short", day: "numeric" })}</div>
            ${on
              ? `<div class="reward-meta">${esc(r.desc || "")}</div>
                 ${r.link ? `<a class="btn btn-primary btn-sm reward-link" href="${esc(r.link)}" target="_blank" rel="noopener" data-stop>Claim reward →</a>` : ""}`
              : `${pbar(pct)}
                 <div class="reward-meta">${Math.min(s, r.day)}/${r.day} days complete · ${daysLeft > 0 ? `${daysLeft} days to go` : "finish the missing days"}</div>`}
          </div>
        </article>`;
    }).join("");
  }

  function dayCard(n) {
    const day = state.days[n];
    const p = dayProgress(day);
    return `
      <button class="dcard ${isComplete(day) ? "complete" : ""}" data-action="open-day" data-day="${n}">
        ${photo(dayPhoto(n), "💪", "", (n % 5) + 1)}
        <div class="dcard-body">
          <div class="dcard-title"><span>Day ${n}</span><span class="muted" style="font-weight:400;font-size:12.5px">${fmt(dateOf(n), { weekday: "short", month: "short", day: "numeric" })}</span></div>
          ${pbar(p.pct)}
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
            ${statusTag(n)}<span class="muted" style="font-size:12px">${p.done}/${p.total}</span>
          </div>
        </div>
      </button>`;
  }

  function renderBoard() {
    const nums = Object.keys(state.days).map(Number).sort((a, b) => b - a);
    const cols = [
      { title: "Not started", dot: "○", list: nums.filter((n) => dayProgress(state.days[n]).done === 0) },
      { title: "In progress", dot: "◐", list: nums.filter((n) => { const p = dayProgress(state.days[n]); return p.done > 0 && p.done < p.total; }) },
      { title: "Complete", dot: "●", list: nums.filter((n) => isComplete(state.days[n])) },
    ];
    $("#boardCols").innerHTML = cols.map((c, i) => `
      <div class="col">
        <div class="col-head">${c.dot} ${c.title} <span class="count">${c.list.length}</span></div>
        <div class="col-list">
          ${c.list.map(dayCard).join("") || `<div class="col-empty">${i === 2 ? "Finish every task in a day to land it here." : "Nothing here."}</div>`}
          ${i === 0 ? `<button class="col-add" data-action="new-day">＋ New day</button>` : ""}
        </div>
      </div>`).join("");
  }

  function renderReports() {
    const reports = state.reports.slice().sort((a, b) => b.date.localeCompare(a.date));
    $("#reportsGrid").innerHTML = reports.map((r, i) => {
      const n = dayNumOf(r.date);
      return `
        <button class="rcard" data-action="edit-report" data-id="${r.id}">
          ${photo(r.photo || DAY_PHOTOS[(i + 3) % DAY_PHOTOS.length], r.mood || "📈", "", (i % 5) + 1)}
          <div class="rcard-body">
            <div class="rcard-title">${r.mood || ""} ${esc(r.title || "Progress report")}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <span class="tag">${fmt(r.date)}</span>
              ${n >= 1 && n <= TOTAL_DAYS ? `<span class="tag pink">Day ${n}</span>` : ""}
              ${r.weight ? `<span class="tag green">⚖️ ${esc(r.weight)}</span>` : ""}
            </div>
            ${r.text ? `<div class="rcard-text">${esc(r.text)}</div>` : ""}
          </div>
        </button>`;
    }).join("") + `<button class="rcard new" data-action="new-report">＋ New progress report</button>`;
  }

  function renderAttempts() {
    const rows = state.attempts.slice().reverse();
    $("#attempts").innerHTML = rows.length
      ? `<table class="table"><thead><tr><th>#</th><th>Started</th><th>Reset on</th><th>Days completed</th></tr></thead><tbody>
          ${rows.map((a, i) => `<tr><td>${rows.length - i}</td><td>${fmt(a.start, { month: "short", day: "numeric", year: "numeric" })}</td><td>${fmt(a.end, { month: "short", day: "numeric", year: "numeric" })}</td><td>${a.completed}</td></tr>`).join("")}
         </tbody></table>`
      : `<div class="muted" style="font-size:14px">No resets yet. Keep it that way. 💪</div>`;
  }

  /* ---------- Day side-peek ---------- */
  function renderPeek() {
    const n = ui.peekDay;
    const day = state.days[n];
    const peek = $("#peek");
    if (!day) { closePeek(); return; }
    const p = dayProgress(day);
    const reward = state.rewards.find((r) => r.day === n);
    peek.innerHTML = `
      <div class="peek-top">
        <button class="icon-btn" data-action="close-peek" title="Close">»</button>
        <span class="grow muted" style="font-size:13px">Days / Day ${n}</span>
        <button class="icon-btn" data-action="peek-nav" data-dir="-1" title="Previous day" ${n <= 1 ? "disabled" : ""}>↑</button>
        <button class="icon-btn" data-action="peek-nav" data-dir="1" title="Next day" ${n >= TOTAL_DAYS ? "disabled" : ""}>↓</button>
      </div>
      ${photo(dayPhoto(n), "💪", "peek-cover", (n % 5) + 1)}
      <div class="peek-body">
        <h2>Day ${n}</h2>
        <dl class="props">
          <dt>📅 Date</dt><dd>${fmtLong(dateOf(n))}</dd>
          <dt>✅ Status</dt><dd>${statusTag(n)}</dd>
          <dt>📊 Progress</dt><dd style="display:flex;align-items:center;gap:10px"><div style="flex:1">${pbar(p.pct)}</div><span class="muted" style="font-size:13px">${p.done}/${p.total}</span></dd>
          ${reward ? `<dt>🎁 Reward</dt><dd>${reward.emoji} ${esc(reward.title)}</dd>` : ""}
        </dl>
        ${isComplete(day) ? `<div class="complete-banner">✓ Day ${n} complete — every task done.${reward ? ` ${reward.emoji} ${esc(reward.title)} is ${rewardUnlocked(reward) ? "unlocked!" : "waiting on earlier days."}` : ""}</div>` : ""}
        <div class="sub-h">Tasks</div>
        ${tasksHTML(n)}
        <div class="sub-h">Notes</div>
        <textarea data-edit="note" data-day="${n}" placeholder="How did today go?">${esc(day.note || "")}</textarea>
        <div class="sub-h">Photo</div>
        <div class="upload-row">
          <button class="btn btn-sm" data-action="day-photo" data-day="${n}">🖼️ Change day photo</button>
          ${day.photo ? `<button class="btn btn-sm" data-action="day-photo-clear" data-day="${n}">Use default</button>` : ""}
        </div>
        <div style="margin-top:28px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" data-action="new-report" data-day="${n}">📈 Write progress report</button>
          <button class="btn btn-sm btn-danger" data-action="delete-day" data-day="${n}">🗑 Delete day</button>
        </div>
      </div>`;
  }

  function openPeek(n) {
    ui.peekDay = n;
    renderPeek();
    $("#peek").classList.add("open");
    $("#peek").setAttribute("aria-hidden", "false");
    $(".peek-scrim").classList.add("open");
    closeMobileSidebar();
  }
  function closePeek() {
    ui.peekDay = null;
    $("#peek").classList.remove("open");
    $("#peek").setAttribute("aria-hidden", "true");
    $(".peek-scrim").classList.remove("open");
  }

  /* ---------- Day ops ---------- */
  function createDay(n) {
    if (n < 1 || n > TOTAL_DAYS) { toast(`Days run from 1 to ${TOTAL_DAYS}.`); return false; }
    if (state.days[n]) return true;
    // New days copy the task list of the most recent earlier day (unchecked), else the 75 Hard defaults.
    const prev = Object.keys(state.days).map(Number).filter((k) => k < n).sort((a, b) => b - a)[0];
    const template = prev ? state.days[prev].tasks : DEFAULT_TASKS;
    state.days[n] = { tasks: template.map((t) => ({ id: uid(), icon: t.icon || "", text: t.text, done: false })), note: "" };
    save();
    return true;
  }

  function nextNewDay() {
    for (let n = 1; n <= TOTAL_DAYS; n++) if (!state.days[n]) return n;
    return null;
  }

  function toggleTask(n, id) {
    const day = state.days[n];
    const t = day?.tasks.find((x) => x.id === id);
    if (!t) return;
    const wasComplete = isComplete(day);
    const unlockedBefore = state.rewards.filter(rewardUnlocked).map((r) => r.id);
    t.done = !t.done;
    save();
    render();
    if (!wasComplete && isComplete(day)) {
      const newly = state.rewards.filter((r) => rewardUnlocked(r) && !unlockedBefore.includes(r.id));
      confetti(newly.length ? 140 : 60);
      toast(newly.length ? `🎁 Reward unlocked: ${newly[0].emoji} ${newly[0].title}!` : `✓ Day ${n} complete`);
    }
  }

  function doReset() {
    const today = todayISO();
    state.attempts.push({ start: state.startDate, end: today, completed: streak() });
    state.startDate = today;
    state.days = {};
    ui.calMonth = null;
    closePeek();
    save();
    render();
    toast("↺ Fresh start. Day 1 is today — every date has been moved.");
  }

  /* =========================================================
     MODALS
     ========================================================= */
  function openModal(html) {
    $("#modal").innerHTML = html;
    $("#modalWrap").classList.add("open");
    const f = $("#modal").querySelector("input:not([type=file]):not([type=hidden]), textarea");
    if (f && window.matchMedia("(hover: hover)").matches) f.focus();
  }
  function closeModal() { $("#modalWrap").classList.remove("open"); ui.modal = null; }

  // In-page confirmation (browser confirm() is blocked in some embeds)
  function askConfirm(title, body, label, onYes) {
    ui.modal = { type: "confirm", onYes };
    openModal(`
      <div class="modal-body">
        <h3>${esc(title)}</h3>
        <p class="muted">${esc(body)}</p>
        <div class="modal-actions">
          <button class="btn" data-action="close-modal">Cancel</button>
          <button class="btn btn-primary" data-action="confirm-yes">${esc(label)}</button>
        </div>
      </div>`);
  }

  // Reusable photo picker block (URL + upload + presets)
  function photoPicker(current, withPresets) {
    return `
      <div class="field">
        <span class="lbl">Photo</span>
        <div class="upload-row">
          <label class="btn btn-sm">📤 Upload<input type="file" accept="image/*" data-upload hidden></label>
          <span class="muted" style="font-size:12px">or paste an image URL</span>
        </div>
        <input name="img" value="${esc(current && !current.startsWith("data:") ? current : "")}" placeholder="https://…">
        <input type="hidden" name="imgData" value="">
      </div>
      ${withPresets ? `<div class="field"><span class="lbl">Or choose one</span><div class="presets">
        ${PRESET_PHOTOS.map((u, i) => `<button type="button" class="photo g${(i % 5) + 1}" data-preset="${esc(u)}"><img src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()"></button>`).join("")}
      </div></div>` : ""}`;
  }

  function confirmReset() {
    const cur = currentDayNum();
    ui.modal = { type: "reset" };
    openModal(`
      <div class="modal-body">
        <h3>↺ Reset 75 Hard?</h3>
        <p>Day 1 becomes <strong>today (${fmtLong(todayISO())})</strong>. Every date — the calendar, day pages, reward unlock dates and the finish line — moves with it.</p>
        <p class="muted" style="font-size:13.5px">Your daily task pages are cleared and rewards re-lock. Progress reports are kept, and this attempt (${Math.max(0, Math.min(cur, TOTAL_DAYS))} days in, ${streak()} completed in a row) is saved to Past attempts.</p>
        <div class="modal-actions">
          <button class="btn" data-action="close-modal">Cancel</button>
          <button class="btn btn-primary" data-action="confirm-reset">Reset to today</button>
        </div>
      </div>`);
  }

  function editReward(id) {
    const r = state.rewards.find((x) => x.id === id);
    if (!r) return;
    ui.modal = { type: "reward", id };
    const on = rewardUnlocked(r);
    openModal(`
      ${photo(r.img, r.emoji, "", 1)}
      <form class="modal-body" data-form="reward">
        <h3>${r.emoji} ${esc(r.title)}</h3>
        <p class="muted" style="margin-top:-8px;font-size:13.5px">${on ? "✨ Unlocked — go treat yourself." : `Unlocks when Days 1–${r.day} are all complete (${fmtLong(dateOf(r.day))}).`}</p>
        <div class="row2">
          <div class="field"><label>Title</label><input name="title" value="${esc(r.title)}" required></div>
          <div class="field"><label>Emoji</label><input name="emoji" value="${esc(r.emoji)}" maxlength="4"></div>
        </div>
        <div class="row2">
          <div class="field"><label>Unlocks on day</label><input name="day" type="number" min="1" max="${TOTAL_DAYS}" value="${r.day}" required></div>
          <div class="field"><label>Link (shop, booking…)</label><input name="link" value="${esc(r.link || "")}" placeholder="https://…"></div>
        </div>
        <div class="field"><label>Note</label><input name="desc" value="${esc(r.desc || "")}"></div>
        ${photoPicker(r.img, false)}
        <div class="modal-actions">
          ${on && r.link ? `<a class="btn left" href="${esc(r.link)}" target="_blank" rel="noopener">Open link ↗</a>` : ""}
          <button type="button" class="btn" data-action="close-modal">Cancel</button>
          <button class="btn btn-primary">Save</button>
        </div>
      </form>`);
  }

  function editReport(id, presetDay) {
    const existing = state.reports.find((x) => x.id === id);
    const date = existing?.date || (presetDay ? dateOf(presetDay) : todayISO());
    const r = existing || { id: null, date, title: "", weight: "", mood: "🙂", text: "", photo: "" };
    ui.modal = { type: "report", id: r.id, mood: r.mood };
    openModal(`
      ${photo(r.photo || PHOTOS.cover, r.mood || "📈", "", 3)}
      <form class="modal-body" data-form="report">
        <h3>${existing ? "Edit progress report" : "New progress report"}</h3>
        <div class="field"><label>Title</label><input name="title" value="${esc(r.title)}" placeholder="Week 2 check-in"></div>
        <div class="row2">
          <div class="field"><label>Date</label><input name="date" type="date" value="${r.date}" required></div>
          <div class="field"><label>Weight / measurement</label><input name="weight" value="${esc(r.weight)}" placeholder="e.g. 140 lb"></div>
        </div>
        <div class="field"><span class="lbl">Mood</span>
          <div class="moods">${MOODS.map((m) => `<button type="button" class="mood ${m === r.mood ? "on" : ""}" data-mood="${m}">${m}</button>`).join("")}</div>
        </div>
        <div class="field"><label>How's it going?</label><textarea name="text" placeholder="Energy, cravings, wins, struggles…">${esc(r.text)}</textarea></div>
        ${photoPicker(r.photo, false)}
        <div class="modal-actions">
          ${existing ? `<button type="button" class="btn btn-danger left" data-action="delete-report" data-id="${r.id}">Delete</button>` : ""}
          <button type="button" class="btn" data-action="close-modal">Cancel</button>
          <button class="btn btn-primary">Save report</button>
        </div>
      </form>`);
  }

  function editPhoto(kind, n) {
    ui.modal = { type: "photo", kind, day: n };
    const current = kind === "cover" ? state.cover : state.days[n]?.photo || "";
    openModal(`
      <form class="modal-body" data-form="photo">
        <h3>${kind === "cover" ? "🖼️ Change cover" : `🖼️ Photo for Day ${n}`}</h3>
        ${photoPicker(current, true)}
        <div class="modal-actions">
          <button type="button" class="btn" data-action="close-modal">Cancel</button>
          <button class="btn btn-primary">Save</button>
        </div>
      </form>`);
  }

  // Shrink uploaded images so they fit comfortably in localStorage.
  function readImage(file, max = 1000) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.78));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  const pickedImage = (form) => form.imgData.value || form.img.value.trim();

  function setModalPreview(src) {
    const ph = $("#modal .photo:not([data-preset])");
    if (!ph) return;
    ph.querySelector("img")?.remove();
    const img = document.createElement("img");
    img.src = src; img.alt = "";
    img.onerror = () => img.remove();
    ph.appendChild(img);
  }

  /* =========================================================
     EVENTS
     ========================================================= */
  const isMobile = () => window.matchMedia("(max-width: 900px)").matches;
  function closeMobileSidebar() { if (isMobile()) $("#app").classList.remove("sb-open-mobile"); }

  document.addEventListener("click", (e) => {
    // Links inside clickable cards should just navigate
    if (e.target.closest("[data-stop]")) return;

    const preset = e.target.closest("[data-preset]");
    if (preset) {
      const form = preset.closest("form");
      form.img.value = preset.dataset.preset;
      form.imgData.value = "";
      document.querySelectorAll("[data-preset]").forEach((b) => (b.style.borderColor = ""));
      preset.style.borderColor = "var(--accent)";
      return;
    }
    const mood = e.target.closest("[data-mood]");
    if (mood) {
      ui.modal.mood = mood.dataset.mood;
      document.querySelectorAll("[data-mood]").forEach((b) => b.classList.toggle("on", b === mood));
      return;
    }

    const el = e.target.closest("[data-action]");
    if (!el) {
      if (e.target.closest(".nav-item")) closeMobileSidebar();
      return;
    }
    const a = el.dataset.action;
    const n = el.dataset.day ? Number(el.dataset.day) : null;

    switch (a) {
      case "toggle-sidebar":
        if (isMobile()) $("#app").classList.toggle("sb-open-mobile");
        else $("#app").classList.toggle("sb-closed");
        break;
      case "toggle-section":
        state.ui[el.dataset.key] = !state.ui[el.dataset.key];
        save(); renderSidebar();
        break;
      case "cal-prev": case "cal-next": {
        const d = new Date(ui.calMonth.y, ui.calMonth.m + (a === "cal-next" ? 1 : -1), 1);
        ui.calMonth = { y: d.getFullYear(), m: d.getMonth() };
        renderCalendar();
        break;
      }
      case "cal-today": ui.calMonth = null; renderCalendar(); break;
      case "reset": confirmReset(); break;
      case "confirm-reset": closeModal(); doReset(); break;
      case "new-day": {
        const next = nextNewDay();
        if (!next) { toast("All 75 days already exist. 💪"); break; }
        createDay(next); render(); openPeek(next);
        toast(`📄 Day ${next} created`);
        break;
      }
      case "create-day": createDay(n); render(); break;
      case "open-day":
        if (!state.days[n]) { if (!createDay(n)) break; render(); toast(`📄 Day ${n} created`); }
        openPeek(n);
        break;
      case "close-peek": closePeek(); break;
      case "peek-nav": {
        const to = ui.peekDay + Number(el.dataset.dir);
        if (to < 1 || to > TOTAL_DAYS) break;
        if (!state.days[to]) { createDay(to); render(); }
        openPeek(to);
        break;
      }
      case "toggle-task": toggleTask(n, el.dataset.id); break;
      case "del-task": {
        const day = state.days[n];
        day.tasks = day.tasks.filter((t) => t.id !== el.dataset.id);
        save(); render();
        break;
      }
      case "delete-day":
        askConfirm(`Delete Day ${n}?`, "Its tasks, notes and photo will be removed.", "Delete day", () => {
          delete state.days[n]; closePeek(); save(); render(); toast(`🗑 Day ${n} deleted`);
        });
        break;
      case "day-photo": editPhoto("day", n); break;
      case "day-photo-clear": delete state.days[n].photo; save(); render(); break;
      case "change-cover": editPhoto("cover"); break;
      case "edit-reward": editReward(el.dataset.id); break;
      case "new-report": editReport(null, n); closeMobileSidebar(); break;
      case "edit-report": editReport(el.dataset.id); closeMobileSidebar(); break;
      case "delete-report": {
        const id = el.dataset.id;
        askConfirm("Delete this progress report?", "The report and its photo will be removed.", "Delete report", () => {
          state.reports = state.reports.filter((r) => r.id !== id);
          save(); render(); toast("🗑 Report deleted");
        });
        break;
      }
      case "confirm-yes": {
        const fn = ui.modal?.onYes;
        closeModal();
        if (fn) fn();
        break;
      }
      case "close-modal": closeModal(); break;
      case "export": exportData(); break;
    }
  });

  document.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.id === "startInput" && t.value) {
      state.startDate = t.value;
      ui.calMonth = null;
      save(); render();
      toast(`📅 Start moved to ${fmtLong(t.value)} — all dates updated.`);
    }
    if (t.id === "importFile" && t.files[0]) importData(t.files[0]);
    if (t.matches("[data-upload]") && t.files[0]) {
      try {
        const data = await readImage(t.files[0]);
        const form = t.closest("form");
        form.imgData.value = data;
        form.img.value = "";
        setModalPreview(data);
        toast("📷 Photo ready — hit Save");
      } catch { toast("Couldn't read that image."); }
    }
  });

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.edit === "task") {
      const task = state.days[t.dataset.day]?.tasks.find((x) => x.id === t.dataset.id);
      if (task) { task.text = t.value; save(); }
    } else if (t.dataset.edit === "note") {
      const day = state.days[t.dataset.day];
      if (day) { day.note = t.value; save(); }
    } else if (t.name === "img" && t.closest("#modal")) {
      t.form.imgData.value = "";
      if (/^https?:\/\//.test(t.value.trim())) setModalPreview(t.value.trim());
    }
  });

  document.addEventListener("submit", (e) => {
    const form = e.target;
    const kind = form.dataset.form;
    if (!kind) return;
    e.preventDefault();

    if (kind === "add-task") {
      const text = form.text.value.trim();
      if (!text) return;
      const n = Number(form.dataset.day);
      state.days[n].tasks.push({ id: uid(), icon: "", text, done: false });
      save(); render();
      // keep focus in the add box for quick multi-add
      const again = document.querySelector(`${ui.peekDay === n ? "#peek " : "#todayBlock "}[data-form="add-task"][data-day="${n}"] input`);
      again?.focus();
    }

    if (kind === "reward") {
      const r = state.rewards.find((x) => x.id === ui.modal.id);
      r.title = form.title.value.trim() || r.title;
      r.emoji = form.emoji.value.trim() || r.emoji;
      r.day = Math.max(1, Math.min(TOTAL_DAYS, Number(form.day.value) || r.day));
      r.link = form.link.value.trim();
      r.desc = form.desc.value.trim();
      r.img = pickedImage(form) || r.img;
      save(); closeModal(); render();
      toast("🎁 Reward saved");
    }

    if (kind === "report") {
      const data = {
        title: form.title.value.trim(),
        date: form.date.value || todayISO(),
        weight: form.weight.value.trim(),
        mood: ui.modal.mood,
        text: form.text.value.trim(),
      };
      const img = pickedImage(form);
      if (ui.modal.id) {
        const r = state.reports.find((x) => x.id === ui.modal.id);
        Object.assign(r, data);
        if (img) r.photo = img;
      } else {
        const n = dayNumOf(data.date);
        if (!data.title) data.title = n >= 1 && n <= TOTAL_DAYS ? `Day ${n} check-in` : "Progress report";
        state.reports.push({ id: uid(), ...data, photo: img });
      }
      save(); closeModal(); render();
      toast("📈 Progress report saved");
    }

    if (kind === "photo") {
      const img = pickedImage(form);
      if (!img) { closeModal(); return; }
      if (ui.modal.kind === "cover") state.cover = img;
      else if (state.days[ui.modal.day]) state.days[ui.modal.day].photo = img;
      save(); closeModal(); render();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if ($("#modalWrap").classList.contains("open")) closeModal();
    else if (ui.peekDay != null) closePeek();
  });

  /* ---------- Backup ---------- */
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `75-hard-backup-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(reader.result);
        if (!s.startDate || !s.days) throw new Error("bad file");
        const base = freshState();
        state = migratePhotos({ ...base, ...s, ui: { ...base.ui, ...(s.ui || {}) } });
        ui.calMonth = null;
        save(); closePeek(); render();
        toast("✅ Backup imported");
      } catch { toast("That file isn't a 75 Hard backup."); }
    };
    reader.readAsText(file);
    $("#importFile").value = "";
  }

  /* ---------- Feedback ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
  }

  function confetti(count = 80) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#111111", "#ffffff", "#8a8a8a", "#d4d4d4", "#444444"];
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "confetti";
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 1.6 + Math.random() * 1.8 + "s";
      p.style.animationDelay = Math.random() * 0.4 + "s";
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4000);
    }
  }

  // Re-render at midnight so "today" rolls over without a reload.
  let lastDay = todayISO();
  setInterval(() => { if (todayISO() !== lastDay) { lastDay = todayISO(); ui.calMonth = null; render(); } }, 60_000);

  // Gentle 3D tilt on reward cards
  document.addEventListener("pointermove", (e) => {
    const card = e.target.closest?.(".reward");
    document.querySelectorAll(".reward.tilting").forEach((c) => {
      if (c !== card) { c.classList.remove("tilting"); c.style.transform = ""; }
    });
    if (!card || e.pointerType !== "mouse") return;
    const b = card.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width - 0.5;
    const y = (e.clientY - b.top) / b.height - 0.5;
    card.classList.add("tilting");
    card.style.transform = `perspective(700px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateY(-3px)`;
  });

  // Hooks for scene.js
  window.Hard75 = {
    snapshot,
    openDay(n) {
      if (n < 1 || n > TOTAL_DAYS) return;
      if (!state.days[n]) { createDay(n); render(); toast(`📄 Day ${n} created`); }
      openPeek(n);
    },
  };

  render();
})();
