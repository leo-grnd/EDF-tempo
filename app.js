// app.js — Tempo : couleur EDF du jour, coût horaire, conseils de consommation.
// Vanilla ES module, zéro dépendance. Données : api-couleur-tempo.fr (sans clé).
import {
  COLORS, COLOR_ORDER, QUOTAS, TARIFF_DATE,
  HC_START, HC_END, ANNOUNCE_HOUR, CHEAPEST_PRICE,
  isHC, currentPeriod, priceFor,
} from "./tariffs.js";

const API = "https://www.api-couleur-tempo.fr/api";
const PROXY = "https://corsproxy.io/?url="; // repli si l'appel direct est bloqué (CORS)
const CACHE_KEY = "tempo-cache-v1";
const THEME_KEY = "tempo-theme";

// --- petits helpers DOM ----------------------------------------------------
const $ = (id) => document.getElementById(id);
const fmtEUR = (p) => (p == null ? "—" : `${p.toFixed(4).replace(".", ",")} €`);
const cents = (p) => (p == null ? "—" : (p * 100).toFixed(2).replace(".", ","));

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long", day: "numeric", month: "long",
});
function frDate(iso) {
  // iso = "YYYY-MM-DD" → libellé français (sans décalage de fuseau)
  const [y, m, d] = iso.split("-").map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

function fmtDuree(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

// --- récupération données (direct, repli proxy) ----------------------------
async function getJSON(path) {
  const url = `${API}${path}`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch (_) {
    const r = await fetch(PROXY + encodeURIComponent(url));
    if (!r.ok) throw new Error(`proxy ${r.status}`);
    return await r.json();
  }
}

async function fetchAll() {
  const period = currentPeriod();
  const [today, tomorrow, season] = await Promise.all([
    getJSON("/jourTempo/today"),
    getJSON("/jourTempo/tomorrow"),
    getJSON(`/joursTempo?periode[]=${period}`),
  ]);
  return { today, tomorrow, season, period, savedAt: Date.now() };
}

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
  } catch (_) {
    return null;
  }
}
function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (_) {}
}

// --- rendu : couleur du jour & du lendemain --------------------------------
function renderToday(day) {
  const code = day?.codeJour ?? 0;
  const c = COLORS[code];
  const hc = isHC();
  const price = priceFor(code, hc);

  $("today-card").dataset.color = c.id;
  $("today-name").textContent = c.nom;
  $("today-date").textContent = day?.dateJour ? frDate(day.dateJour) : "—";

  $("today-period").textContent = hc ? "Heures creuses" : "Heures pleines";
  $("today-period").dataset.slot = hc ? "hc" : "hp";
  $("today-price").innerHTML = price == null
    ? "—"
    : `${cents(price)}<span class="unit">c€/kWh</span>`;
}

function renderTomorrow(day) {
  const code = day?.codeJour ?? 0;
  const c = COLORS[code];
  const known = code !== 0;
  $("tomorrow-card").dataset.color = c.id;
  $("tomorrow-name").textContent = known ? c.nom : "Pas encore annoncé";
  $("tomorrow-date").textContent = day?.dateJour ? frDate(day.dateJour) : "demain";

  const note = $("tomorrow-note");
  if (known) {
    note.textContent = `HP ${cents(c.hp)} · HC ${cents(c.hc)} c€/kWh`;
  } else {
    note.textContent = `Annonce attendue vers ${ANNOUNCE_HOUR} h · dans ${countdownToAnnounce()}`;
  }
}

function countdownToAnnounce() {
  const now = new Date();
  const t = new Date(now);
  t.setHours(ANNOUNCE_HOUR, 0, 0, 0);
  if (now >= t) t.setDate(t.getDate() + 1);
  return fmtDuree(t - now);
}

// --- conseil "faut-il consommer maintenant ?" ------------------------------
function renderAdvice(today) {
  const code = today?.codeJour ?? 0;
  const hc = isHC();
  const card = $("advice-card");

  let level, titre, detail;
  if (code === 0) {
    level = "neutre";
    titre = "Couleur du jour indisponible";
    detail = "Impossible de récupérer la couleur du jour pour le moment.";
  } else if (code === 3) {
    // Rouge
    level = hc ? "moyen" : "danger";
    titre = hc ? "Rouge, mais en heures creuses" : "Jour rouge — évitez les gros usages";
    detail = hc
      ? "Le pire est passé : en heures creuses, même un jour rouge reste raisonnable."
      : "Lave-linge, chauffe-eau, recharge VE… reportez tout ce qui peut l'être après 22 h.";
  } else if (code === 2) {
    // Blanc
    level = hc ? "bon" : "moyen";
    titre = hc ? "Jour blanc, heures creuses — c'est correct" : "Jour blanc — usages modérés";
    detail = hc
      ? "Moment correct pour les appareils gourmands."
      : "Tarif intermédiaire : décalez l'essentiel après 22 h si possible.";
  } else {
    // Bleu
    level = hc ? "bon" : "moyen";
    titre = hc ? "Jour bleu, heures creuses — feu vert" : "Jour bleu — c'est le moins cher";
    detail = hc
      ? "Le tarif le plus bas de l'année : lancez tout ce que vous voulez."
      : "Bon tarif ; en heures creuses (après 22 h) ce sera encore meilleur.";
  }

  card.dataset.level = level;
  $("advice-title").textContent = titre;
  $("advice-detail").textContent = detail;
  $("advice-countdown").textContent = hc
    ? `Fin des heures creuses dans ${countdownHCEnd()}`
    : `Heures creuses dans ${countdownHCStart()}`;
}

function countdownHCStart() {
  const now = new Date();
  const t = new Date(now);
  t.setHours(HC_START, 0, 0, 0);
  if (now >= t) t.setDate(t.getDate() + 1);
  return fmtDuree(t - now);
}
function countdownHCEnd() {
  const now = new Date();
  const t = new Date(now);
  if (now.getHours() < HC_END) {
    t.setHours(HC_END, 0, 0, 0);
  } else {
    t.setDate(t.getDate() + 1);
    t.setHours(HC_END, 0, 0, 0);
  }
  return fmtDuree(t - now);
}

// --- grille tarifaire ------------------------------------------------------
function renderTariffs(today) {
  const tbody = $("tariff-body");
  tbody.innerHTML = "";
  const code = today?.codeJour ?? 0;
  const hc = isHC();

  for (const k of COLOR_ORDER) {
    const c = COLORS[k];
    const tr = document.createElement("tr");
    tr.dataset.color = c.id;
    const hpCur = k === code && !hc;
    const hcCur = k === code && hc;
    tr.innerHTML = `
      <th scope="row"><span class="swatch" data-color="${c.id}" aria-hidden="true"></span>${c.nom}</th>
      <td class="${hpCur ? "is-current" : ""}">${cents(c.hp)}</td>
      <td class="${hcCur ? "is-current" : ""}">${cents(c.hc)}</td>`;
    tbody.appendChild(tr);
  }
  $("tariff-date").textContent = TARIFF_DATE;
}

// --- quotas de la saison ---------------------------------------------------
function countByColor(season) {
  const out = { bleu: 0, blanc: 0, rouge: 0, inconnu: 0 };
  const todayISO = new Date().toISOString().slice(0, 10);
  for (const d of season) {
    if (d.dateJour > todayISO) continue; // on ne compte que le passé/présent
    const id = (COLORS[d.codeJour] || COLORS[0]).id;
    out[id] = (out[id] || 0) + 1;
  }
  return out;
}

function renderQuotas(season) {
  const counts = countByColor(season);
  const wrap = $("quotas");
  wrap.innerHTML = "";
  for (const id of ["rouge", "blanc", "bleu"]) {
    const used = counts[id] || 0;
    const max = QUOTAS[id];
    const reste = Math.max(0, max - used);
    const pct = Math.min(100, (used / max) * 100);
    const row = document.createElement("div");
    row.className = "quota";
    row.innerHTML = `
      <div class="quota-head">
        <span class="quota-name"><span class="swatch" data-color="${id}" aria-hidden="true"></span>${cap(id)}</span>
        <span class="quota-count"><b>${used}</b> / ${max}</span>
      </div>
      <div class="quota-bar"><span data-color="${id}" style="width:${pct}%"></span></div>
      <div class="quota-rest">${reste} ${id === "bleu" ? "jour" : "jour"}${reste > 1 ? "s" : ""} restant${reste > 1 ? "s" : ""}</div>`;
    wrap.appendChild(row);
  }
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// --- calendrier de la saison (heatmap) -------------------------------------
function renderCalendar(season) {
  const grid = $("calendar");
  grid.innerHTML = "";
  if (!season.length) return;

  const byDate = new Map(season.map((d) => [d.dateJour, d.codeJour]));
  const sorted = [...season].sort((a, b) => a.dateJour.localeCompare(b.dateJour));
  const first = parseISO(sorted[0].dateJour);
  const last = parseISO(sorted[sorted.length - 1].dateJour);
  const todayISO = new Date().toISOString().slice(0, 10);

  // Décalage pour aligner la 1ʳᵉ colonne (semaine commençant le lundi).
  const lead = (first.getDay() + 6) % 7; // lundi=0 … dimanche=6
  for (let i = 0; i < lead; i++) {
    const pad = document.createElement("span");
    pad.className = "cal-cell cal-pad";
    grid.appendChild(pad);
  }

  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const code = byDate.get(iso);
    const cell = document.createElement("span");
    cell.className = "cal-cell";
    const future = iso > todayISO;
    const c = COLORS[code ?? 0];
    cell.dataset.color = future ? "futur" : c.id;
    cell.title = `${frDate(iso)} — ${future ? "à venir" : c.nom}`;
    if (iso === todayISO) cell.classList.add("is-today");
    grid.appendChild(cell);
  }
}
function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// --- simulateur de coût d'usage --------------------------------------------
let simState = { kwh: 1 };
function renderSimulator(today) {
  const code = today?.codeJour ?? 1;
  const hc = isHC();
  const now = priceFor(code, hc) ?? COLORS[1].hp;
  const kwh = simState.kwh;

  const coutNow = now * kwh;
  const coutBest = CHEAPEST_PRICE * kwh;
  const delta = coutNow - coutBest;

  $("sim-now-label").textContent =
    `${COLORS[code].nom} · ${hc ? "heures creuses" : "heures pleines"}`;
  $("sim-now").textContent = `${coutNow.toFixed(2).replace(".", ",")} €`;
  $("sim-best").textContent = `${coutBest.toFixed(2).replace(".", ",")} €`;
  $("sim-delta").textContent =
    delta <= 0.005
      ? "déjà au tarif le plus bas 🎉"
      : `soit ${delta.toFixed(2).replace(".", ",")} € d'économie en attendant`;
}

function setupSimulator(getToday) {
  const input = $("sim-kwh");
  const sync = () => {
    const v = parseFloat(input.value.replace(",", "."));
    simState.kwh = isFinite(v) && v > 0 ? v : 0;
    renderSimulator(getToday());
  };
  input.addEventListener("input", sync);
  document.querySelectorAll(".sim-preset").forEach((b) => {
    b.addEventListener("click", () => {
      input.value = b.dataset.kwh;
      sync();
    });
  });
}

// --- thème -----------------------------------------------------------------
function setupTheme() {
  const icon = $("themeIcon");
  const apply = (t) => {
    if (t === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      icon.textContent = "☀";
    } else {
      document.documentElement.removeAttribute("data-theme");
      icon.textContent = "☾";
    }
  };
  const saved = localStorage.getItem(THEME_KEY)
    || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  apply(saved);
  $("themeToggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next);
    apply(next);
  });
}

// --- orchestration ---------------------------------------------------------
let current = null; // dernier jeu de données rendu

function renderAll(data) {
  current = data;
  renderToday(data.today);
  renderTomorrow(data.tomorrow);
  renderAdvice(data.today);
  renderTariffs(data.today);
  renderQuotas(data.season || []);
  renderCalendar(data.season || []);
  renderSimulator(data.today);
  $("updated").textContent = new Date(data.savedAt).toLocaleString("fr-FR", {
    dateStyle: "short", timeStyle: "short",
  });
}

// Élements live (dépendant de l'heure) rafraîchis chaque minute.
function tick() {
  if (!current) return;
  renderToday(current.today);
  renderTomorrow(current.tomorrow);
  renderAdvice(current.today);
  renderTariffs(current.today);
  renderSimulator(current.today);
}

function setStatus(state) {
  // state: "live" | "cache" | "error"
  const el = $("status");
  if (!el) return;
  el.dataset.state = state;
  el.textContent = state === "live" ? "EDF Tempo · en direct"
    : state === "cache" ? "données en cache"
    : "hors ligne";
}

async function init() {
  setupTheme();
  setupSimulator(() => current?.today);

  const cached = loadCache();
  if (cached && cached.period === currentPeriod()) {
    renderAll(cached);
    setStatus("cache");
  }

  try {
    const fresh = await fetchAll();
    saveCache(fresh);
    renderAll(fresh);
    setStatus("live");
  } catch (err) {
    if (!cached) {
      $("advice-title").textContent = "Données indisponibles";
      $("advice-detail").textContent = "Vérifiez votre connexion puis rechargez la page.";
      setStatus("error");
    } else {
      setStatus("cache");
    }
    console.warn("Tempo: échec de récupération", err);
  }

  setInterval(tick, 60000);

  // Service worker (hors-ligne / installable)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

init();
