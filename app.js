/* ===========================================================
   Absensi English Club — app.js
   Data disimpan di localStorage (cache cepat + offline) dan
   disinkronkan ke Google Sheets lewat Apps Script Web App.
   =========================================================== */

const LS_KEYS = {
  sessions: "ec_absen_sessions",   // array of session objects (sudah tersinkron / lokal)
  pending:  "ec_absen_pending",    // array of session objects yang belum berhasil dikirim ke Sheets
  sheetsUrl:"ec_sheets_url",
};

let STATE = {
  sessions: [],      // [{id, tanggal, kegiatan, catatan, records:[{nama,status}], synced}]
  view: "recap",
};

// ---------- Utilities ----------
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function loadLocal(){
  try { return JSON.parse(localStorage.getItem(LS_KEYS.sessions)) || []; }
  catch(e){ return []; }
}
function saveLocal(sessions){
  localStorage.setItem(LS_KEYS.sessions, JSON.stringify(sessions));
}
function loadPending(){
  try { return JSON.parse(localStorage.getItem(LS_KEYS.pending)) || []; }
  catch(e){ return []; }
}
function savePending(list){
  localStorage.setItem(LS_KEYS.pending, JSON.stringify(list));
}
function getSheetsUrl(){
  return localStorage.getItem(LS_KEYS.sheetsUrl) || "";
}
function setSheetsUrl(url){
  localStorage.setItem(LS_KEYS.sheetsUrl, url.trim());
}

function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._tm);
  toast._tm = setTimeout(() => t.classList.remove("show"), 2600);
}

function fmtDate(iso){
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day:"numeric", month:"long", year:"numeric" });
}

// ---------- Sheets sync ----------
async function fetchFromSheets(){
  const url = getSheetsUrl();
  if (!url) { setSyncDot("off", "Belum terhubung ke Google Sheets — data hanya di browser ini."); return null; }
  setSyncDot("pending", "Menyinkronkan dari Google Sheets…");
  try{
    const res = await fetch(url + "?action=list", { method:"GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Gagal mengambil data");
    const sessions = rowsToSessions(json.data || []);
    setSyncDot("ok", "Tersambung ke Google Sheets · " + sessions.length + " kegiatan");
    return sessions;
  }catch(err){
    console.warn("Sync GET gagal:", err);
    setSyncDot("off", "Gagal konek ke Google Sheets — pakai data lokal dulu.");
    return null;
  }
}

function rowsToSessions(rows){
  const map = {};
  rows.forEach(r => {
    const key = r.Tanggal + "||" + r.Kegiatan;
    if (!map[key]) {
      map[key] = { id:key, tanggal:r.Tanggal, kegiatan:r.Kegiatan, catatan:r.Catatan || "", records:[], synced:true };
    }
    map[key].records.push({ nama:r.Nama, status:r.Status });
  });
  return Object.values(map).sort((a,b)=> a.tanggal < b.tanggal ? 1 : -1);
}

async function pushToSheets(session){
  const url = getSheetsUrl();
  if (!url) return false;
  try{
    const res = await fetch(url, {
      method:"POST",
      // text/plain menghindari CORS preflight yang tidak didukung Apps Script
      headers: { "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify({
        tanggal: session.tanggal,
        kegiatan: session.kegiatan,
        catatan: session.catatan,
        records: session.records,
      }),
    });
    const json = await res.json();
    return !!json.ok;
  }catch(err){
    console.warn("Sync POST gagal:", err);
    return false;
  }
}

async function flushPending(){
  const pending = loadPending();
  if (!pending.length || !getSheetsUrl()) return;
  const remaining = [];
  for (const s of pending){
    const ok = await pushToSheets(s);
    if (!ok) remaining.push(s);
  }
  savePending(remaining);
  if (remaining.length === 0 && pending.length > 0) toast("Semua absen tersimpan sudah tersinkron ke Google Sheets.");
}

function setSyncDot(kind, text){
  $("#syncDot").className = "sync-dot " + kind;
  $("#syncText").textContent = text;
}

// ---------- Data merge ----------
function mergeSessions(remote, local){
  if (!remote) return local;
  const byId = {};
  local.forEach(s => byId[s.tanggal + "||" + s.kegiatan] = s);
  remote.forEach(s => byId[s.id] = s); // remote is source of truth when available
  return Object.values(byId).sort((a,b)=> a.tanggal < b.tanggal ? 1 : -1);
}

// ---------- Init ----------
async function init(){
  STATE.sessions = loadLocal();
  renderAll();

  populateRoadmapSelect();
  populateMemberChecklist();

  const remote = await fetchFromSheets();
  if (remote){
    STATE.sessions = mergeSessions(remote, STATE.sessions);
    saveLocal(STATE.sessions);
    renderAll();
  }
  await flushPending();

  bindNav();
  bindFilters();
  bindForm();
  bindSettings();
}

function renderAll(){
  renderHero();
  renderRecap();
  renderStats();
  $("#footerCount").textContent = STATE.sessions.length + " kegiatan tercatat";
}

// ---------- Hero stats ----------
function renderHero(){
  const sessions = STATE.sessions;
  $("#statSesi").textContent = sessions.length;

  let totalHadir = 0, totalRecords = 0;
  sessions.forEach(s => s.records.forEach(r => {
    totalRecords++;
    if (r.status === "Hadir") totalHadir++;
  }));
  $("#statRata").textContent = totalRecords ? Math.round(totalHadir/totalRecords*100) + "%" : "0%";

  const latest = [...sessions].sort((a,b)=> a.tanggal < b.tanggal ? 1 : -1)[0];
  $("#statTerakhir").textContent = latest ? latest.kegiatan : "–";
}

// ---------- Recap view ----------
function renderRecap(){
  const search = ($("#filterSearch")?.value || "").toLowerCase();
  const from = $("#filterFrom")?.value;
  const to = $("#filterTo")?.value;

  let list = [...STATE.sessions].sort((a,b)=> a.tanggal < b.tanggal ? 1 : -1);
  list = list.filter(s => {
    if (search && !s.kegiatan.toLowerCase().includes(search)) return false;
    if (from && s.tanggal < from) return false;
    if (to && s.tanggal > to) return false;
    return true;
  });

  const container = $("#recapList");
  container.innerHTML = "";
  $("#recapEmpty").hidden = list.length > 0;

  list.forEach(s => {
    const hadir = s.records.filter(r => r.status === "Hadir").length;
    const total = s.records.length;

    const card = document.createElement("div");
    card.className = "recap-card";
    card.innerHTML = `
      <div class="recap-card__head">
        <div class="recap-card__title">
          <span class="recap-card__date">${fmtDate(s.tanggal)}</span>
          <span class="recap-card__name">${escapeHtml(s.kegiatan)}</span>
        </div>
        <div class="recap-card__meta">
          <span class="mini-ratio"><b>${hadir}</b>/${total} hadir</span>
          <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>
      <div class="recap-card__body">
        ${s.catatan ? `<p class="recap-card__note">${escapeHtml(s.catatan)}</p>` : ""}
        <div class="att-grid">
          ${s.records.map(r => `<span class="att-pill st-${r.status.toLowerCase()}"><span class="dot"></span>${escapeHtml(r.nama)}</span>`).join("")}
        </div>
      </div>
    `;
    card.querySelector(".recap-card__head").addEventListener("click", () => card.classList.toggle("is-open"));
    container.appendChild(card);
  });
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// ---------- Stats / ledger view ----------
function renderStats(){
  const sessions = [...STATE.sessions].sort((a,b)=> a.tanggal < b.tanggal ? -1 : 1);
  const container = $("#statsList");
  container.innerHTML = "";

  MEMBERS.forEach(m => {
    const dots = sessions.map(s => {
      const rec = s.records.find(r => r.nama === m.nama);
      const status = rec ? rec.status : null;
      const cls = status ? "st-" + status.toLowerCase() : "";
      const title = status ? `${s.kegiatan} (${fmtDate(s.tanggal)}) — ${status}` : `${s.kegiatan} — tidak tercatat`;
      return `<span class="ledger-dot ${cls}" title="${escapeHtml(title)}"></span>`;
    }).join("");

    const hadirCount = sessions.filter(s => {
      const rec = s.records.find(r => r.nama === m.nama);
      return rec && rec.status === "Hadir";
    }).length;
    const pct = sessions.length ? Math.round(hadirCount / sessions.length * 100) : 0;

    const row = document.createElement("div");
    row.className = "stat-row";
    row.innerHTML = `
      <div class="stat-row__id"><b>${escapeHtml(m.nama)}</b><span>${escapeHtml(m.kelas)} · ${escapeHtml(m.peran)}</span></div>
      <div class="ledger">${dots || '<span style="font-size:11px;color:var(--muted)">Belum ada data</span>'}</div>
      <div class="stat-row__pct">${pct}%</div>
    `;
    container.appendChild(row);
  });
}

// ---------- Roadmap select + member checklist (input form) ----------
function populateRoadmapSelect(){
  const sel = $("#fRoadmap");
  ROADMAP.forEach(ev => {
    const opt = document.createElement("option");
    opt.value = ev.tanggal;
    opt.textContent = `${fmtDate(ev.tanggal)} — ${ev.nama}`;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", () => {
    const ev = ROADMAP.find(e => e.tanggal === sel.value);
    if (ev){
      $("#fTanggal").value = ev.tanggal;
      $("#fNama").value = ev.nama;
      $("#fCatatan").value = ev.catatan;
    }
  });
}

function populateMemberChecklist(){
  const box = $("#memberChecklist");
  box.innerHTML = "";
  MEMBERS.forEach(m => {
    const row = document.createElement("div");
    row.className = "member-row";
    row.dataset.nama = m.nama;
    row.innerHTML = `
      <div class="member-row__id"><b>${escapeHtml(m.nama)}</b><span>${escapeHtml(m.kelas)}</span></div>
      <div class="status-group">
        ${STATUS_OPTIONS.map(o => `<button type="button" class="status-btn st-${o.key.toLowerCase()}${o.key==='Hadir' ? ' is-active':''}" data-status="${o.key}">${o.label}</button>`).join("")}
      </div>
    `;
    row.querySelectorAll(".status-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        row.querySelectorAll(".status-btn").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
      });
    });
    box.appendChild(row);
  });
}

// ---------- Nav / tabs ----------
function bindNav(){
  $$(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tab-btn").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const view = btn.dataset.view;
      $("#view-recap").hidden = view !== "recap";
      $("#view-input").hidden = view !== "input";
      $("#view-stats").hidden = view !== "stats";
    });
  });
}

// ---------- Filters ----------
function bindFilters(){
  ["filterSearch","filterFrom","filterTo"].forEach(id => {
    $("#"+id).addEventListener("input", renderRecap);
  });
  $("#filterReset").addEventListener("click", () => {
    $("#filterSearch").value = ""; $("#filterFrom").value = ""; $("#filterTo").value = "";
    renderRecap();
  });
}

// ---------- Form submit ----------
function bindForm(){
  const today = new Date().toISOString().slice(0,10);
  $("#fTanggal").value = today;

  $("#absenForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const tanggal = $("#fTanggal").value;
    const kegiatan = $("#fNama").value.trim();
    const catatan = $("#fCatatan").value.trim();
    if (!tanggal || !kegiatan) { toast("Tanggal & nama kegiatan wajib diisi."); return; }

    const records = $$(".member-row").map(row => ({
      nama: row.dataset.nama,
      status: row.querySelector(".status-btn.is-active")?.dataset.status || "Hadir",
    }));

    const session = { id: tanggal + "||" + kegiatan, tanggal, kegiatan, catatan, records, synced:false };

    // simpan lokal dulu (optimistic)
    STATE.sessions = STATE.sessions.filter(s => s.id !== session.id);
    STATE.sessions.push(session);
    saveLocal(STATE.sessions);
    renderAll();

    $("#formHint").textContent = "Menyimpan…";
    const ok = getSheetsUrl() ? await pushToSheets(session) : false;
    if (ok){
      session.synced = true;
      saveLocal(STATE.sessions);
      $("#formHint").textContent = "Tersimpan & tersinkron ke Google Sheets ✓";
      toast("Absen tersimpan dan tersinkron.");
    } else {
      const pending = loadPending();
      pending.push(session);
      savePending(pending);
      $("#formHint").textContent = getSheetsUrl()
        ? "Tersimpan lokal, akan disinkron otomatis saat koneksi tersedia."
        : "Tersimpan di browser ini saja (Google Sheets belum disambungkan).";
      toast("Absen tersimpan.");
    }

    e.target.reset();
    $("#fTanggal").value = today;
    populateMemberChecklist();
    setTimeout(() => $("#formHint").textContent = "", 4000);
  });
}

// ---------- Settings modal ----------
function bindSettings(){
  const backdrop = $("#modalBackdrop");
  $("#settingsBtn").addEventListener("click", () => {
    $("#sheetsUrlInput").value = getSheetsUrl();
    backdrop.hidden = false;
  });
  $("#modalClose").addEventListener("click", () => backdrop.hidden = true);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.hidden = true; });

  $("#modalSave").addEventListener("click", async () => {
    setSheetsUrl($("#sheetsUrlInput").value);
    backdrop.hidden = true;
    toast("Pengaturan disimpan. Menyinkronkan…");
    const remote = await fetchFromSheets();
    if (remote){
      STATE.sessions = mergeSessions(remote, STATE.sessions);
      saveLocal(STATE.sessions);
      renderAll();
    }
    await flushPending();
  });
}

document.addEventListener("DOMContentLoaded", init);
