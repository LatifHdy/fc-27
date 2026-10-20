const DATA_URL = "liga.json";
const ADMIN_PIN = "1203";

let league = null;
let viewingSeason = "current"; // "current" or number index of league.historySeasons
let filter = "pending";
let selectedPlayer = null;
let currentModalPlayer = null;

// Create Season modal participating players state
let createSeasonAllPlayers = [];
let createSeasonSelected = new Set();

let pendingSaveMatch = null;
let editingMatchId = null;

// Individual Player Performance Tracker state
let perfSelectedSeason = "current"; // "current", or index of historySeasons, or "all"
let perfCategoryFilter = "all"; // "all", "on_fire", "trending_up", "consistent", "fluctuating", "trending_down", "cold", "adaptation", "unplayed"

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
      league = saved ? JSON.parse(saved) : {league:{name:"FC 27 Liga",season:"Season 1",status:"active",teams:[]},matches:[],historySeasons:[]};
    }
  }

  normalizeLeagueData();
  render();
}

function normalizeLeagueData(){
  if(!league) return;
  if(!league.league) league.league = { name: "FC 27 Liga", season: "Season 1", status: "active", teams: [] };
  if(!Array.isArray(league.matches)) league.matches = [];
  if(!Array.isArray(league.historySeasons)) league.historySeasons = [];

  // Default status: if all matches done, completed; otherwise active if matches played
  if(!league.league.status){
    const allDone = league.matches.length > 0 && league.matches.every(m => m.played);
    league.league.status = allDone ? "completed" : "active";
  }

  league.matches = organizeMatches(league.matches, false);
}

/* ==========================================================================
   ACTIVE / VIEWING SEASON ACCESSOR
   ========================================================================== */
function getActiveSeasonData(){
  if(viewingSeason === "current" || typeof viewingSeason !== "number"){
    return {
      season: league?.league?.season || "Season 1",
      status: league?.league?.status || "active",
      teams: league?.league?.teams || [],
      matches: league?.matches || [],
      isArchive: false,
      champion: null
    };
  }

  const archived = league?.historySeasons?.[viewingSeason];
  if(archived){
    return {
      season: archived.season,
      status: archived.status || "completed",
      teams: archived.teams || [],
      matches: archived.matches || [],
      isArchive: true,
      champion: archived.champion,
      runnerUp: archived.runnerUp,
      thirdPlace: archived.thirdPlace,
      standings: archived.standings
    };
  }

  return {
    season: league?.league?.season || "Season 1",
    status: league?.league?.status || "active",
    teams: league?.league?.teams || [],
    matches: league?.matches || [],
    isArchive: false,
    champion: null
  };
}

function computeTableFor(teams, matches){
  if(!Array.isArray(teams)) return [];
  const rows = Object.fromEntries(teams.map(t=>[t,{name:t,mp:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0}]));
  (matches || []).forEach(m=>{
    if(!m.played) return;
    const h = rows[m.home], a = rows[m.away];
    if(!h || !a) return;
    h.mp++; a.mp++;
    h.gf += +m.homeScore; h.ga += +m.awayScore;
    a.gf += +m.awayScore; a.ga += +m.homeScore;
    if(m.homeScore > m.awayScore){ h.w++; a.l++; h.pts += 3; }
    else if(m.homeScore < m.awayScore){ a.w++; h.l++; a.pts += 3; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  });
  return Object.values(rows).map(x=>({...x,gd:x.gf-x.ga})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name));
}

function table(){
  const active = getActiveSeasonData();
  if(active.isArchive && Array.isArray(active.standings) && active.standings.length > 0){
    return active.standings;
  }
  return computeTableFor(active.teams, active.matches);
}

function shuffle(array){
  const a = [...array];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function organizeMatches(matches, doShuffle = false){
  const played = matches.filter(m => m.played);
  let unplayed = matches.filter(m => !m.played);

  if (doShuffle) {
    unplayed = shuffle(unplayed);
  }

  return [...played, ...unplayed];
}

function randomizeMatches(){
  const active = getActiveSeasonData();
  if(active.isArchive){
    alert("Musim arsip tidak dapat diacak.");
    return;
  }
  league.matches = organizeMatches(league.matches, true);
  persist("Jadwal pertandingan yang belum main berhasil diacak.");
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
  const active = getActiveSeasonData();
  const rows = table();
  const rankIndex = rows.findIndex(r => r.name.toLowerCase() === playerName.toLowerCase());
  const stats = rankIndex >= 0 ? rows[rankIndex] : { mp:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, pts:0 };
  const rankNumber = rankIndex >= 0 ? rankIndex + 1 : "-";

  const playedMatches = (active.matches || []).filter(m => m.played && (
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

  const pendingMatches = (active.matches || []).filter(m => !m.played && (
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
    pendingOpponents,
    isArchive: active.isArchive
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
    $("#modalPendingOpponents").innerHTML = `<div class="empty-notice">${p.isArchive ? 'Seluruh pertandingan musim ini telah selesai.' : 'Semua pertandingan sudah selesai! 🎉'}</div>`;
    $("#modalHighlightBtn").style.display = "none";
  } else {
    $("#modalHighlightBtn").style.display = p.isArchive ? "none" : "flex";
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
          ${!p.isArchive ? `<button class="btn-edit-score" data-edit-match="${m.id}" title="Edit Skor (PIN 1203)">✏️ Edit</button>` : ''}
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
   NEW INFO & ALERTS (REPLACED 4 OLD NOTICES WITH USER REQUEST)
   - Histori Juara per Season
   - Yonkou 4 - 5 (Penguasa Puncak)
   - Statistik Konsistensi Pemain
   - Statistik Tren Naik & Turun
   - Lini Serang Tertajam & Tembok Pertahanan
   ========================================================================== */
function getLeagueNotifications(){
  const rows = table();
  const notes = [];

  // 1. 👑 HISTORI JUARA PER SEASON (Hall of Fame)
  const historyList = (league?.historySeasons || []).filter(s => s && s.champion);
  if(historyList.length > 0){
    const champsSummary = historyList.map(s => `${s.season}: ${s.champion.name} (${s.champion.pts}p)`).join(" • ");
    notes.push({
      type: "champions",
      title: "👑 HISTORI JUARA LIGA",
      text: champsSummary + ` | Total ${historyList.length} musim telah diarsipkan.`
    });
  } else {
    const leader = rows[0];
    notes.push({
      type: "champions",
      title: "👑 PEREBUTAN JUARA LIGA",
      text: leader ? `Kandidat terdepan saat ini: ${leader.name} dengan torehan ${leader.pts} poin (SG ${leader.gd > 0 ? "+" : ""}${leader.gd}).` : "Kompetisi belum dimulai. Bersiaplah menjadi sang juara pertama!"
    });
  }

  // 2. ⚔️ YONKOU 4 - 5 (THE 4 - 5 EMPERORS AT THE TOP)
  if(rows.length >= 4){
    const yonkouCount = Math.min(5, rows.length);
    const yonkouPlayers = rows.slice(0, yonkouCount).map((r, i) => `${i+1}. ${r.name} (${r.pts}p)`).join(", ");
    notes.push({
      type: "yonkou",
      title: `⚔️ YONKOU ELITE TOP ${yonkouCount}`,
      text: `Penguasa papan atas musim ini: ${yonkouPlayers}. Persaingan gelar kian ketat!`
    });
  }

  // 3. 🌟 STATISTIK PEMAIN: KONSISTENSI (HIGHEST WIN RATE / LEAST LOSS)
  const playersWithMatches = rows.filter(r => r.mp > 0);
  if(playersWithMatches.length > 0){
    const sortedByWinRate = [...playersWithMatches].sort((a,b) => {
      const rateA = a.w / a.mp;
      const rateB = b.w / b.mp;
      return rateB - rateA || b.pts - a.pts;
    });
    const mostConsistent = sortedByWinRate[0];
    const winPct = Math.round((mostConsistent.w / mostConsistent.mp) * 100);
    notes.push({
      type: "consistency",
      title: "🌟 KONSISTENSI PEMAIN TERTINGGI",
      text: `${mostConsistent.name} menjadi pemain paling konsisten dengan win rate ${winPct}% (${mostConsistent.w} Menang dari ${mostConsistent.mp} laga) & SG ${mostConsistent.gd > 0 ? "+" : ""}${mostConsistent.gd}.`
    });
  }

  // 4. 🎢 STATISTIK PEMAIN: TREN PERFORMA (NAIK / TURUN)
  const active = getActiveSeasonData();
  const formMap = {};
  (active.matches || []).filter(m => m.played).forEach(m => {
    if(!formMap[m.home]) formMap[m.home] = [];
    if(!formMap[m.away]) formMap[m.away] = [];
    formMap[m.home].push(m.homeScore > m.awayScore ? 'W' : m.homeScore === m.awayScore ? 'D' : 'L');
    formMap[m.away].push(m.awayScore > m.homeScore ? 'W' : m.homeScore === m.awayScore ? 'D' : 'L');
  });

  let hotPlayer = null, hotStreak = 0;
  let coldPlayer = null, coldLosses = 0;

  Object.entries(formMap).forEach(([player, results]) => {
    const last3 = results.slice(-3);
    const wins = last3.filter(r => r === 'W').length;
    const losses = last3.filter(r => r === 'L').length;
    if(wins >= 2 && wins > hotStreak){
      hotStreak = wins;
      hotPlayer = player;
    }
    if(losses >= 2 && losses > coldLosses){
      coldLosses = losses;
      coldPlayer = player;
    }
  });

  if(hotPlayer || coldPlayer){
    const hotText = hotPlayer ? `🔥 Tren Naik: ${hotPlayer} meraih kemenangan impresif di laga-laga terakhir.` : "";
    const coldText = coldPlayer ? `📉 Tren Menurun: ${coldPlayer} bertekad memutus rentetan hasil kurang maksimal.` : "";
    notes.push({
      type: "momentum",
      title: "🎢 TREN PERFORMA (NAIK / TURUN)",
      text: [hotText, coldText].filter(Boolean).join(" | ")
    });
  }

  // 5. 🛡️ LINI SERANG & TEMBOK PERTAHANAN
  if(playersWithMatches.length >= 2){
    const topAttack = [...playersWithMatches].sort((a,b) => b.gf - a.gf)[0];
    const bestDef = [...playersWithMatches].filter(p => p.mp >= 2).sort((a,b) => a.ga - b.ga)[0] || playersWithMatches[0];
    notes.push({
      type: "attack-defense",
      title: "🛡️ LINI SERANG & PERTAHANAN",
      text: `Mesin Gol Tertajam: ${topAttack.name} (${topAttack.gf} gol dicetak) • Tembok Terkokoh: ${bestDef.name} (Hanya kebobolan ${bestDef.ga} gol).`
    });
  }

  return notes;
}

/* ==========================================================================
   INDIVIDUAL PLAYER PERFORMANCE PER SEASON (CONDITIONS & VALIDATIONS)
   ========================================================================== */
function getPerformanceSeasonData(seasonId){
  if(seasonId === "current"){
    const teams = league?.league?.teams || [];
    const matches = league?.matches || [];
    const seasonName = league?.league?.season || "Season 1";
    const status = league?.league?.status || "active";
    return { id: "current", name: seasonName, status, teams, matches, isArchive: false };
  }
  if(typeof seasonId === "number"){
    const s = league?.historySeasons?.[seasonId];
    if(s){
      return {
        id: seasonId,
        name: s.season,
        status: s.status || "completed",
        teams: s.teams || [],
        matches: s.matches || [],
        champion: s.champion,
        standings: s.standings,
        isArchive: true
      };
    }
  }
  if(seasonId === "all"){
    const allMatches = [
      ...(league?.historySeasons?.flatMap(s => s.matches || []) || []),
      ...(league?.matches || [])
    ];
    const allTeams = Array.from(new Set([
      ...(league?.league?.teams || []),
      ...(league?.historySeasons?.flatMap(s => s.teams || []) || [])
    ])).filter(Boolean);
    return {
      id: "all",
      name: "Akumulasi Semua Musim",
      status: "all",
      teams: allTeams,
      matches: allMatches,
      isArchive: false
    };
  }
  return getPerformanceSeasonData("current");
}

function getAllPerformanceSeasons(){
  const list = [];
  const currentName = league?.league?.season || "Season 1";
  const currentStatus = league?.league?.status === "draft" ? "Draft" : (league?.league?.status === "completed" ? "Selesai" : "Berjalan");
  list.push({ id: "current", label: `🏆 ${currentName} (${currentStatus === 'Draft' ? 'Draft' : currentStatus === 'Selesai' ? 'Selesai' : 'Aktif'})`, rawName: currentName });

  if(Array.isArray(league?.historySeasons) && league.historySeasons.length > 0){
    league.historySeasons.forEach((s, idx) => {
      const champ = s.champion?.name ? `Juara: ${s.champion.name}` : "Arsip";
      list.push({ id: idx, label: `📜 ${s.season} (${champ})`, rawName: s.season });
    });
    list.push({ id: "all", label: `🌐 Semua Musim (All-Time)`, rawName: "Semua Musim" });
  }

  return list;
}

function computePlayerPerformance(player, seasonTeams, seasonMatches, rankMap = {}){
  const playedMatches = (seasonMatches || []).filter(m => m.played && (
    (m.home && m.home.toLowerCase() === player.toLowerCase()) ||
    (m.away && m.away.toLowerCase() === player.toLowerCase())
  ));
  const mp = playedMatches.length;

  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  let cleanSheets = 0;
  let hasWo = false;
  const matchHistory = [];

  playedMatches.forEach(m => {
    const isHome = m.home.toLowerCase() === player.toLowerCase();
    const myScore = isHome ? +m.homeScore : +m.awayScore;
    const oppScore = isHome ? +m.awayScore : +m.homeScore;
    const opp = isHome ? m.away : m.home;
    gf += myScore;
    ga += oppScore;
    if(oppScore === 0) cleanSheets++;
    if(myScore === 0 && oppScore === 3 && (m.isWO || player.toLowerCase().includes("maul"))) hasWo = true;

    let res = 'D';
    if(myScore > oppScore){ w++; res = 'W'; }
    else if(myScore < oppScore){ l++; res = 'L'; }
    else { d++; }
    matchHistory.push({ opponent: opp, myScore, oppScore, res, isHome });
  });

  const pts = w * 3 + d;
  const gd = gf - ga;
  const winRate = mp > 0 ? Math.round((w / mp) * 100) : 0;
  const pointsPct = mp > 0 ? Math.round((pts / (mp * 3)) * 100) : 0;
  const gpm = mp > 0 ? (gf / mp).toFixed(1) : "0.0";
  const kpm = mp > 0 ? (ga / mp).toFixed(1) : "0.0";

  // Last results (up to last 5)
  const lastForm = matchHistory.slice(-5).map(m => m.res);
  const last3 = matchHistory.slice(-3).map(m => m.res);
  const last3Wins = last3.filter(r => r === 'W').length;
  const last3Losses = last3.filter(r => r === 'L').length;

  // Validation conditions
  let sampleStatus = "valid";
  let sampleLabel = `✅ Data Tervalidasi (${mp} Laga)`;
  if(mp === 0){
    sampleStatus = "unplayed";
    sampleLabel = "⏳ Belum Bertanding";
  } else if(mp === 1){
    sampleStatus = "adaptation";
    sampleLabel = "🌱 Sampel Awal (1 Laga)";
  }

  // Performance status category & conditions
  let statusKey = "consistent";
  let statusBadge = "⚖️ KONSISTEN";
  let evalText = "";
  let badgeClass = "perf-consistent";
  let highlightClass = "";

  if(mp === 0){
    statusKey = "unplayed";
    statusBadge = "⏳ BELUM ADA LAGA";
    badgeClass = "perf-unplayed";
    evalText = "Pemain belum memiliki catatan pertandingan pada musim yang dipilih.";
  } else if(mp === 1){
    statusKey = "adaptation";
    badgeClass = "perf-adaptation";
    if(w === 1){
      statusBadge = "🌱 DEBUT POSITIF";
      evalText = `Mengawali musim dengan kemenangan impresif di laga perdana (${gf} gol dicetak).`;
    } else if(l === 1){
      statusBadge = "🌱 TANTANGAN AWAL";
      evalText = `Menderita kekalahan di laga pembuka, membutuhkan adaptasi strategi di laga berikutnya.`;
    } else {
      statusBadge = "🌱 IMBANG AWAL";
      evalText = `Meraih hasil imbang di laga debut, fondasi permainan cukup kompetitif.`;
    }
  } else {
    // Condition 1: ON FIRE / Puncak Performa
    const isWinStreak = last3.length >= 3 && last3.every(r => r === 'W');
    if((winRate >= 75 && gd >= 5) || (winRate >= 80) || isWinStreak){
      statusKey = "on_fire";
      statusBadge = "🔥 ON FIRE";
      badgeClass = "perf-onfire";
      highlightClass = "highlight-onfire";
      evalText = `Performa sangat dominan dengan win rate ${winRate}% dan torehan ${gf} gol (${gpm} gol/laga). Tren permainan sangat tajam.`;
    }
    // Condition 2: TREN NAIK / Momentum Positif
    else if((last3Wins >= 2 && last3Losses === 0) || winRate >= 60){
      statusKey = "trending_up";
      statusBadge = "📈 TREN NAIK";
      badgeClass = "perf-trending-up";
      evalText = `Momentum sangat positif, meraih ${w} kemenangan dari ${mp} laga dengan efektivitas raihan poin ${pointsPct}%.`;
    }
    // Condition 3: COLD / BUTUH EVALUASI (Krisis)
    else if((w === 0 && mp >= 2) || (last3Losses >= 3)){
      statusKey = "cold";
      statusBadge = "🧊 BUTUH EVALUASI";
      badgeClass = "perf-cold";
      highlightClass = "highlight-cold";
      evalText = `Belum berhasil meraih kemenangan di ${mp} laga terakhir. Pertahanan kebobolan rata-rata ${kpm} gol/laga. Memerlukan evaluasi taktik.`;
    }
    // Condition 4: TREN MENURUN / Underperform
    else if(last3Losses >= 2 || +kpm >= 4.0 || (l > w && l >= 2)){
      statusKey = "trending_down";
      statusBadge = "📉 TREN MENURUN";
      badgeClass = "perf-trending-down";
      evalText = `Mengalami ${l} kekalahan dari ${mp} laga. Lini pertahanan perlu diperkokoh untuk menahan gempuran lawan.`;
    }
    // Condition 5: FLUKTUATIF / Angin-Anginan
    else if(w >= 1 && l >= 1 && Math.abs(w - l) <= 1){
      statusKey = "fluctuating";
      statusBadge = "🎢 FLUKTUATIF";
      badgeClass = "perf-fluctuating";
      evalText = `Hasil pertandingan masih berselang-seling (${w}M ${d}S ${l}K). Perlu stabilitas tempo dan fokus 90 menit.`;
    }
    // Condition 6: KONSISTEN / Stabil
    else {
      statusKey = "consistent";
      statusBadge = "⚖️ KONSISTEN";
      badgeClass = "perf-consistent";
      evalText = `Permainan terstruktur dan stabil dengan torehan ${pts} poin dan selisih gol ${gd > 0 ? "+" : ""}${gd}.`;
    }
  }

  // Attack rating
  let attackDesc = "";
  if(+gpm >= 4.0) attackDesc = `⚡ Serangan Mematikan (${gpm} G/L)`;
  else if(+gpm >= 2.5) attackDesc = `🎯 Produktif (${gpm} G/L)`;
  else if(mp > 0) attackDesc = `⚠️ Peluang Minim (${gpm} G/L)`;
  else attackDesc = `-`;

  // Defense rating
  let defenseDesc = "";
  if(+kpm <= 2.0 && mp > 0) defenseDesc = `🛡️ Tembok Kokoh (${kpm} K/L)`;
  else if(+kpm <= 3.5 && mp > 0) defenseDesc = `⚠️ Pertahanan Standar (${kpm} K/L)`;
  else if(mp > 0) defenseDesc = `🚨 Rentan Kebobolan (${kpm} K/L)`;
  else defenseDesc = `-`;

  // Special tags
  const specialTags = [];
  if(l === 0 && mp >= 2) specialTags.push("🌟 Unbeaten");
  if(cleanSheets > 0) specialTags.push(`🧤 ${cleanSheets} Clean Sheet`);
  if(hasWo) specialTags.push("⚠️ Rekor WO");

  const rank = rankMap[player.toLowerCase()] || "-";

  return {
    name: player,
    rank,
    mp, w, d, l, gf, ga, gd, pts,
    winRate, pointsPct, gpm, kpm,
    lastForm,
    sampleStatus, sampleLabel,
    statusKey, statusBadge, badgeClass, highlightClass, evalText,
    attackDesc, defenseDesc, specialTags
  };
}

function renderNotifications(){
  const notes = getLeagueNotifications();
  const seasonData = getPerformanceSeasonData(perfSelectedSeason);
  const seasonRows = computeTableFor(seasonData.teams, seasonData.matches);
  const rankMap = {};
  seasonRows.forEach((r, idx) => {
    rankMap[r.name.toLowerCase()] = String(idx + 1).padStart(2, "0");
  });

  const allPlayersPerf = seasonData.teams.map(p => computePlayerPerformance(p, seasonData.teams, seasonData.matches, rankMap));

  // Category counts
  const counts = {
    all: allPlayersPerf.length,
    on_fire: allPlayersPerf.filter(p => p.statusKey === "on_fire").length,
    trending_up: allPlayersPerf.filter(p => p.statusKey === "trending_up").length,
    consistent: allPlayersPerf.filter(p => p.statusKey === "consistent").length,
    fluctuating: allPlayersPerf.filter(p => p.statusKey === "fluctuating").length,
    trending_down: allPlayersPerf.filter(p => p.statusKey === "trending_down").length,
    cold: allPlayersPerf.filter(p => p.statusKey === "cold").length,
    adaptation: allPlayersPerf.filter(p => p.statusKey === "adaptation").length,
    unplayed: allPlayersPerf.filter(p => p.statusKey === "unplayed").length
  };

  const filteredPlayers = perfCategoryFilter === "all" ? allPlayersPerf : allPlayersPerf.filter(p => p.statusKey === perfCategoryFilter);

  const availableSeasons = getAllPerformanceSeasons();

  const filterTabs = [
    { key: "all", label: "Semua", count: counts.all },
    { key: "on_fire", label: "🔥 On Fire", count: counts.on_fire },
    { key: "trending_up", label: "📈 Tren Naik", count: counts.trending_up },
    { key: "consistent", label: "⚖️ Konsisten", count: counts.consistent },
    { key: "fluctuating", label: "🎢 Fluktuatif", count: counts.fluctuating },
    { key: "trending_down", label: "📉 Tren Menurun", count: counts.trending_down },
    { key: "cold", label: "🧊 Butuh Evaluasi", count: counts.cold },
    { key: "adaptation", label: "🌱 Adaptasi", count: counts.adaptation },
    { key: "unplayed", label: "⏳ Belum Main", count: counts.unplayed }
  ].filter(f => f.key === "all" || f.count > 0);

  $("#notifications").innerHTML = `
    <div class="notice-head">
      <div>
        <div class="eyebrow dark">LEAGUE INSIGHTS &amp; STATS</div>
        <h3>Info, Statistik &amp; Histori Liga</h3>
      </div>
      <span>${notes.length} info utama</span>
    </div>
    <div class="notice-grid">
      ${notes.map(n=>`
        <div class="notice ${n.type}">
          <div class="notice-icon">
            ${n.type === "champions" ? "👑" : n.type === "yonkou" ? "⚔️" : n.type === "consistency" ? "🌟" : n.type === "momentum" ? "🔥" : "🛡️"}
          </div>
          <div><b>${esc(n.title)}</b><p>${esc(n.text)}</p></div>
        </div>`).join("")}
    </div>

    <!-- INDIVIDUAL PLAYER PERFORMANCE TRACKER PER SEASON -->
    <div class="perf-tracker-section" id="playerPerformanceTracker">
      <div class="perf-header-wrap">
        <div class="perf-title-area">
          <div class="eyebrow dark">ANALISIS &amp; VALIDASI PERFORMA INDIVIDUAL</div>
          <h3>Performa Tiap Pemain per Season</h3>
          <p>Evaluasi mendalam performa per individu berdasarkan validasi sampel pertandingan, win rate, produktivitas gol, dan tren laga terakhir.</p>
        </div>
      </div>

      <div class="perf-controls">
        <!-- Season Selector Bar -->
        <div class="perf-season-bar">
          <span class="perf-season-bar-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            Pilih Musim:
          </span>
          <div class="perf-season-pills">
            ${availableSeasons.map(s => `
              <button class="perf-season-btn ${String(perfSelectedSeason) === String(s.id) ? 'active' : ''}" data-season-id="${s.id}">
                ${esc(s.label)}
              </button>
            `).join("")}
          </div>
        </div>

        <!-- Category Filter Bar -->
        <div class="perf-filter-bar">
          <span style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Kategori:</span>
          ${filterTabs.map(f => `
            <button class="perf-filter-btn ${perfCategoryFilter === f.key ? 'active' : ''}" data-filter-key="${f.key}">
              <span>${esc(f.label)}</span>
              <span class="perf-filter-count">${f.count}</span>
            </button>
          `).join("")}
        </div>
      </div>

      <!-- Player Performance Cards Grid -->
      <div class="perf-grid">
        ${filteredPlayers.length === 0 ? `
          <div class="empty-notice" style="grid-column:1/-1;padding:36px 20px;text-align:center;background:#f8fafc;border-radius:14px;border:1.5px dashed var(--line)">
            Tidak ada pemain dengan kategori performa ini pada ${esc(seasonData.name)}.
          </div>
        ` : filteredPlayers.map(p => `
          <div class="player-perf-card ${p.highlightClass}" data-player-name="${esc(p.name)}" title="Klik untuk membuka profil lengkap ${esc(p.name)}">
            <div class="perf-card-header">
              <div class="perf-card-player-info">
                <div class="perf-avatar">${esc(initials(p.name))}</div>
                <div class="perf-player-name-wrap">
                  <b>${esc(p.name)}</b>
                  <small>POSISI ${p.rank} &bull; ${esc(seasonData.name)}</small>
                </div>
              </div>
              <span class="perf-status-badge ${p.badgeClass}">${esc(p.statusBadge)}</span>
            </div>

            <div class="perf-validation-tag-row">
              <span class="perf-sample-pill ${p.sampleStatus}">${esc(p.sampleLabel)}</span>
              <div style="display:flex;gap:4px">
                ${p.specialTags.map(tag => `<span class="perf-special-tag">${esc(tag)}</span>`).join("")}
              </div>
            </div>

            <div class="perf-form-section">
              <span class="perf-form-label">Form Laga Terakhir:</span>
              <div class="perf-form-strip">
                ${p.lastForm.length > 0 ? p.lastForm.map(res => `
                  <span class="perf-form-dot ${res.toLowerCase()}" title="${res === 'W' ? 'Menang' : res === 'D' ? 'Seri' : 'Kalah'}">${res}</span>
                `).join("") : `<span class="perf-form-dot empty" title="Belum ada laga">-</span>`}
              </div>
            </div>

            <div class="perf-stats-matrix">
              <div class="perf-stat-col">
                <small>WIN RATE</small>
                <span>${p.winRate}%</span>
              </div>
              <div class="perf-stat-col">
                <small>POIN</small>
                <span>${p.pts}</span>
              </div>
              <div class="perf-stat-col">
                <small>GOL/LG</small>
                <span>${p.gpm}</span>
              </div>
              <div class="perf-stat-col">
                <small>BOBOL/LG</small>
                <span>${p.kpm}</span>
              </div>
            </div>

            <p class="perf-eval-text">${esc(p.evalText)}</p>

            <div class="perf-ratings-row">
              ${p.attackDesc !== '-' ? `<span class="perf-rating-chip">${esc(p.attackDesc)}</span>` : ''}
              ${p.defenseDesc !== '-' ? `<span class="perf-rating-chip">${esc(p.defenseDesc)}</span>` : ''}
              <span class="perf-rating-chip" style="margin-left:auto;color:#2563eb;font-weight:800">🔍 Profil ↗</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/* ==========================================================================
   CORE RENDER
   ========================================================================== */
function render(){
  normalizeLeagueData();
  const active = getActiveSeasonData();

  const teamCount = active.teams?.length || 0;
  const matchCount = active.matches?.length || 0;
  const seasonName = active.season || "Season 1";
  const playedCount = (active.matches || []).filter(m => m.played).length;
  const pendingCount = (active.matches || []).filter(m => !m.played).length;
  const notesCount = getLeagueNotifications().length;

  if($("#heroSeasonBadge")){
    const badgeText = active.isArchive ? `FC 27 • ${seasonName} (ARSIP)` : `FC 27 • ${seasonName}`;
    $("#heroSeasonBadge").textContent = badgeText.toUpperCase();
  }
  if($("#leagueSummaryTitle")) $("#leagueSummaryTitle").innerHTML = `${teamCount} pemain.<br><strong>1 juara.</strong>`;
  if($("#totalMatchesStat")) $("#totalMatchesStat").textContent = matchCount;
  if($("#totalTeamsStat")) $("#totalTeamsStat").textContent = teamCount;

  // Update Pajak.go.id Navigator Tabs Badges
  if($("#tabTeamCountBadge")) $("#tabTeamCountBadge").textContent = `${teamCount} Tim`;
  if($("#tabPendingCountBadge")) $("#tabPendingCountBadge").textContent = `${pendingCount} Sisa`;
  if($("#tabPlayedCountBadge")) $("#tabPlayedCountBadge").textContent = `${playedCount} Selesai`;
  if($("#tabAlertBadge")) $("#tabAlertBadge").textContent = `${notesCount} Info`;

  renderSeasonSwitcher();
  renderSeasonBanner();
  renderStandings();
  renderLeaders();
  renderMatches();
  renderHistory();
  renderNotifications();
}

function renderSeasonSwitcher(){
  const select = $("#seasonSelect");
  if(!select) return;

  const currentSeasonName = league?.league?.season || "Season 1";
  const currentStatus = league?.league?.status || (isSeasonFinished() ? "completed" : "active");
  const statusTag = currentStatus === "draft" ? "Draft" : currentStatus === "completed" ? "Selesai" : "Berjalan";

  let html = `<option value="current" ${viewingSeason === "current" ? "selected" : ""}>🏆 ${esc(currentSeasonName)} (${statusTag})</option>`;

  if(Array.isArray(league?.historySeasons) && league.historySeasons.length > 0){
    html += `<optgroup label="── ARSIP MUSIM SEBELUMNYA ──">`;
    league.historySeasons.forEach((s, idx) => {
      const champName = s.champion?.name ? `Juara: ${s.champion.name}` : "Selesai";
      html += `<option value="${idx}" ${viewingSeason === idx ? "selected" : ""}>📜 ${esc(s.season)} (${champName})</option>`;
    });
    html += `</optgroup>`;
  }

  select.innerHTML = html;
}

function renderStandings(){
  const rows = table();
  $("#standings").innerHTML = rows.map((x,i)=>{
    const isSelected = selectedPlayer && selectedPlayer.toLowerCase() === x.name.toLowerCase();
    return `
      <tr class="${isSelected ? 'active-row' : ''}" data-player="${esc(x.name)}" title="Klik untuk melihat riwayat dan statistik pemain">
        <td class="pos ${i===0?'top1':''}">${String(i+1).padStart(2,"0")}</td>
        <td>
          <div class="team-cell">
            <span class="team-badge">${esc(initials(x.name))}</span>
            <strong>
              ${esc(x.name)}
              <span class="view-tag">🔍 DETAIL</span>
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
      <div class="pod ${i===1?'first':''}" data-player="${esc(x.name)}" title="Klik untuk melihat riwayat dan statistik pemain">
        <div class="rank">${i===1?'01':i===0?'02':'03'}</div>
        <div class="avatar">${esc(initials(x.name))}</div>
        <b>${esc(x.name)}</b><small>${x.mp} match</small><div class="pts">${x.pts} pts</div>
      </div>`:"").join("")}</div>`;
}

function renderMatches(){
  const active = getActiveSeasonData();
  const banner = $("#highlightBanner");

  if(selectedPlayer){
    const pendingMatchesOfPlayer = (active.matches || []).filter(m => !m.played && (
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

  // Handle Archive Season view
  if(active.isArchive){
    $("#matches").innerHTML = `
      <div class="empty-notice" style="grid-column:1/-1;padding:36px 20px;background:#f8fafc;border-radius:14px;border:1.5px dashed var(--line);text-align:center">
        <div style="font-size:28px;margin-bottom:8px">📜 🏆</div>
        <strong style="display:block;font-size:15px;color:var(--navy);margin-bottom:4px">Data Arsip: ${esc(active.season)} Selesai</strong>
        <p style="margin:0 0 14px;color:var(--muted);font-size:12px">Seluruh pertandingan musim ini telah dimainkan. Anda dapat melihat hasil skor di tab "Riwayat Hasil".</p>
        <button class="btn accent" id="archiveReturnBtn" style="padding:9px 18px">Kembali ke Musim Berjalan ↗</button>
      </div>`;
    const retBtn = $("#archiveReturnBtn");
    if(retBtn) retBtn.onclick = () => { viewingSeason = "current"; render(); };
    return;
  }

  // Handle Draft Season view
  if(active.status === "draft"){
    const list = active.matches || [];
    $("#matches").innerHTML = `
      <div class="empty-notice" style="grid-column:1/-1;padding:26px 20px;background:#fffbeb;border-radius:14px;border:1.5px solid #fde047;text-align:center;margin-bottom:12px">
        <strong style="display:block;font-size:15px;color:#713f12;margin-bottom:6px">🟡 Status: DRAFT (Musim Belum Dimulai)</strong>
        <p style="margin:0 0 14px;color:#854d0e;font-size:12px">Jadwal pertandingan telah dibuat untuk <strong>${active.teams.length} pemain</strong>. Anda masih dapat menambah pemain sebelum klik <strong>Start Season</strong>.</p>
        <div style="display:inline-flex;gap:10px">
          <button class="btn ghost add-player-draft-btn" id="matchCenterAddPlayerBtn" style="border-color:#b45309;color:#713f12">➕ Tambah Pemain</button>
          <button class="btn accent" id="matchCenterStartSeasonBtn">🚀 Start Season (Mulai Musim)</button>
        </div>
      </div>
      ${list.map(m => `
        <div class="match" style="opacity:0.85">
          <div class="side">${esc(m.home)}</div>
          <div class="scorebox">
            <span style="font-size:12px;font-weight:800;color:#94a3b8">DRAFT</span>
            <div class="vs">VS</div>
          </div>
          <div class="side away">${esc(m.away)}</div>
          <div style="grid-column:1/-1;text-align:center;font-size:10px;font-weight:700;color:#94a3b8;padding:4px">Belum Dimulai</div>
        </div>
      `).join("")}
    `;

    const addPBtn = $("#matchCenterAddPlayerBtn");
    if(addPBtn) addPBtn.onclick = openAddPlayerDraftModal;
    const startSBtn = $("#matchCenterStartSeasonBtn");
    if(startSBtn) startSBtn.onclick = promptStartSeason;
    return;
  }

  // Active season: normal match center
  const ordered = organizeMatches(active.matches || [], false);
  let list = ordered.filter(m => !m.played);

  if(list.length === 0){
    const allDone = isSeasonFinished();
    $("#matches").innerHTML = `
      <div class="empty-notice" style="grid-column:1/-1;padding:35px 20px;background:#fff;border-radius:14px;border:1px dashed var(--line);font-size:13px;text-align:center">
        ${allDone ? `
          <div style="font-size:32px;margin-bottom:8px">🎉 🏆 🎉</div>
          <strong style="display:block;font-size:16px;color:var(--navy);margin-bottom:6px">Semua Pertandingan Musim Ini Telah Selesai!</strong>
          <p style="margin:0 0 16px;color:var(--muted);font-size:12px">Seluruh jadwal telah dimainkan. Klik tombol di bawah untuk membuat musim berikutnya.</p>
          <button class="btn accent" id="emptyNoticeNextSeasonBtn" style="padding:11px 20px;font-weight:800;font-size:12px">⚡ Mulai Season Berikutnya</button>
        ` : `
          Semua pertandingan pada filter ini sudah selesai dimainkan! Cek tab "Riwayat Hasil" untuk melihat skor atau mengoreksi.
        `}
      </div>`;
    const emptyBtn = $("#emptyNoticeNextSeasonBtn");
    if(emptyBtn) emptyBtn.addEventListener("click", openCreateSeasonModal);
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
      <div class="match ${isHighlighted ? 'is-highlighted' : ''} ${isDimmed ? 'is-dimmed' : ''}">
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
  const active = getActiveSeasonData();
  const playedMatches = (active.matches || []).filter(m => m.played);
  const countEl = $("#historySectionCount");
  if(countEl) countEl.textContent = `${playedMatches.length} Pertandingan Selesai`;

  const grid = $("#historyGrid");
  if(!grid) return;

  if(playedMatches.length === 0){
    grid.innerHTML = `
      <div class="empty-notice" style="grid-column:1/-1;padding:32px 20px;background:#f8fafc;border-radius:16px;border:1.5px dashed var(--line);text-align:center">
        Belum ada pertandingan yang selesai dimainkan pada musim ini.
      </div>`;
    return;
  }

  grid.innerHTML = playedMatches.map(m => {
    const homeWin = m.homeScore > m.awayScore;
    const awayWin = m.awayScore > m.homeScore;
    return `
      <div class="history-match-item" data-match-id="${m.id}">
        <div class="history-item-top">
          <span class="history-item-tag played">${active.isArchive ? 'ARSIP' : 'SELESAI'}</span>
          ${!active.isArchive ? `
            <button class="btn-edit-score" data-edit-match="${m.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" fill="#fde047" stroke="#d97706" stroke-width="2"/>
              </svg>
              Edit Skor
            </button>
          ` : `
            <span style="font-size:10px;font-weight:700;color:#94a3b8">Musim Selesai</span>
          `}
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
   SEASON STATUS BANNERS & LIFECYCLE
   ========================================================================== */
function isSeasonFinished(){
  return league && Array.isArray(league.matches) && league.matches.length > 0 && league.matches.every(m => m.played);
}

function renderSeasonBanner(){
  const statusBanner = $("#seasonStatusBanner");
  const seasonBanner = $("#seasonBanner");
  const active = getActiveSeasonData();

  if(!statusBanner || !seasonBanner) return;

  // 1. Viewing an Archived past season
  if(active.isArchive){
    statusBanner.style.display = "block";
    seasonBanner.style.display = "none";
    statusBanner.innerHTML = `
      <div class="season-status-banner archive">
        <div class="status-banner-content">
          <span class="status-pill archive">📜 ARSIP MUSIM SELESAI</span>
          <h3>Data Arsip: <strong>${esc(active.season)}</strong></h3>
          <p>Juara: <strong>${esc(active.champion?.name || '-')}</strong> (${active.champion?.pts || 0} Poin) • Total ${active.matches.length} Pertandingan Tuntas.</p>
        </div>
        <div class="status-banner-actions">
          <button class="btn accent btn-sm" id="returnToCurrentSeasonBtn">Kembali ke Musim Berjalan ↗</button>
        </div>
      </div>
    `;
    const retBtn = $("#returnToCurrentSeasonBtn");
    if(retBtn) retBtn.onclick = () => { viewingSeason = "current"; render(); };
    return;
  }

  // 2. Current season in DRAFT mode
  if(active.status === "draft"){
    statusBanner.style.display = "block";
    seasonBanner.style.display = "none";
    statusBanner.innerHTML = `
      <div class="season-status-banner draft">
        <div class="status-banner-content">
          <span class="status-pill draft">🟡 DRAFT • BELUM DIMULAI</span>
          <h3>Musim Baru: <strong>${esc(active.season)}</strong></h3>
          <p>Pemain masih dapat ditambah ke liga sebelum kompetisi dimulai (${active.teams.length} Pemain &bull; ${active.matches.length} Jadwal Pertandingan).</p>
        </div>
        <div class="status-banner-actions">
          <button class="btn ghost" id="bannerDraftAddPlayerBtn" style="border-color:#b45309;color:#713f12">➕ Tambah Pemain</button>
          <button class="btn accent" id="bannerStartSeasonBtn">🚀 Start Season (Mulai Musim)</button>
        </div>
      </div>
    `;
    const addBtn = $("#bannerDraftAddPlayerBtn");
    if(addBtn) addBtn.onclick = openAddPlayerDraftModal;
    const startBtn = $("#bannerStartSeasonBtn");
    if(startBtn) startBtn.onclick = promptStartSeason;
    return;
  }

  // 3. Current season is ACTIVE
  const finished = isSeasonFinished();
  if(finished){
    statusBanner.style.display = "none";
    seasonBanner.style.display = "block";

    const rows = table();
    const champion = rows[0] || { name: "-", pts: 0, gd: 0 };
    const seasonName = league.league?.season || "Musim Ini";

    seasonBanner.innerHTML = `
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
    if(bBtn) bBtn.addEventListener("click", openCreateSeasonModal);
  } else {
    seasonBanner.style.display = "none";
    statusBanner.style.display = "block";

    const playedCount = (league.matches || []).filter(m => m.played).length;
    statusBanner.innerHTML = `
      <div class="season-status-banner active-season">
        <div class="status-banner-content">
          <span class="status-pill active">🟢 SEASON BERJALAN</span>
          <h3>${esc(active.season)} • ${playedCount} dari ${active.matches.length} Pertandingan Selesai</h3>
          <p>Skor pertandingan otomatis menghitung poin klasemen secara real-time.</p>
        </div>
        <div class="status-banner-actions">
          <button class="btn ghost" id="bannerFinishSeasonBtn" style="border-color:#059669;color:#065f46">🏁 Selesaikan Musim (Next Season)</button>
        </div>
      </div>
    `;
    const finishBtn = $("#bannerFinishSeasonBtn");
    if(finishBtn) finishBtn.onclick = promptFinishSeason;
  }
}

/* ==========================================================================
   PIN VERIFICATION FOR SAVING MATCH SCORES (PIN 1203)
   ========================================================================== */
function promptPinForSave(id){
  const active = getActiveSeasonData();
  if(active.isArchive){
    alert("Tidak dapat mengubah skor pada musim arsip.");
    return;
  }
  if(active.status === "draft"){
    alert("Musim belum dimulai! Klik 'Start Season' terlebih dahulu.");
    return;
  }

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
  const active = getActiveSeasonData();
  if(active.isArchive){
    alert("Musim ini telah diarsipkan dan berstatus selesai.");
    return;
  }

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
   CREATE SEASON MODAL & PARTICIPATING PLAYERS SELECTION
   ========================================================================== */
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

function archiveCurrentSeason(){
  if(!league) return null;
  if(!Array.isArray(league.historySeasons)) league.historySeasons = [];

  const rows = computeTableFor(league.league?.teams || [], league.matches || []);
  const champ = rows[0] || null;
  const rUp = rows[1] || null;
  const tPlace = rows[2] || null;

  const archivedObj = {
    season: league.league?.season || "Season 1",
    name: league.league?.name || "FC 27 Liga",
    status: "completed",
    completedAt: new Date().toISOString(),
    teams: [...(league.league?.teams || [])],
    matches: JSON.parse(JSON.stringify(league.matches || [])),
    standings: rows,
    champion: champ ? { name: champ.name, pts: champ.pts, gd: champ.gd, w: champ.w, mp: champ.mp } : null,
    runnerUp: rUp ? { name: rUp.name, pts: rUp.pts } : null,
    thirdPlace: tPlace ? { name: tPlace.name, pts: tPlace.pts } : null
  };

  const existingIdx = league.historySeasons.findIndex(s => s.season === archivedObj.season);
  if(existingIdx >= 0){
    league.historySeasons[existingIdx] = archivedObj;
  } else {
    league.historySeasons.push(archivedObj);
  }

  return archivedObj;
}

function openCreateSeasonModal(){
  const currentSeasonName = league?.league?.season || "Season 1";
  const nextName = getNextSeasonName(currentSeasonName);

  $("#nextSeasonInput").value = nextName;
  $("#createSeasonPinInput").value = "";
  $("#createSeasonPinError").style.display = "none";
  $("#newTeamInput").value = "";

  // Collect all known players across current league and past seasons
  const allKnown = Array.from(new Set([
    ...(league?.league?.teams || []),
    ...(league?.historySeasons?.flatMap(s => s.teams || []) || [])
  ])).filter(Boolean);

  createSeasonAllPlayers = allKnown;
  // Default: select current league players (or all known)
  createSeasonSelected = new Set(league?.league?.teams || allKnown);

  renderParticipatingPlayers();

  // If current season has completed matches, show recap
  const recapBox = $("#modalChampionRecap");
  const rows = table();
  if(rows.length > 0 && isSeasonFinished()){
    recapBox.style.display = "block";
    $("#modalSeasonCompletedName").textContent = `${currentSeasonName} Selesai (${league.matches.length} Pertandingan)`;
    const c1 = rows[0], c2 = rows[1], c3 = rows[2];
    $("#championSummaryRow").innerHTML = `
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
  } else {
    recapBox.style.display = "none";
  }

  const modal = $("#nextSeasonModal");
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add("show"));
}

function renderParticipatingPlayers(){
  const container = $("#participatingPlayersList");
  if(!container) return;

  container.innerHTML = createSeasonAllPlayers.map(p => {
    const isChecked = createSeasonSelected.has(p);
    return `
      <label class="player-select-chip ${isChecked ? 'selected' : ''}" data-player-name="${esc(p)}">
        <input type="checkbox" value="${esc(p)}" ${isChecked ? 'checked' : ''}>
        <span class="player-select-avatar">${esc(initials(p))}</span>
        <span class="player-select-name">${esc(p)}</span>
      </label>
    `;
  }).join("");

  updateSelectionSummary();
}

function updateSelectionSummary(){
  const n = createSeasonSelected.size;
  const matchCount = Math.floor(n * (n - 1) / 2);
  const countEl = $("#newSeasonTeamCount");
  const matchCountEl = $("#newSeasonMatchCount");

  if(countEl) countEl.textContent = n;
  if(matchCountEl) matchCountEl.textContent = matchCount;
}

function addNewPlayerToSelection(){
  const input = $("#newTeamInput");
  const name = input.value.trim();
  if(!name) return;

  if(createSeasonAllPlayers.some(p => p.toLowerCase() === name.toLowerCase())){
    alert(`Pemain "${name}" sudah ada dalam daftar.`);
    return;
  }

  createSeasonAllPlayers.push(name);
  createSeasonSelected.add(name);
  input.value = "";
  renderParticipatingPlayers();
}

function closeCreateSeasonModal(){
  const modal = $("#nextSeasonModal");
  modal.classList.remove("show");
  setTimeout(() => { modal.hidden = true; }, 200);
}

async function executeCreateSeason(){
  const seasonName = $("#nextSeasonInput").value.trim();
  const pin = $("#createSeasonPinInput").value.trim();
  const errBox = $("#createSeasonPinError");

  if(!seasonName){
    alert("Harap masukkan nama musim baru (misal: Season 2).");
    return;
  }

  const selectedTeams = Array.from(createSeasonSelected);
  if(selectedTeams.length < 2){
    alert("Pilih minimal 2 pemain untuk membuat liga baru.");
    return;
  }

  if(pin !== ADMIN_PIN){
    errBox.style.display = "block";
    errBox.textContent = "PIN salah! Gunakan PIN 1203.";
    $("#createSeasonPinInput").classList.add("shake");
    setTimeout(() => $("#createSeasonPinInput").classList.remove("shake"), 400);
    $("#createSeasonPinInput").focus();
    return;
  }

  // Archive current season before overwriting
  if(league && league.matches && league.matches.some(m => m.played)){
    archiveCurrentSeason();
  }

  const newMatches = generateRoundRobin(selectedTeams);
  league = {
    league: {
      name: league?.league?.name || "FC 27 Liga",
      season: seasonName,
      status: "draft", // DRAFT mode until Start Season is clicked!
      format: "Single Round Robin",
      teams: selectedTeams,
      points: league?.league?.points || { win: 3, draw: 1, loss: 0 },
      createdAt: new Date().toISOString()
    },
    matches: newMatches,
    historySeasons: league?.historySeasons || []
  };

  viewingSeason = "current";
  closeCreateSeasonModal();

  persist(`Musim baru "${seasonName}" berhasil dibuat dengan status DRAFT! Anda masih dapat menambah pemain sebelum klik Start Season.`);
}

/* ==========================================================================
   DRAFT MODE: ADD PLAYER BEFORE SEASON STARTS
   ========================================================================== */
function openAddPlayerDraftModal(){
  const active = getActiveSeasonData();
  if(active.isArchive || active.status !== "draft"){
    alert("Pemain hanya dapat ditambah saat status musim DRAFT (belum berjalan).");
    return;
  }

  $("#draftNewPlayerName").value = "";
  $("#draftAddPlayerPin").value = "";
  $("#draftAddPlayerPinError").style.display = "none";

  const modal = $("#addPlayerDraftModal");
  modal.hidden = false;
  requestAnimationFrame(() => {
    modal.classList.add("show");
    $("#draftNewPlayerName").focus();
  });
}

function closeAddPlayerDraftModal(){
  const modal = $("#addPlayerDraftModal");
  modal.classList.remove("show");
  setTimeout(() => { modal.hidden = true; }, 200);
}

function executeAddPlayerDraft(){
  const name = $("#draftNewPlayerName").value.trim();
  const pin = $("#draftAddPlayerPin").value.trim();
  const errBox = $("#draftAddPlayerPinError");

  if(!name){
    alert("Masukkan nama pemain baru.");
    return;
  }

  if(league.league.teams.some(t => t.toLowerCase() === name.toLowerCase())){
    alert(`Pemain "${name}" sudah terdaftar di musim ini.`);
    return;
  }

  if(pin !== ADMIN_PIN){
    errBox.style.display = "block";
    errBox.textContent = "PIN salah! Gunakan PIN 1203.";
    $("#draftAddPlayerPin").classList.add("shake");
    setTimeout(() => $("#draftAddPlayerPin").classList.remove("shake"), 400);
    $("#draftAddPlayerPin").focus();
    return;
  }

  league.league.teams.push(name);
  league.matches = generateRoundRobin(league.league.teams);
  closeAddPlayerDraftModal();

  persist(`Pemain "${name}" berhasil ditambahkan ke ${league.league.season}! Jadwal telah diacak ulang.`);
}

/* ==========================================================================
   START SEASON & FINISH SEASON LIFECYCLE
   ========================================================================== */
function promptStartSeason(){
  const enteredPin = prompt("🔐 Konfirmasi PIN Admin (1203) untuk memulai musim ini:\n\nSetelah dimulai, status musim menjadi BERJALAN dan skor pertandingan dapat diinput.");
  if(enteredPin === null) return;

  if(enteredPin.trim() !== ADMIN_PIN){
    alert("PIN salah! Gunakan PIN 1203.");
    return;
  }

  league.league.status = "active";
  league.league.startedAt = new Date().toISOString();
  persist(`🚀 ${league.league.season} RESMI DIMULAI! Skor pertandingan kini dapat diinput.`);
}

function promptFinishSeason(){
  const enteredPin = prompt("🏁 Konfirmasi PIN Admin (1203) untuk menyelesaikan musim ini:\n\nMusim akan berstatus SELESAI dan diarsipkan ke Riwayat Season.");
  if(enteredPin === null) return;

  if(enteredPin.trim() !== ADMIN_PIN){
    alert("PIN salah! Gunakan PIN 1203.");
    return;
  }

  league.league.status = "completed";
  league.league.completedAt = new Date().toISOString();
  archiveCurrentSeason();

  persist(`🏁 ${league.league.season} resmi diselesaikan dan diarsipkan!`);
  setTimeout(() => {
    openCreateSeasonModal();
  }, 400);
}

/* ==========================================================================
   PERSISTENCE & FIREBASE REALTIME DATABASE
   ========================================================================== */
async function persist(message="Hasil pertandingan tersimpan."){
  normalizeLeagueData();
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

  // Season Switcher dropdown
  $("#seasonSelect").addEventListener("change", e => {
    const val = e.target.value;
    viewingSeason = val === "current" ? "current" : parseInt(val, 10);
    selectedPlayer = null;
    render();
  });

  // Header "Buat Season Baru" button
  $("#openCreateSeasonModalBtn").addEventListener("click", openCreateSeasonModal);

  // Create Season Modal Events
  $("#closeNextSeasonBtn").addEventListener("click", closeCreateSeasonModal);
  $("#cancelNextSeasonBtn").addEventListener("click", closeCreateSeasonModal);
  $("#nextSeasonModal").addEventListener("click", e => {
    if(e.target === $("#nextSeasonModal")) closeCreateSeasonModal();
  });

  // Player selection checklist events
  $("#participatingPlayersList").addEventListener("click", e => {
    const chip = e.target.closest(".player-select-chip");
    if(!chip) return;
    const playerName = chip.dataset.playerName;
    const checkbox = chip.querySelector('input[type="checkbox"]');

    if(e.target !== checkbox){
      checkbox.checked = !checkbox.checked;
    }

    if(checkbox.checked){
      createSeasonSelected.add(playerName);
      chip.classList.add("selected");
    } else {
      createSeasonSelected.delete(playerName);
      chip.classList.remove("selected");
    }
    updateSelectionSummary();
  });

  $("#selectAllPlayersBtn").addEventListener("click", () => {
    createSeasonSelected = new Set(createSeasonAllPlayers);
    renderParticipatingPlayers();
  });

  $("#deselectAllPlayersBtn").addEventListener("click", () => {
    createSeasonSelected.clear();
    renderParticipatingPlayers();
  });

  $("#addTeamBtn").addEventListener("click", addNewPlayerToSelection);
  $("#newTeamInput").addEventListener("keydown", e => {
    if(e.key === "Enter"){
      e.preventDefault();
      addNewPlayerToSelection();
    }
  });

  $("#confirmNextSeasonBtn").addEventListener("click", executeCreateSeason);
  $("#createSeasonPinInput").addEventListener("keydown", e => {
    if(e.key === "Enter"){
      e.preventDefault();
      executeCreateSeason();
    }
  });

  // Draft Add Player Modal Events
  $("#closeAddPlayerDraftBtn").addEventListener("click", closeAddPlayerDraftModal);
  $("#cancelAddPlayerDraftBtn").addEventListener("click", closeAddPlayerDraftModal);
  $("#addPlayerDraftModal").addEventListener("click", e => {
    if(e.target === $("#addPlayerDraftModal")) closeAddPlayerDraftModal();
  });
  $("#confirmAddPlayerDraftBtn").addEventListener("click", executeAddPlayerDraft);
  $("#draftAddPlayerPin").addEventListener("keydown", e => {
    if(e.key === "Enter"){
      e.preventDefault();
      executeAddPlayerDraft();
    }
  });

  // Randomize matches event
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

  // Performance Tracker (Panel 4) delegated events
  const notifContainer = $("#notifications");
  if(notifContainer){
    notifContainer.addEventListener("click", e => {
      const sBtn = e.target.closest(".perf-season-btn");
      if(sBtn){
        const sId = sBtn.dataset.seasonId;
        perfSelectedSeason = sId === "current" || sId === "all" ? sId : parseInt(sId, 10);
        renderNotifications();
        return;
      }

      const fBtn = e.target.closest(".perf-filter-btn");
      if(fBtn){
        perfCategoryFilter = fBtn.dataset.filterKey;
        renderNotifications();
        return;
      }

      const card = e.target.closest(".player-perf-card");
      if(card && card.dataset.playerName){
        openPlayerModal(card.dataset.playerName);
      }
    });
  }

  // Global ESC Key Handler
  document.addEventListener("keydown", e => {
    if(e.key === "Escape"){
      if(!$("#pinModal").hidden) closePinModal();
      if(!$("#editScoreModal").hidden) closeEditScoreModal();
      if(!$("#playerModal").hidden) closePlayerModal();
      if(!$("#nextSeasonModal").hidden) closeCreateSeasonModal();
      if(!$("#addPlayerDraftModal").hidden) closeAddPlayerDraftModal();
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
        normalizeLeagueData();
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
   SECRET ADMIN FIREBASE UPLOAD (Hanya Lewat URL Khusus ?upload=1203)
   ========================================================================== */
function checkSecretUrlTrigger(){
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const secretKey = urlParams.get("upload") || urlParams.get("upload_firebase") || urlParams.get("admin_upload");

    if(secretKey === ADMIN_PIN){
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
  const confirmed = confirm("🔐 [Secret Admin Trigger: PIN 1203 Terverifikasi]\n\nApakah Anda ingin meng-upload seluruh data liga.json terbaru ke cloud Firebase Realtime Database sekarang?");
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
      normalizeLeagueData();
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

window.uploadFirebase = function(pin){
  if(pin === ADMIN_PIN){
    executeSecretFirebaseUpload();
  } else {
    alert("PIN salah! Gunakan PIN 1203.");
  }
};

boot();
