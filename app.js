"use strict";

const API = "https://pokeapi.co/api/v2";
const ART = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const PAGE = 36;
const STAT_MAX = 180;
const TOTAL_MAX = 720;
const FEATURED = [6, 25, 94, 149, 197, 282, 384, 448, 658, 887];

const TYPES = {
  normal: { es: "Normal", color: "#a8a77a" },
  fire: { es: "Fuego", color: "#ee8130" },
  water: { es: "Agua", color: "#6390f0" },
  electric: { es: "Eléctrico", color: "#f7d02c" },
  grass: { es: "Planta", color: "#7ac74c" },
  ice: { es: "Hielo", color: "#96d9d6" },
  fighting: { es: "Lucha", color: "#c22e28" },
  poison: { es: "Veneno", color: "#a33ea1" },
  ground: { es: "Tierra", color: "#e2bf65" },
  flying: { es: "Volador", color: "#a98ff3" },
  psychic: { es: "Psíquico", color: "#f95587" },
  bug: { es: "Bicho", color: "#a6b91a" },
  rock: { es: "Roca", color: "#b6a136" },
  ghost: { es: "Fantasma", color: "#735797" },
  dragon: { es: "Dragón", color: "#6f35fc" },
  dark: { es: "Siniestro", color: "#705746" },
  steel: { es: "Acero", color: "#b7b7ce" },
  fairy: { es: "Hada", color: "#d685ad" },
};

const STATS = {
  hp: "PS",
  attack: "Ataque",
  defense: "Defensa",
  "special-attack": "At. esp.",
  "special-defense": "Def. esp.",
  speed: "Velocidad",
};

// Nombres que no salen bien de pasar el slug a mayúsculas.
const NAME_FIX = {
  "nidoran-f": "Nidoran ♀", "nidoran-m": "Nidoran ♂", "mr-mime": "Mr. Mime", "mime-jr": "Mime Jr.",
  "mr-rime": "Mr. Rime", farfetchd: "Farfetch'd", sirfetchd: "Sirfetch'd", "type-null": "Type: Null",
  flabebe: "Flabébé", "ho-oh": "Ho-Oh", "porygon-z": "Porygon-Z", "jangmo-o": "Jangmo-o",
  "hakamo-o": "Hakamo-o", "kommo-o": "Kommo-o", "wo-chien": "Wo-Chien", "chien-pao": "Chien-Pao",
  "ting-lu": "Ting-Lu", "chi-yu": "Chi-Yu",
};

const $ = (sel, root = document) => root.querySelector(sel);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const pad = (n) => String(n).padStart(4, "0");
const fmt = (n) => n.toLocaleString("es", { maximumFractionDigits: 1 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const idFromUrl = (url) => Number(url.split("/").filter(Boolean).pop());
const typeColor = (type) => TYPES[type]?.color ?? "#8a8f99";
const typeNames = (p) => [...p.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
const prettyName = (slug) => NAME_FIX[slug] ?? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const badges = (types, tag = "li") => types.map((t) => `<${tag} class="type" style="--c:${typeColor(t)}">${TYPES[t]?.es ?? t}</${tag}>`).join("");

const memo = new Map();
function getJSON(url) {
  if (!memo.has(url)) {
    const req = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    req.catch(() => memo.delete(url));
    memo.set(url, req);
  }
  return memo.get(url);
}
const getPokemon = (id) => getJSON(`${API}/pokemon/${id}`);
const getSpecies = (id) => getJSON(`${API}/pokemon-species/${id}`);

function preload(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = resolve;
    img.src = src;
  });
}

function pickLang(entries, field) {
  const entry = entries.filter((e) => e.language.name === "es").at(-1) ?? entries.filter((e) => e.language.name === "en").at(-1);
  return entry ? entry[field] : "";
}
const speciesName = (s) => pickLang(s.names, "name") || prettyName(s.name);

const state = { all: [], byId: new Map(), list: [], shown: 0, type: "all", query: "", sort: "id" };
const maxId = () => state.all.at(-1)?.id ?? 1025;
const nameOf = (id, slug) => state.byId.get(id)?.name ?? prettyName(slug);

/* Tema */

const root = document.documentElement;
const themeBtn = $("#themeToggle");
const currentTheme = () => root.dataset.theme ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

function syncThemeButton() {
  const dark = currentTheme() === "dark";
  $("i", themeBtn).className = dark ? "ph ph-sun" : "ph ph-moon";
  themeBtn.setAttribute("aria-label", dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
}

themeBtn.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch {}
  syncThemeButton();
});
matchMedia("(prefers-color-scheme: light)").addEventListener("change", syncThemeButton);
syncThemeButton();

/* Hero */

const hero = $("#hero");
const stage = $("#heroStage");
let heroToken = 0;
let heroId = null;

async function setFeatured(id) {
  const token = ++heroToken;
  hero.classList.add("is-swapping");
  stage.setAttribute("aria-busy", "true");
  try {
    const [p, s] = await Promise.all([getPokemon(id), getSpecies(id), preload(ART(id)), wait(reduceMotion.matches ? 0 : 420)]);
    if (token !== heroToken) return;
    const types = typeNames(p);
    const name = speciesName(s);
    const total = p.stats.reduce((sum, x) => sum + x.base_stat, 0);

    hero.style.setProperty("--tc", typeColor(types[0]));
    const img = $("#heroImg");
    img.src = ART(id);
    img.alt = `Ilustración oficial de ${name}`;
    $("#heroNum").textContent = pad(id);
    $("#heroDex").textContent = `N.º ${pad(id)}`;
    $("#heroName").textContent = name;
    $("#heroGenus").textContent = pickLang(s.genera, "genus");
    $("#heroTypes").innerHTML = badges(types);
    $("#heroStats").innerHTML = `
      <div><dt>Altura</dt><dd>${fmt(p.height / 10)} m</dd></div>
      <div><dt>Peso</dt><dd>${fmt(p.weight / 10)} kg</dd></div>
      <div><dt>Total base</dt><dd>${total}</dd></div>`;
    $("#heroMore").disabled = false;
    heroId = id;
  } catch {
    if (token !== heroToken) return;
    $("#heroName").textContent = "Sin conexión";
    $("#heroGenus").textContent = "No pudimos cargar este Pokémon. Prueba con Al azar.";
  } finally {
    if (token === heroToken) {
      hero.classList.remove("is-swapping");
      stage.setAttribute("aria-busy", "false");
    }
  }
}

$("#randomBtn").addEventListener("click", () => {
  let id;
  do id = 1 + Math.floor(Math.random() * maxId());
  while (id === heroId);
  setFeatured(id);
});

$("#heroMore").addEventListener("click", () => heroId && openSheet(heroId));

// Inclinación leve de la ilustración siguiendo el puntero.
if (matchMedia("(pointer: fine)").matches) {
  const art = $(".hero-art");
  let raf = 0;
  stage.addEventListener("pointermove", (e) => {
    if (reduceMotion.matches) return;
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      art.style.setProperty("--ry", `${x * 14}deg`);
      art.style.setProperty("--rx", `${y * -10}deg`);
    });
  });
  stage.addEventListener("pointerleave", () => {
    cancelAnimationFrame(raf);
    art.style.setProperty("--ry", "0deg");
    art.style.setProperty("--rx", "0deg");
  });
}

/* Explorador */

const grid = $("#grid");
const gridState = $("#gridState");
const loadMoreBtn = $("#loadMore");
const typeSets = new Map();
let filterToken = 0;
let retry = null;

async function loadIndex() {
  const data = await getJSON(`${API}/pokemon-species?limit=2000`);
  state.all = data.results
    .map((r) => ({ id: idFromUrl(r.url), slug: r.name, name: prettyName(r.name) }))
    .sort((a, b) => a.id - b.id);
  state.all.forEach((p) => state.byId.set(p.id, p));
  $("#pokeList").innerHTML = state.all.map((p) => `<option value="${esc(p.name)}"></option>`).join("");
}

async function typeIds(type) {
  if (!typeSets.has(type)) {
    const data = await getJSON(`${API}/type/${type}`);
    typeSets.set(type, new Set(data.pokemon.map((e) => idFromUrl(e.pokemon.url))));
  }
  return typeSets.get(type);
}

async function applyFilters() {
  const token = ++filterToken;
  let list = state.all;

  if (state.type !== "all") {
    try {
      const ids = await typeIds(state.type);
      if (token !== filterToken) return;
      list = list.filter((p) => ids.has(p.id));
    } catch {
      if (token === filterToken) showError(applyFilters);
      return;
    }
  }

  const q = state.query.trim().toLowerCase();
  if (q) {
    const num = q.replace(/^#/, "");
    const isNum = /^\d+$/.test(num);
    list = list.filter((p) => (isNum ? String(p.id).startsWith(String(Number(num))) : p.name.toLowerCase().includes(q) || p.slug.includes(q.replace(/\s+/g, "-"))));
  }

  if (state.sort === "az") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (state.sort === "za") list = [...list].sort((a, b) => b.name.localeCompare(a.name, "es"));

  state.list = list;
  renderGrid(true);
}

const revealer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    revealer.unobserve(entry.target);
    entry.target.classList.add("in");
    hydrate(entry.target);
  }
}, { rootMargin: "120px 0px" });

function makeTile(p, index, i) {
  const li = document.createElement("li");
  li.className = index % 13 === 0 ? "tile tile--wide" : "tile";
  li.style.setProperty("--i", i % 8);
  li.innerHTML = `
    <button class="tile-btn" type="button" data-id="${p.id}" aria-label="Ver ficha de ${esc(p.name)}">
      <span class="tile-art"><img alt="" width="475" height="475" loading="lazy" decoding="async" src="${ART(p.id)}"></span>
      <span class="tile-num">N.º ${pad(p.id)}</span>
      <span class="tile-name">${esc(p.name)}</span>
      <span class="tile-types"><span class="skel"></span><span class="skel"></span></span>
    </button>`;
  const img = $("img", li);
  img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
  img.addEventListener("error", () => $(".tile-art", li).classList.add("no-art"), { once: true });
  revealer.observe(li);
  return li;
}

async function hydrate(li) {
  const holder = $(".tile-types", li);
  try {
    const p = await getPokemon(Number($(".tile-btn", li).dataset.id));
    const types = typeNames(p);
    li.style.setProperty("--c", typeColor(types[0]));
    holder.innerHTML = badges(types, "span");
  } catch {
    holder.innerHTML = "";
  }
}

function renderGrid(reset) {
  if (reset) {
    grid.replaceChildren();
    state.shown = 0;
  }
  const batch = state.list.slice(state.shown, state.shown + PAGE);
  const frag = document.createDocumentFragment();
  batch.forEach((p, i) => frag.append(makeTile(p, state.shown + i, i)));
  grid.append(frag);
  state.shown += batch.length;
  updateMeta();
}

function updateMeta() {
  const total = state.list.length;
  $("#count").textContent = total === state.all.length ? `${total} Pokémon` : `${total} de ${state.all.length}`;
  loadMoreBtn.hidden = state.shown >= total;

  if (total > 0) {
    gridState.hidden = true;
    return;
  }
  const typeLabel = state.type !== "all" ? ` de tipo ${TYPES[state.type].es}` : "";
  const query = state.query.trim();
  gridState.innerHTML = `
    <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
    <h3>Ningún Pokémon coincide</h3>
    <p>${query ? `No hay resultados para «${esc(query)}»${typeLabel}.` : `No hay Pokémon${typeLabel}.`} Prueba con otro nombre o número.</p>
    <button class="btn btn-ghost" type="button" data-action="reset">Limpiar filtros</button>`;
  gridState.hidden = false;
}

function showSkeleton() {
  grid.innerHTML = Array.from({ length: 12 }, (_, i) => `
    <li class="tile in${i === 0 ? " tile--wide" : ""}" aria-hidden="true">
      <div class="tile-btn">
        <span class="tile-art"></span>
        <span class="skel skel--line" style="width:56px"></span>
        <span class="skel skel--line" style="width:70%;height:18px;margin:10px 0 12px"></span>
        <span class="tile-types"><span class="skel"></span></span>
      </div>
    </li>`).join("");
}

function showError(fn) {
  retry = fn;
  grid.replaceChildren();
  loadMoreBtn.hidden = true;
  $("#count").textContent = "";
  gridState.innerHTML = `
    <i class="ph ph-wifi-slash" aria-hidden="true"></i>
    <h3>No pudimos cargar la Pokédex</h3>
    <p>PokéAPI no respondió. Revisa tu conexión e inténtalo de nuevo.</p>
    <button class="btn btn-ghost" type="button" data-action="retry"><i class="ph-bold ph-arrow-clockwise" aria-hidden="true"></i> Reintentar</button>`;
  gridState.hidden = false;
}

function renderChips() {
  const chips = [["all", "Todos", "var(--accent)"], ...Object.entries(TYPES).map(([k, v]) => [k, v.es, v.color])];
  $("#typeFilter").innerHTML = chips
    .map(([k, label, c]) => `<button class="chip" type="button" data-type="${k}" aria-pressed="${k === state.type}" style="--c:${c}">${label}</button>`)
    .join("");
}

function syncChips() {
  for (const chip of $("#typeFilter").children) chip.setAttribute("aria-pressed", String(chip.dataset.type === state.type));
}

$("#typeFilter").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip || chip.dataset.type === state.type) return;
  state.type = chip.dataset.type;
  syncChips();
  if (state.all.length) applyFilters();
});

const search = $("#search");
let searchTimer = 0;
search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = search.value;
    if (state.all.length) applyFilters();
  }, 160);
});

$("#sort").addEventListener("change", (e) => {
  state.sort = e.target.value;
  if (state.all.length) applyFilters();
});

loadMoreBtn.addEventListener("click", () => renderGrid(false));

grid.addEventListener("click", (e) => {
  const btn = e.target.closest("button.tile-btn");
  if (btn) openSheet(Number(btn.dataset.id));
});

gridState.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "reset") {
    state.query = "";
    state.type = "all";
    search.value = "";
    syncChips();
    applyFilters();
  }
  if (action === "retry" && retry) {
    gridState.hidden = true;
    showSkeleton();
    retry();
  }
});

/* Ficha */

const sheet = $("#sheet");
const sheetBody = $("#sheetBody");
let sheetToken = 0;
let sheetId = null;

const sheetSkeleton = () => `
  <div class="sheet-visual"><span class="skel skel-orb"></span></div>
  <div class="sheet-info">
    <span class="skel skel--line" style="width:180px"></span>
    <span class="skel skel--line" style="width:90px;margin-top:28px"></span>
    <span class="skel skel--line" style="width:60%;height:44px;margin-top:12px"></span>
    <span class="skel skel--line" style="width:40%;height:16px;margin-top:12px"></span>
    <span class="skel skel--line" style="width:100%;height:72px;margin-top:28px;border-radius:var(--r-surface)"></span>
    <span class="skel skel--line" style="width:100%;height:180px;margin-top:28px;border-radius:var(--r-surface)"></span>
  </div>`;

function flattenChain(data) {
  const stages = [];
  (function walk(node, depth) {
    (stages[depth] ??= []).push({ id: idFromUrl(node.species.url), slug: node.species.name });
    node.evolves_to.forEach((next) => walk(next, depth + 1));
  })(data.chain, 0);
  return stages;
}

function evoHTML(stages, current) {
  if (stages.length < 2) return `<p class="muted">No tiene evoluciones conocidas.</p>`;
  const stageHTML = stages.map((group) => `
    <div class="evo-stage">${group.map((e) => `
      <button class="evo-item" type="button" data-go="${e.id}"${e.id === current ? ' aria-current="true"' : ""}>
        <img src="${ART(e.id)}" alt="" width="64" height="64" loading="lazy">
        <span>${esc(nameOf(e.id, e.slug))}</span>
      </button>`).join("")}
    </div>`);
  return `<div class="evo">${stageHTML.join('<i class="ph-bold ph-caret-right evo-arrow" aria-hidden="true"></i>')}</div>`;
}

function sheetHTML(id, p, s, abilities, stages) {
  const types = typeNames(p);
  const name = speciesName(s);
  const flavor = pickLang(s.flavor_text_entries, "flavor_text").replace(/[\f\n\r­]+/g, " ").replace(/\s+/g, " ").trim();
  const total = p.stats.reduce((sum, x) => sum + x.base_stat, 0);
  const stats = p.stats.map((x) => `
    <div class="stat">
      <span class="stat-lbl">${STATS[x.stat.name] ?? x.stat.name}</span>
      <span class="stat-val">${x.base_stat}</span>
      <span class="stat-bar" style="--s:${Math.min(x.base_stat / STAT_MAX, 1)}" aria-hidden="true"></span>
    </div>`).join("");
  const abilityList = abilities
    .map((a) => (a.hidden ? `<span class="hidden-ability">${esc(a.name)} (oculta)</span>` : esc(a.name)))
    .join("<br>");

  return `
    <div class="sheet-visual">
      <span class="sheet-ghost" aria-hidden="true">${pad(id)}</span>
      <img src="${ART(id)}" alt="Ilustración oficial de ${esc(name)}" width="475" height="475">
    </div>
    <div class="sheet-info">
      <div class="sheet-nav">
        <button class="link-btn" type="button" data-go="${id - 1}"${id <= 1 ? " disabled" : ""} aria-label="Pokémon anterior"><i class="ph-bold ph-arrow-left" aria-hidden="true"></i> N.º ${pad(Math.max(id - 1, 1))}</button>
        <button class="link-btn" type="button" data-go="${id + 1}"${id >= maxId() ? " disabled" : ""} aria-label="Pokémon siguiente">N.º ${pad(Math.min(id + 1, maxId()))} <i class="ph-bold ph-arrow-right" aria-hidden="true"></i></button>
      </div>
      <span class="mono dim">N.º ${pad(id)}</span>
      <h2 class="sheet-name" id="sheetName">${esc(name)}</h2>
      <p class="sheet-genus">${esc(pickLang(s.genera, "genus"))}</p>
      <ul class="types">${badges(types)}</ul>
      ${flavor ? `<p class="sheet-flavor">${esc(flavor)}</p>` : ""}
      <dl class="facts">
        <div><dt>Altura</dt><dd>${fmt(p.height / 10)} m</dd></div>
        <div><dt>Peso</dt><dd>${fmt(p.weight / 10)} kg</dd></div>
        <div><dt>Habilidades</dt><dd>${abilityList}</dd></div>
      </dl>
      <h3 class="sub">Estadísticas base</h3>
      <div class="stats">
        ${stats}
        <div class="stat total">
          <span class="stat-lbl">Total</span>
          <span class="stat-val">${total}</span>
          <span></span>
        </div>
      </div>
      <h3 class="sub">Evolución</h3>
      ${evoHTML(stages, id)}
    </div>`;
}

async function openSheet(id) {
  const token = ++sheetToken;
  sheetId = id;
  if (!sheet.open) sheet.showModal();
  sheetBody.classList.remove("is-ready");
  sheetBody.innerHTML = sheetSkeleton();

  try {
    const [p, s] = await Promise.all([getPokemon(id), getSpecies(id)]);
    const [abilities, stages] = await Promise.all([
      Promise.all(p.abilities.map((a) =>
        getJSON(a.ability.url)
          .then((d) => ({ name: pickLang(d.names, "name") || prettyName(a.ability.name), hidden: a.is_hidden }))
          .catch(() => ({ name: prettyName(a.ability.name), hidden: a.is_hidden })))),
      s.evolution_chain ? getJSON(s.evolution_chain.url).then(flattenChain).catch(() => []) : [],
    ]);
    if (token !== sheetToken) return;
    sheet.style.setProperty("--c", typeColor(typeNames(p)[0]));
    sheetBody.innerHTML = sheetHTML(id, p, s, abilities, stages);
    sheetBody.scrollTop = 0;
    $(".sheet-info", sheetBody).scrollTop = 0;
    await nextFrame();
    if (token === sheetToken) sheetBody.classList.add("is-ready");
  } catch {
    if (token !== sheetToken) return;
    sheetBody.innerHTML = `
      <div class="sheet-visual"></div>
      <div class="sheet-info">
        <div class="state">
          <i class="ph ph-wifi-slash" aria-hidden="true"></i>
          <h3 id="sheetName">No pudimos cargar la ficha</h3>
          <p>PokéAPI no respondió. Inténtalo otra vez en unos segundos.</p>
          <button class="btn btn-ghost" type="button" data-go="${id}"><i class="ph-bold ph-arrow-clockwise" aria-hidden="true"></i> Reintentar</button>
        </div>
      </div>`;
  }
}

sheetBody.addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]");
  if (go && !go.disabled) openSheet(Number(go.dataset.go));
});
$("#sheetClose").addEventListener("click", () => sheet.close());
sheet.addEventListener("click", (e) => {
  if (e.target === sheet) sheet.close();
});

document.addEventListener("keydown", (e) => {
  const typing = e.target.closest?.("input, select, textarea");
  if (sheet.open && !typing && sheetId) {
    if (e.key === "ArrowLeft" && sheetId > 1) openSheet(sheetId - 1);
    if (e.key === "ArrowRight" && sheetId < maxId()) openSheet(sheetId + 1);
    return;
  }
  if (e.key === "/" && !typing) {
    e.preventDefault();
    search.focus();
  }
});

/* Comparador */

const cmp = { a: null, b: null };
const fighterTokens = { a: 0, b: 0 };

function resolve(q) {
  const s = q.trim().toLowerCase().replace(/^#/, "");
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const id = Number(s);
    return state.byId.get(id) ?? (!state.all.length && id > 0 ? { id } : null);
  }
  return state.all.find((p) => p.name.toLowerCase() === s || p.slug === s.replace(/\s+/g, "-")) ?? null;
}

async function setFighter(side, id) {
  const el = $(`.fighter[data-side="${side}"]`);
  const err = $(".field-error", el);
  const input = $("input", el);
  const token = ++fighterTokens[side];
  el.classList.add("is-loading");
  try {
    const [p, s] = await Promise.all([getPokemon(id), getSpecies(id), preload(ART(id))]);
    if (token !== fighterTokens[side]) return;
    const types = typeNames(p);
    const name = speciesName(s);
    cmp[side] = { name, color: typeColor(types[0]), stats: Object.fromEntries(p.stats.map((x) => [x.stat.name, x.base_stat])) };
    el.style.setProperty("--c", cmp[side].color);
    const img = $(".fighter-art img", el);
    img.src = ART(id);
    img.alt = `Ilustración oficial de ${name}`;
    $(".fighter-name", el).textContent = name;
    $(".types", el).innerHTML = badges(types);
    input.value = name;
    input.setAttribute("aria-invalid", "false");
    err.hidden = true;
    renderVersus();
  } catch {
    if (token !== fighterTokens[side]) return;
    err.textContent = "No se pudo cargar. Inténtalo de nuevo.";
    err.hidden = false;
  } finally {
    if (token === fighterTokens[side]) el.classList.remove("is-loading");
  }
}

function renderVersus() {
  const { a, b } = cmp;
  if (!a || !b) return;
  const box = $("#vsStats");
  const sum = (o) => Object.values(o).reduce((x, y) => x + y, 0);
  const row = (label, va, vb, max, cls = "") => `
    <div class="vs-row ${cls}" role="group" aria-label="${label}: ${esc(a.name)} ${va}, ${esc(b.name)} ${vb}">
      <span class="v${va > vb ? " win" : ""}" aria-hidden="true">${va}</span>
      <span class="bar a${va < vb ? " lose" : ""}" style="--s:${Math.min(va / max, 1)}" aria-hidden="true"></span>
      <span class="lbl" aria-hidden="true">${label}</span>
      <span class="bar b${vb < va ? " lose" : ""}" style="--s:${Math.min(vb / max, 1)}" aria-hidden="true"></span>
      <span class="v${vb > va ? " win" : ""}" aria-hidden="true">${vb}</span>
    </div>`;

  box.style.setProperty("--ca", a.color);
  box.style.setProperty("--cb", b.color);
  box.classList.remove("is-ready");
  box.innerHTML =
    Object.entries(STATS).map(([k, label]) => row(label, a.stats[k], b.stats[k], STAT_MAX)).join("") +
    row("Total", sum(a.stats), sum(b.stats), TOTAL_MAX, "total");
  nextFrame().then(() => box.classList.add("is-ready"));
}

for (const side of ["a", "b"]) {
  const el = $(`.fighter[data-side="${side}"]`);
  const input = $("input", el);
  const err = $(".field-error", el);
  input.addEventListener("change", () => {
    const hit = resolve(input.value);
    input.setAttribute("aria-invalid", String(!hit));
    err.textContent = "No encontramos ese Pokémon.";
    err.hidden = Boolean(hit);
    if (hit) setFighter(side, hit.id);
  });
  input.addEventListener("focus", () => input.select());
}

/* Arranque */

renderChips();
showSkeleton();
setFeatured(FEATURED[Math.floor(Math.random() * FEATURED.length)]);
setFighter("a", 6);
setFighter("b", 9);

function boot() {
  loadIndex().then(applyFilters).catch(() => showError(boot));
}
boot();
