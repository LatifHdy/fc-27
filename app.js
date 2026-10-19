const DATA_URL = "liga.json";
const ADMIN_PIN = "1203";

let league = null;
let filter = "pending";
let selectedPlayer = null;
let currentModalPlayer = null;
let nextSeasonTeams = [];

let pendingSaveMatch = null;
let editingMatchId = null;

let firebaseDb = null;
let isFirebaseLive = false;

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const initials = n => n.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();

async function boot(){
  initFirebase();
  initNavigatorTabs();
  initModalsAndEvents();
  checkSecretUrlTrigger();

  if(!league){
    try{
      const r = await fetch(DATA_URL + "?v=" + Date.now());
      league = await r.json();
    }catch(e){
      const saved = localStorage.getItem("fc27-liga");
      league = saved ? JSON.parse(saved) : {league:{name:"FC 27 Liga",teams:[]},matches:[]};
    }
  }

  if(league && Array.isArray(league.matches)){
    league.matches = organizeMatches(league.matches, false);
  }
  render();
}

function table(){
  if(!league || !league.league || !Array.isArray(league.league.teams)) return [];
  const rows = Object.fromEntries(league.league.teams.map(t=>[t,{name:t,mp:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0}]));
  (league.matches || []).forEach(m=>{
    if(!m.played) return;
    const h=rows[m.home], a=rows[m.away];
    if(!h||!a) return;
    h.mp++;a.mp++;h.gf+=+m.homeScore;h.ga+=+m.awayScore;a.gf+=+m.awayScore;a.ga+=+m.homeScore;
    if(m.homeScore>m.awayScore){h.w++;a.l++;h.pts+=3}
    else if(m.homeScore<m.awayScore){a.w++;h.l++;a.pts+=3}
    else{h.d++;a.d++;h.pts++;a.pts++}
  });
  return Object.values(rows).map(x=>({...x,gd:x.gf-x.ga})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name));
}

function shuffle(array){
  const a = [...array];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function isSwasMatch(m){
  const h = (m.home || "").toLowerCase().trim();
  const a = (m.away || "").toLowerCase().trim();
  return h === "swas" || a === "swas";
}

function organizeMatches(matches, doShuffle = false){
  const played = matches.filter(m => m.played);
  let unplayedOthers = matches.filter(m => !m.played && !isSwasMatch(m));
  let unplayedSwas = matches.filter(m => !m.played && isSwasMatch(m));

  if (doShuffle) {
    unplayedOthers = shuffle(unplayedOthers);
    unplayedSwas = shuffle(unplayedSwas);
  }

  return [...played, ...unplayedOthers, ...unplayedSwas];
}

function randomizeMatches(){
  league.matches = organizeMatches(league.matches, true);
  persist("Jadwal pertandingan yang belum main berhasil diacak (pertandingan swas diletakkan di akhir).");
}

/* ==========================================================================
   PAJAK.GO.ID SECTIONS NAVIGATOR TABS
   ========================================================================== */
function initNavigatorTabs(){
  const tabsContainer = $("#navigatorTabs");
  if(!tabsContainer) return;

  tabsContainer.addEventListener("click", e => {
    const tabBtn = e.target.closest(".nav-tab");
    if(!tabBtn) return;
    const target = tabBtn.dataset.tab;
    setActiveTab(target);
  });
}

function setActiveTab(tabName){
  $$(".nav-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });

  if(tabName === "all"){
    document.body.classList.add("show-all-tabs");
    $$(".tab-panel").forEach(p => p.classList.add("active"));
  } else {
    document.body.classList.remove("show-all-tabs");
    const panelMap = {
      standings: "#panelStandings",
      matches: "#panelMatches",
      history: "#panelHistory",
      alerts: "#panelAlerts"
    };
    $$(".tab-panel").forEach(p => p.classList.remove("active"));
    const targetPanel = $(panelMap[tabName]);
    if(targetPanel) {
      targetPanel.classList.add("active");
    }
  }
}

/* ==========================================================================
   PLAYER DETAILS & MODAL
   ========================================================================== */
function getPlayerDetails(playerName){
  const rows = table();
  const rankIndex = rows.findIndex(r => r.name.toLowerCase() === playerName.toLowerCase());
  const stats = rankIndex >= 0 ? rows[rankIndex] : { mp:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, pts:0 };
  const rankNumber = rankIndex >= 0 ? rankIndex + 1 : "-";

  const playedMatches = (league.matches || []).filter(m => m.played && (
    m.home.toLowerCase() === playerName.toLowerCase() ||
    m.away.toLowerCase() === playerName.toLowerCase()
  )).map(m => {
    const isHome = m.home.toLowerCase() === playerName.toLowerCase();
    const opponent = isHome ? m.away : m.home;
    const myScore = isHome ? m.homeScore : m.awayScore;
    const oppScore = isHome ? m.awayScore : m.homeScore;
    let result = "draw";
    if(myScore > oppScore) result = "win";
    else if(myScore < oppScore) result = "loss";
    return {
      id: m.id,
      opponent,
      isHome,
      myScore,
      oppScore,
      result,
      home: m.home,
      away: m.away,
      homeScore: m.homeScore,
      awayScore: m.awayScore
    };
  });

  const pendingMatches = (league.matches || []).filter(m => !m.played && (
    m.home.toLowerCase() === playerName.toLowerCase() ||
    m.away.toLowerCase() === playerName.toLowerCase()
  ));

  const pendingOpponents = pendingMatches.map(m => {
    const isHome = m.home.toLowerCase() === playerName.toLowerCase();
    return {
      opponent: isHome ? m.away : m.home,
      isHome,
      matchId: m.id
    };
  });

  return {
    name: playerName,
    rank: rankNumber,
    stats,
    playedMatches,
    pendingMatches,
    pendingOpponents
  };
}

function openPlayerModal(playerName){
  currentModalPlayer = playerName;
  const p = getPlayerDetails(playerName);

  $("#modalAvatar").textContent = initials(p.name);
  $("#modalRank").textContent = `POSISI ${String(p.rank).padStart(2, "0")}`;
  $("#modalPlayerName").textContent = p.name;

  $("#modalStats").innerHTML = `
    <div class="stat-box"><small>MAIN</small><span>${p.stats.mp}</span></div>
    <div class="stat-box"><small>MENANG</small><span>${p.stats.w}</span></div>
    <div class="stat-box"><small>SERI</small><span>${p.stats.d}</span></div>
    <div class="stat-box"><small>KALAH</small><span>${p.stats.l}</span></div>
    <div class="stat-box"><small>GM</small><span>${p.stats.gf}</span></div>
    <div class="stat-box"><small>GK</small><span>${p.stats.ga}</span></div>
    <div class="stat-box"><small>PTS</small><span>${p.stats.pts}</span></div>
  `;

  $("#modalPendingCount").textContent = `${p.pendingOpponents.length} Lawan`;
  if(p.pendingOpponents.length === 0){
    $("#modalPendingOpponents").innerHTML = `<div class="empty-notice">Semua pertandingan sudah selesai! 🎉</div>`;
    $("#modalHighlightBtn").style.display = "none";
  } else {
    $("#modalHighlightBtn").style.display = "flex";
    $("#modalPendingOpponents").innerHTML = p.pendingOpponents.map(o => `
      <div class="opponent-chip" data-goto-player="${esc(o.opponent)}" style="cursor:pointer" title="Klik untuk lihat profil lawan">
        <span class="vs-badge">${o.isHome ? "vs (K)" : "vs (T)"}</span>
        <strong>${esc(o.opponent)}</strong>
      </div>
    `).join("");
  }

  $("#modalPlayedCount").textContent = `${p.playedMatches.length} Selesai`;
  if(p.playedMatches.length === 0){
    $("#modalHistoryList").innerHTML = `<div class="empty-notice">Belum ada pertandingan yang selesai.</div>`;
  } else {
    $("#modalHistoryList").innerHTML = p.playedMatches.map(m => `
      <div class="history-card" data-match-id="${m.id}">
        <div class="history-teams">
          <span class="${m.isHome ? 'is-self' : ''}">${esc(m.home)}</span>
          <span class="history-score">${m.homeScore} - ${m.awayScore}</span>
          <span class="${!m.isHome ? 'is-self' : ''}">${esc(m.away)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="history-badge ${m.result}">
            ${m.result === 'win' ? 'MENANG' : m.result === 'loss' ? 'KALAH' : 'SERI'}
          </span>
          <button class="btn-edit-score" data-edit-match="${m.id}" title="Edit Skor (PIN 1203)">✏️ Edit</button>
        </div>
      </div>
    `).join("");
  }

  const modal = $("#playerModal");
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add("show"));
}

function closePlayerModal(){
  const modal = $("#playerModal");
  modal.classList.remove("show");
  setTimeout(() => {
    modal.hidden = true;
    currentModalPlayer = null;
  }, 200);
}

function setPlayerHighlight(playerName){
  if(selectedPlayer && selectedPlayer.toLowerCase() === playerName.toLowerCase()){
    selectedPlayer = null;
  } else {
    selectedPlayer = playerName;
  }
  renderMatches();
  renderStandings();

  if(selectedPlayer){
    setActiveTab("matches");
    const matchesSection = $(".matches-card");
    if(matchesSection) {
      matchesSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

/* ==========================================================================
   NOTIFICATIONS / LEAGUE ALERTS
   ========================================================================== */
function getLeagueNotifications(){
  const rows = table();
  const notes = [];
  if(!rows.length) return notes;

  const first = rows[0];
  const last = rows[rows.length-1];

  notes.push({
    type:"king",
    title:"THRONE KING",
    text:`${first.name} sedang memimpin klasemen sebagai peringkat 1.`
  });

  if(first.name.toLowerCase() === "teguh"){
    notes.push({
      type:"teguh",
      title:"SUDAH BIASA",
      text:"Teguh kembali duduk di nomor 1. Konsistensi tinggi!"
    });
  }

  if(rows.length >= 5){
    const zone = rows.slice(0,5).map(x=>x.name).join(", ");
    notes.push({
      type:"zonkou",
      title:"TOP 5 KLASEMEN",
      text:`5 besar persaingan juara saat ini: ${zone}.`
    });
  }

  if(last && last.name){
    notes.push({
      type:"danger",
      title:"ZONA BAWAH",
      text:`${last.name} saat ini berada di peringkat ${rows.length}. Masih ada peluang untuk bangkit!`
    });
  }
  return notes;
}

function renderNotifications(){
  const notes = getLeagueNotifications();
  $("#notifications").innerHTML = `
    <div class="notice-head">
      <div><div class="eyebrow dark">LEAGUE ALERTS</div><h3>Notifikasi & Info Liga</h3></div>
      <span>${notes.length} info</span>
    </div>
    <div class="notice-grid">
      ${notes.map(n=>`
        <div class="notice ${n.type}">
          <div class="notice-icon">${n.type==="king"?"♛":n.type==="zonkou"?"⚡":n.type==="danger"?"↓":"★"}</div>
          <div><b>${esc(n.title)}</b><p>${esc(n.text)}</p></div>
        </div>`).join("")}
    </div>`;
}

/* ==========================================================================
   CORE RENDER
   ========================================================================== */
function render(){
  const teamCount = league?.league?.teams?.length || 0;
  const matchCount = league?.matches?.length || 0;
  const seasonName = league?.league?.season || "SEASON 01";
  const playedCount = (league?.matches || []).filter(m => m.played).length;
  const pendingCount = (league?.matches || []).filter(m => !m.played).length;
  const notesCount = getLeagueNotifications().length;

  if($("#heroSeasonBadge")) $("#heroSeasonBadge").textContent = `FC 27 • ${seasonName}`.toUpperCase();
  if($("#leagueSummaryTitle")) $("#leagueSummaryTitle").innerHTML = `${teamCount} pemain.<br><strong>1 juara.</strong>`;
  if($("#totalMatchesStat")) $("#totalMatchesStat").textContent = matchCount;
  if($("#totalTeamsStat")) $("#totalTeamsStat").textContent = teamCount;

  // Update Pajak.go.id Navigator Tabs Badges
  if($("#tabTeamCountBadge")) $("#tabTeamCountBadge").textContent = `${teamCount} Tim`;
  if($("#tabPendingCountBadge")) $("#tabPendingCountBadge").textContent = `${pendingCount} Sisa`;
  if($("#tabPlayedCountBadge")) $("#tabPlayedCountBadge").textContent = `${playedCount} Selesai`;
  if($("#tabAlertBadge")) $("#tabAlertBadge").textContent = `${notesCount} Info`;

  renderStandings();
  renderLeaders();
  renderMatches();
  renderHistory();
  renderNotifications();
  renderSeasonBanner();
}

function renderStandings(){
  const rows = table();
  $("#standings").innerHTML = rows.map((x,i)=>{
    const isSelected = selectedPlayer && selectedPlayer.toLowerCase() === x.name.toLowerCase();
    return `
      <tr class="${isSelected ? 'active-row' : ''}" data-player="${esc(x.name)}" title="Klik untuk melihat riwayat dan sisa lawan">
        <td class="pos ${i===0?'top1':''}">${String(i+1).padStart(2,"0")}</td>
        <td>
          <div class="team-cell">
            <span class="team-badge">${esc(initials(x.name))}</span>
            <strong>
              ${esc(x.name)}
              <span class="view-tag">🔍 RIWAYAT</span>
            </strong>
          </div>
        </td>
        <td>${x.mp}</td><td>${x.w}</td><td>${x.d}</td><td>${x.l}</td>
        <td>${x.gf}</td><td>${x.ga}</td><td class="diff ${x.gd>0?'pos':x.gd<0?'neg':''}">${x.gd>0?"+":""}${x.gd}</td>
        <td class="pts">${x.pts}</td>
      </tr>`;
  }).join("");
}

function renderLeaders(){
  const rows = table();
  const top = rows.slice(0,3);
  const order = [top[1],top[0],top[2]].filter(Boolean);
  $("#leaders").innerHTML = `
    <div class="leaders-title"><h3>TOP OF THE TABLE</h3><span>${top[0]?.pts||0} POINTS LEADER</span></div>
    <div class="podium">${order.map((x,i)=>x?`
      <div class="pod ${i===1?'first':''}" data-player="${esc(x.name)}" title="Klik untuk melihat riwayat dan sisa lawan">
        <div class="rank">${i===1?'01':i===0?'02':'03'}</div>
        <div class="avatar">${esc(initials(x.name))}</div>
        <b>${esc(x.name)}</b><small>${x.mp} match</small><div class="pts">${x.pts} pts</div>
      </div>`:"").join("")}</div>`;
}

function renderMatches(){
  const banner = $("#highlightBanner");
  if(selectedPlayer){
    const pendingMatchesOfPlayer = (league.matches || []).filter(m => !m.played && (
      m.home.toLowerCase() === selectedPlayer.toLowerCase() ||
      m.away.toLowerCase() === selectedPlayer.toLowerCase()
    ));
    banner.style.display = "flex";
    banner.innerHTML = `
      <div class="highlight-banner-text">
        <span>🎯 Menampilkan sisa jadwal:</span>
        <strong>${esc(selectedPlayer)}</strong>
        <span>(${pendingMatchesOfPlayer.length} lawan tersisa)</span>
      </div>
      <button class="clear-btn" id="clearHighlightBtn">✕ Tampilkan Semua</button>
    `;
    const clearBtn = $("#clearHighlightBtn");
    if(clearBtn) clearBtn.onclick = () => setPlayerHighlight(selectedPlayer);
  } else {
    banner.style.display = "none";
    banner.innerHTML = "";
  }

  const ordered = organizeMatches(league.matches || [], false);
  let list = ordered.filter(m => !m.played);

  if(filter === "others"){
    list = list.filter(m => !isSwasMatch(m));
  } else if(filter === "swas"){
    list = list.filter(m => isSwasMatch(m));
  }

  if(list.length === 0){
    const allDone = isSeasonFinished();
    $("#matches").innerHTML = `
      <div class="empty-notice" style="grid-column:1/-1;padding:35px 20px;background:#fff;border-radius:14px;border:1px dashed var(--line);font-size:13px;text-align:center">
        ${allDone ? `
          <div style="font-size:32px;margin-bottom:8px">🎉 🏆 🎉</div>
          <strong style="display:block;font-size:16px;color:var(--navy);margin-bottom:6px">Semua Pertandingan Musim Ini Telah Selesai!</strong>
          <p style="margin:0 0 16px;color:var(--muted);font-size:12px">Seluruh jadwal telah dimainkan. Anda dapat memulai musim berikutnya untuk mengacak jadwal dan mereset skor.</p>
          <button class="btn accent" id="emptyNoticeNextSeasonBtn" style="padding:11px 20px;font-weight:800;font-size:12px">⚡ Mulai Season Berikutnya</button>
        ` : `
          Semua pertandingan pada filter ini sudah selesai dimainkan! Cek tab "Riwayat Hasil" untuk melihat skor atau mengoreksi.
        `}
      </div>`;
    const emptyBtn = $("#emptyNoticeNextSeasonBtn");
    if(emptyBtn) emptyBtn.addEventListener("click", openNextSeasonModal);
    return;
  }

  $("#matches").innerHTML = list.map(m => {
    const isPlayerMatch = selectedPlayer && (
      m.home.toLowerCase() === selectedPlayer.toLowerCase() ||
      m.away.toLowerCase() === selectedPlayer.toLowerCase()
    );
    const isHighlighted = isPlayerMatch;
    const isDimmed = selectedPlayer && !isPlayerMatch;

    return `
      <div class="match ${isHighlighted ? 'is-highlighted' : ''} ${isDimmed ? 'is-dimmed' : ''} ${isSwasMatch(m) ? 'pending-swas' : ''}">
        <div class="side ${selectedPlayer && m.home.toLowerCase() === selectedPlayer.toLowerCase() ? 'highlight-player' : ''}">${esc(m.home)}</div>
        <div class="scorebox">
          <div class="scoreline">
            <input class="score" inputmode="numeric" min="0" type="number" value="" placeholder="–" data-id="${m.id}" data-side="home">
            <span class="dash">-</span>
            <input class="score" inputmode="numeric" min="0" type="number" value="" placeholder="–" data-id="${m.id}" data-side="away">
          </div>
          <div class="vs">VS</div>
        </div>
        <div class="side away ${selectedPlayer && m.away.toLowerCase() === selectedPlayer.toLowerCase() ? 'highlight-player' : ''}">${esc(m.away)}</div>
        <button class="save-score" data-save="${m.id}">SIMPAN HASIL</button>
      </div>`;
  }).join("");
}

/* ==========================================================================
   RIWAYAT PERTANDINGAN SELESAI (PANEL 3)
   ========================================================================== */
function renderHistory(){
  const playedMatches = (league?.matches || []).filter(m => m.played);
  const countEl = $("#historySectionCount");
  if(countEl) countEl.textContent = `${playedMatches.length} Pertandingan Selesai`;

  const grid = $("#historyGrid");
  if(!grid) return;

  if(playedMatches.length === 0){
    grid.innerHTML = `
      <div class="empty-notice" style="grid-column:1/-1;padding:32px 20px;background:#f8fafc;border-radius:16px;border:1.5px dashed var(--line);text-align:center">
        Belum ada pertandingan yang selesai dimainkan. Masukkan skor di tab "Jadwal Tanding".
      </div>`;
    return;
  }

  grid.innerHTML = playedMatches.map(m => {
    const homeWin = m.homeScore > m.awayScore;
    const awayWin = m.awayScore > m.homeScore;
    return `
      <div class="history-match-item" data-match-id="${m.id}">
        <div class="history-item-top">
          <span class="history-item-tag played">SELESAI</span>
          <button class="btn-edit-score" data-edit-match="${m.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" fill="#fde047" stroke="#d97706" stroke-width="2"/>
            </svg>
            Edit Skor
          </button>
        </div>
        <div class="history-item-matchup">
          <div class="history-side">
            <span class="history-team-avatar">${esc(initials(m.home))}</span>
            <span class="history-team-name">${esc(m.home)}</span>
          </div>
          <div class="history-score-display">
            <span class="history-score-val ${homeWin ? 'winner' : ''}">${m.homeScore}</span>
            <span class="history-score-sep">-</span>
            <span class="history-score-val ${awayWin ? 'winner' : ''}">${m.awayScore}</span>
          </div>
          <div class="history-side away-side">
            <span class="history-team-name">${esc(m.away)}</span>
            <span class="history-team-avatar">${esc(initials(m.away))}</span>
          </div>
        </div>
      </div>`;
  }).join("");
}

/* ==========================================================================
   PIN VERIFICATION FOR SAVING MATCH SCORES (PIN 1203)
   ========================================================================== */
function promptPinForSave(id){
  const saveBtn = document.querySelector(`[data-save="${id}"]`);
  if(!saveBtn) return;
  const card = saveBtn.parentElement;
  const inputs = card.querySelectorAll(".score");
  const hs = inputs[0].value.trim(), as = inputs[1].value.trim();

  if(hs === "" || as === "" || +hs < 0 || +as < 0){
    alert("Masukkan skor kandang dan tandang terlebih dahulu.");
    return;
  }

  const m = league.matches.find(x => x.id === +id);
  if(!m) return;

  pendingSaveMatch = { id: +id, hs: +hs, as: +as };

  const desc = $("#pinModalDescription");
  if(desc){
    desc.textContent = `Simpan hasil ${m.home} (${hs}) vs (${as}) ${m.away}. Masukkan PIN Admin (1203).`;
  }

  $("#pinInputBox").value = "";
  $("#pinErrorMsg").style.display = "none";

  const modal = $("#pinModal");
  modal.hidden = false;
  requestAnimationFrame(() => {
    modal.classList.add("show");
    $("#pinInputBox").focus();
  });
}

function submitPinForSave(){
  const pin = $("#pinInputBox").value.trim();
  const errBox = $("#pinErrorMsg");

  if(pin !== ADMIN_PIN){
    errBox.style.display = "block";
    errBox.textContent = "PIN salah! Gunakan PIN 1203.";
    $("#pinInputBox").classList.add("shake");
    setTimeout(() => $("#pinInputBox").classList.remove("shake"), 400);
    $("#pinInputBox").focus();
    return;
  }

  if(pendingSaveMatch){
    const m = league.matches.find(x => x.id === pendingSaveMatch.id);
    if(m){
      m.homeScore = pendingSaveMatch.hs;
      m.awayScore = pendingSaveMatch.as;
      m.played = true;
      closePinModal();
      persist(`Hasil ${m.home} ${m.homeScore} - ${m.awayScore} ${m.away} berhasil disimpan!`);
    }
  }
}

function closePinModal(){
  const modal = $("#pinModal");
  modal.classList.remove("show");
  setTimeout(() => {
    modal.hidden = true;
    pendingSaveMatch = null;
  }, 200);
}

/* ==========================================================================
   EDIT SCORE MODAL (PIN 1203)
   ========================================================================== */
function openEditScoreModal(matchId){
  const m = (league?.matches || []).find(x => x.id === +matchId);
  if(!m) return;

  editingMatchId = +matchId;
  $("#editHomeTeam").textContent = m.home;
  $("#editHomeAvatar").textContent = initials(m.home);
  $("#editHomeScore").value = m.homeScore;
  $("#editAwayScore").value = m.awayScore;
  $("#editAwayTeam").textContent = m.away;
  $("#editAwayAvatar").textContent = initials(m.away);

  $("#editScorePin").value = "";
  $("#editScoreError").style.display = "none";

  const modal = $("#editScoreModal");
  modal.hidden = false;
  requestAnimationFrame(() => {
    modal.classList.add("show");
    $("#editHomeScore").focus();
  });
}

function closeEditScoreModal(){
  const modal = $("#editScoreModal");
  modal.classList.remove("show");
  setTimeout(() => {
    modal.hidden = true;
    editingMatchId = null;
  }, 200);
}

function saveEditedScore(){
  if(!editingMatchId) return;
  const hs = $("#editHomeScore").value.trim();
  const as = $("#editAwayScore").value.trim();
  const pin = $("#editScorePin").value.trim();
  const errBox = $("#editScoreError");

  if(hs === "" || as === "" || +hs < 0 || +as < 0){
    alert("Masukkan skor kandang dan tandang yang valid.");
    return;
  }

  if(pin !== ADMIN_PIN){
    errBox.style.display = "block";
    errBox.textContent = "PIN salah! Gunakan PIN 1203.";
    $("#editScorePin").classList.add("shake");
    setTimeout(() => $("#editScorePin").classList.remove("shake"), 400);
    $("#editScorePin").focus();
    return;
  }

  const m = (league.matches || []).find(x => x.id === editingMatchId);
  if(m){
    m.homeScore = +hs;
    m.awayScore = +as;
    m.played = true;
    closeEditScoreModal();
    persist(`Skor ${m.home} vs ${m.away} berhasil diperbarui menjadi ${hs} - ${as}!`);
    if(currentModalPlayer){
      openPlayerModal(currentModalPlayer);
    }
  }
}

/* ==========================================================================
   PERSISTENCE & FIREBASE REALTIME DATABASE
   ========================================================================== */
async function persist(message="Hasil pertandingan tersimpan."){
  localStorage.setItem("fc27-liga", JSON.stringify(league));
  render();

  if(firebaseDb){
    try {
      await firebaseDb.ref("liga").set(league);
      toast(message + " (🔥 Tersimpan Realtime di Firebase!)");
      return;
    } catch(err){
      console.warn("Gagal simpan ke Firebase:", err);
      toast(message + ` (⚠️ Gagal simpan ke Firebase: ${err.message})`);
      return;
    }
  }

  toast(message);
}

function toast(msg){
  let t = document.querySelector(".toast");
  if(!t){
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

function downloadJSON(){
  const blob = new Blob([JSON.stringify(league, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "liga.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ==========================================================================
   SEASON COMPLETION & NEXT SEASON LOGIC
   ========================================================================== */
function isSeasonFinished(){
  return league && Array.isArray(league.matches) && league.matches.length > 0 && league.matches.every(m => m.played);
}

function renderSeasonBanner(){
  const banner = $("#seasonBanner");
  const headerBtn = $("#headerNextSeasonBtn");
  const finished = isSeasonFinished();

  if(headerBtn){
    headerBtn.style.display = finished ? "inline-flex" : "none";
  }

  if(!banner) return;
  if(!finished){
    banner.style.display = "none";
    banner.innerHTML = "";
    return;
  }

  const rows = table();
  const champion = rows[0] || { name: "-", pts: 0, gd: 0 };
  const seasonName = league.league?.season || "Musim Ini";

  banner.style.display = "block";
  banner.innerHTML = `
    <div class="champion-banner">
      <div class="champion-banner-left">
        <div class="trophy-badge">🏆</div>
        <div class="champion-text">
          <div class="eyebrow">${esc(seasonName).toUpperCase()} TELAH SELESAI</div>
          <h2>JUARA LIGA: <span>${esc(champion.name)}</span></h2>
          <p>Selamat kepada <strong>${esc(champion.name)}</strong> yang berhasil menjadi juara dengan <strong>${champion.pts} poin</strong> (SG ${champion.gd > 0 ? "+" : ""}${champion.gd}). Semua pertandingan tuntas!</p>
        </div>
      </div>
      <div class="champion-banner-actions">
        <button class="btn-next-season-hero" id="bannerNextSeasonBtn">⚡ Mulai Next Season</button>
      </div>
    </div>
  `;

  const bBtn = $("#bannerNextSeasonBtn");
  if(bBtn) bBtn.addEventListener("click", openNextSeasonModal);
}

function getNextSeasonName(currentName = "Season 1"){
  const match = currentName.match(/\d+/);
  if(match){
    const num = parseInt(match[0], 10) + 1;
    return currentName.replace(/\d+/, num);
  }
  return currentName + " (Baru)";
}

function generateRoundRobin(teams){
  const matches = [];
  let id = 1;
  const n = teams.length;
  for(let i = 0; i < n; i++){
    for(let j = i + 1; j < n; j++){
      const isAlt = (i + j) % 2 === 1;
      matches.push({
        id: id++,
        home: isAlt ? teams[i] : teams[j],
        away: isAlt ? teams[j] : teams[i],
        homeScore: 0,
        awayScore: 0,
        played: false
      });
    }
  }
  return organizeMatches(matches, false);
}

function openNextSeasonModal(){
  const rows = table();
  const seasonName = league.league?.season || "Season 1";
  const nextName = getNextSeasonName(seasonName);
  nextSeasonTeams = [...(league.league?.teams || [])];

  $("#modalSeasonCompletedName").textContent = `${seasonName} Selesai (${league.matches.length} Pertandingan)`;
  $("#nextSeasonInput").value = nextName;

  const cRow = $("#championSummaryRow");
  if(rows.length > 0){
    const c1 = rows[0];
    const c2 = rows[1];
    const c3 = rows[2];
    cRow.innerHTML = `
      <div class="champ-card winner">
        <div class="badge">👑</div>
        <div class="champ-info">
          <b>JUARA 1: ${esc(c1.name)}</b>
          <small>${c1.pts} PTS &bull; ${c1.w}M ${c1.d}S ${c1.l}K &bull; SG ${c1.gd > 0 ? "+" : ""}${c1.gd}</small>
        </div>
      </div>
      ${c2 ? `
        <div class="champ-card runner-up">
          <div class="badge">🥈</div>
          <div class="champ-info">
            <b>RUNNER-UP: ${esc(c2.name)}</b>
            <small>${c2.pts} PTS &bull; SG ${c2.gd > 0 ? "+" : ""}${c2.gd}</small>
          </div>
        </div>
      ` : ""}
      ${c3 ? `
        <div class="champ-card third-place">
          <div class="badge">🥉</div>
          <div class="champ-info">
            <b>PERINGKAT 3: ${esc(c3.name)}</b>
            <small>${c3.pts} PTS &bull; SG ${c3.gd > 0 ? "+" : ""}${c3.gd}</small>
          </div>
        </div>
      ` : ""}
    `;
  }

  renderNewSeasonTeams();

  const modal = $("#nextSeasonModal");
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add("show"));
}

function renderNewSeasonTeams(){
  const container = $("#newSeasonTeamsList");
  const countEl = $("#newSeasonTeamCount");
  const matchCountEl = $("#newSeasonMatchCount");
  const n = nextSeasonTeams.length;
  const matchCount = Math.floor(n * (n - 1) / 2);

  if(countEl) countEl.textContent = n;
  if(matchCountEl) matchCountEl.textContent = matchCount;

  container.innerHTML = nextSeasonTeams.map((t, idx) => `
    <span class="team-chip-editable">
      ${esc(t)}
      <button class="btn-remove-team" data-remove-index="${idx}" title="Hapus pemain">&times;</button>
    </span>
  `).join("");
}

function closeNextSeasonModal(){
  const modal = $("#nextSeasonModal");
  modal.classList.remove("show");
  setTimeout(() => { modal.hidden = true; }, 200);
}

function backupSeasonJson(){
  const seasonTag = (league.league?.season || "season").toLowerCase().replace(/[^a-z0-9]/g, "-");
  const filename = `liga-${seasonTag}-final.json`;
  const blob = new Blob([JSON.stringify(league, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`Backup ${filename} berhasil diunduh.`);
}

function addTeamToNewSeason(){
  const input = $("#newTeamInput");
  const name = input.value.trim();
  if(!name) return;
  if(nextSeasonTeams.some(t => t.toLowerCase() === name.toLowerCase())){
    alert(`Pemain "${name}" sudah ada dalam daftar.`);
    return;
  }
  nextSeasonTeams.push(name);
  input.value = "";
  renderNewSeasonTeams();
}

async function executeNextSeason(){
  const seasonName = $("#nextSeasonInput").value.trim();
  if(!seasonName){
    alert("Harap masukkan nama musim baru (misal: Season 2).");
    return;
  }
  if(nextSeasonTeams.length < 2){
    alert("Minimal butuh 2 pemain untuk membuat liga.");
    return;
  }

  const matchCount = Math.floor(nextSeasonTeams.length * (nextSeasonTeams.length - 1) / 2);
  const confirmMsg = `Mulai ${seasonName} dengan ${nextSeasonTeams.length} pemain (${matchCount} pertandingan)? Jadwal baru akan dibuat dan skor di-reset.`;
  if(!confirm(confirmMsg)) return;

  const newMatches = generateRoundRobin(nextSeasonTeams);
  const newLeague = {
    league: {
      name: league.league?.name || "FC 27 Liga",
      season: seasonName,
      format: "Single Round Robin",
      teams: [...nextSeasonTeams],
      points: league.league?.points || { win: 3, draw: 1, loss: 0 }
    },
    matches: newMatches
  };

  league = newLeague;
  closeNextSeasonModal();

  downloadJSON();
  persist(`Selamat! ${seasonName} berhasil dibuat dengan ${newMatches.length} jadwal pertandingan.`);
}

/* ==========================================================================
   EVENT INITIALIZATION & HANDLERS
   ========================================================================== */
function initModalsAndEvents(){
  // Standings click -> Open Player Profile Modal
  $("#standings").addEventListener("click", e => {
    const tr = e.target.closest("tr");
    if(tr && tr.dataset.player) openPlayerModal(tr.dataset.player);
  });

  // Leaders Podium click -> Open Player Profile Modal
  $("#leaders").addEventListener("click", e => {
    const pod = e.target.closest(".pod");
    if(pod && pod.dataset.player) openPlayerModal(pod.dataset.player);
  });

  // Player Modal: Go to opponent profile
  $("#modalPendingOpponents").addEventListener("click", e => {
    const chip = e.target.closest("[data-goto-player]");
    if(chip && chip.dataset.gotoPlayer) openPlayerModal(chip.dataset.gotoPlayer);
  });

  // Player Modal: Edit Score in History List
  $("#modalHistoryList").addEventListener("click", e => {
    const editBtn = e.target.closest("[data-edit-match]");
    if(editBtn && editBtn.dataset.editMatch){
      e.stopPropagation();
      openEditScoreModal(editBtn.dataset.editMatch);
      return;
    }
    const card = e.target.closest("[data-match-id]");
    if(card && card.dataset.matchId){
      openEditScoreModal(card.dataset.matchId);
    }
  });

  // Player Modal Close
  $("#modalCloseBtn").addEventListener("click", closePlayerModal);
  $("#playerModal").addEventListener("click", e => {
    if(e.target === $("#playerModal")) closePlayerModal();
  });

  // Match Center: Click SIMPAN HASIL -> Prompt PIN 1203
  $("#matches").addEventListener("click", e => {
    const id = e.target.dataset.save;
    if(id) promptPinForSave(id);
  });

  // Match Filter Buttons
  $$(".filter[data-filter]").forEach(b => b.addEventListener("click", () => {
    $$(".filter[data-filter]").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    filter = b.dataset.filter;
    renderMatches();
  }));

  // Riwayat Section (Panel 3): Click Edit Score
  $("#historyGrid").addEventListener("click", e => {
    const editBtn = e.target.closest("[data-edit-match]");
    if(editBtn && editBtn.dataset.editMatch){
      e.stopPropagation();
      openEditScoreModal(editBtn.dataset.editMatch);
      return;
    }
    const item = e.target.closest("[data-match-id]");
    if(item && item.dataset.matchId){
      openEditScoreModal(item.dataset.matchId);
    }
  });

  // PIN Admin Modal Events
  $("#submitPinBtn").addEventListener("click", submitPinForSave);
  $("#cancelPinBtn").addEventListener("click", closePinModal);
  $("#pinInputBox").addEventListener("keydown", e => {
    if(e.key === "Enter"){
      e.preventDefault();
      submitPinForSave();
    }
  });
  $("#pinModal").addEventListener("click", e => {
    if(e.target === $("#pinModal")) closePinModal();
  });

  // Edit Score Modal Events
  $("#saveEditedScoreBtn").addEventListener("click", saveEditedScore);
  $("#cancelEditScoreBtn").addEventListener("click", closeEditScoreModal);
  $("#closeEditScoreBtn").addEventListener("click", closeEditScoreModal);
  $("#editScorePin").addEventListener("keydown", e => {
    if(e.key === "Enter"){
      e.preventDefault();
      saveEditedScore();
    }
  });
  $("#editScoreModal").addEventListener("click", e => {
    if(e.target === $("#editScoreModal")) closeEditScoreModal();
  });

  // Next Season Modal Events
  const headerNextBtn = $("#headerNextSeasonBtn");
  if(headerNextBtn) headerNextBtn.addEventListener("click", openNextSeasonModal);
  $("#closeNextSeasonBtn").addEventListener("click", closeNextSeasonModal);
  $("#cancelNextSeasonBtn").addEventListener("click", closeNextSeasonModal);
  $("#nextSeasonModal").addEventListener("click", e => {
    if(e.target === $("#nextSeasonModal")) closeNextSeasonModal();
  });
  $("#backupCurrentSeasonBtn").addEventListener("click", backupSeasonJson);
  $("#addTeamBtn").addEventListener("click", addTeamToNewSeason);
  $("#newTeamInput").addEventListener("keydown", e => {
    if(e.key === "Enter"){
      e.preventDefault();
      addTeamToNewSeason();
    }
  });
  $("#newSeasonTeamsList").addEventListener("click", e => {
    const btn = e.target.closest(".btn-remove-team");
    if(btn && btn.dataset.removeIndex !== undefined){
      const idx = parseInt(btn.dataset.removeIndex, 10);
      nextSeasonTeams.splice(idx, 1);
      renderNewSeasonTeams();
    }
  });
  $("#confirmNextSeasonBtn").addEventListener("click", executeNextSeason);

  // Randomize events
  $("#randomBtn").addEventListener("click", randomizeMatches);

  // Modal Highlight button
  $("#modalHighlightBtn").addEventListener("click", () => {
    if(currentModalPlayer) {
      const p = currentModalPlayer;
      closePlayerModal();
      setPlayerHighlight(p);
    }
  });

  // Firebase modal events
  $("#firebaseBtn").addEventListener("click", openFirebaseModal);
  $("#closeFirebaseBtn").addEventListener("click", closeFirebaseModal);
  const closeFbBottomBtn = $("#closeFirebaseModalBottomBtn");
  if(closeFbBottomBtn) closeFbBottomBtn.addEventListener("click", closeFirebaseModal);
  $("#firebaseModal").addEventListener("click", e => {
    if(e.target === $("#firebaseModal")) closeFirebaseModal();
  });
  const uploadBtn = $("#uploadToFirebaseBtn");
  if(uploadBtn) uploadBtn.addEventListener("click", uploadToFirebase);

  // Global ESC Key Handler
  document.addEventListener("keydown", e => {
    if(e.key === "Escape"){
      if(!$("#pinModal").hidden) closePinModal();
      if(!$("#editScoreModal").hidden) closeEditScoreModal();
      if(!$("#playerModal").hidden) closePlayerModal();
      if(!$("#nextSeasonModal").hidden) closeNextSeasonModal();
      if(!$("#firebaseModal").hidden) closeFirebaseModal();
    }
  });
}

/* ==========================================================================
   FIREBASE REALTIME DATABASE INITIALIZATION & SYNC
   ========================================================================== */
function initFirebase(){
  if(typeof firebase === "undefined"){
    updateFirebaseUI(false, "SDK Firebase tidak termuat");
    return;
  }

  if(typeof firebaseConfig === "undefined" || !firebaseConfig.apiKey || !firebaseConfig.databaseURL){
    updateFirebaseUI(false, "Konfigurasi di firebase-config.js belum diisi");
    return;
  }

  try {
    if(!firebase.apps.length){
      firebase.initializeApp(firebaseConfig);
    }
    firebaseDb = firebase.database();

    firebaseDb.ref("liga").on("value", snapshot => {
      const data = snapshot.val();
      if(data && data.matches && data.league){
        isFirebaseLive = true;
        league = data;
        if(Array.isArray(league.matches)){
          league.matches = organizeMatches(league.matches, false);
        }
        localStorage.setItem("fc27-liga", JSON.stringify(league));
        render();
        updateFirebaseUI(true, "🟢 Terhubung Realtime ke Firebase Cloud");
      } else {
        isFirebaseLive = true;
        updateFirebaseUI(true, "🟡 Terhubung (Database Firebase masih kosong)");
      }
    }, err => {
      console.warn("Firebase listen error:", err);
      updateFirebaseUI(false, `Error izin Firebase: ${err.message}`);
    });
  } catch(e){
    console.error("Firebase init error:", e);
    updateFirebaseUI(false, `Inisialisasi gagal: ${e.message}`);
  }
}

function updateFirebaseUI(connected, message = ""){
  const dot = $("#firebaseSyncDot");
  const label = $("#firebaseSyncLabel");
  const badge = $("#firebaseConnectionBadge");

  if(dot){
    dot.className = connected ? "sync-dot connected" : "sync-dot";
  }
  if(label){
    label.textContent = connected ? "🔥 Live Firebase" : "🔥 Firebase";
  }
  if(badge){
    badge.className = connected ? "sync-status-box success" : "sync-status-box error";
    badge.textContent = connected ? (message || "✅ Terhubung Realtime ke Firebase") : (message || "⚠️ Belum Terhubung");
  }
}

function openFirebaseModal(){
  const modal = $("#firebaseModal");
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add("show"));
}

function closeFirebaseModal(){
  const modal = $("#firebaseModal");
  modal.classList.remove("show");
  setTimeout(() => { modal.hidden = true; }, 200);
}

/* ==========================================================================
   SECRET ADMIN FIREBASE UPLOAD (Hanya Lewat URL Khusus)
   ========================================================================== */
function checkSecretUrlTrigger(){
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const secretKey = urlParams.get("upload") || urlParams.get("upload_firebase") || urlParams.get("admin_upload");
    
    if(secretKey === ADMIN_PIN){
      // Bersihkan parameter dari URL address bar agar tetap rahasia
      const cleanUrl = window.location.pathname + (window.location.hash || "");
      window.history.replaceState({}, document.title, cleanUrl);
      
      setTimeout(() => {
        executeSecretFirebaseUpload();
      }, 500);
    }
  } catch(e) {
    console.warn("Secret URL check error:", e);
  }
}

async function executeSecretFirebaseUpload(){
  const confirmed = confirm("🔐 [Secret Admin Trigger: PIN 1203 Terverifikasi]\n\nApakah Anda ingin meng-upload data liga.json terbaru ke cloud Firebase Realtime Database sekarang?");
  if(!confirmed) return;

  try {
    let dataToUpload = null;
    try {
      const res = await fetch("liga.json?v=" + Date.now());
      dataToUpload = await res.json();
    } catch(err){
      console.warn("Gagal fetch liga.json, menggunakan data memori:", err);
      dataToUpload = league;
    }

    if(!firebaseDb && typeof firebase !== "undefined" && typeof firebaseConfig !== "undefined"){
      if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      firebaseDb = firebase.database();
    }

    if(firebaseDb && dataToUpload){
      await firebaseDb.ref("liga").set(dataToUpload);
      league = dataToUpload;
      localStorage.setItem("fc27-liga", JSON.stringify(league));
      render();
      toast("🔥 [Secret Admin] Seluruh data liga.json BERHASIL di-upload ke Firebase!");
      alert("✅ Sukses! Seluruh data liga.json terbaru telah di-upload ke Firebase Realtime Database.");
    } else {
      alert("⚠️ Firebase Realtime Database belum terinisialisasi. Cek koneksi & konfigurasi.");
    }
  } catch(e) {
    console.error("Secret upload failed:", e);
    alert("❌ Gagal upload ke Firebase: " + e.message);
  }
}

// Opsi upload manual via konsol developer: uploadFirebase('1203')
window.uploadFirebase = function(pin){
  if(pin === ADMIN_PIN){
    executeSecretFirebaseUpload();
  } else {
    alert("PIN salah! Gunakan PIN 1203.");
  }
};

boot();
