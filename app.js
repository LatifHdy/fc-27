const DATA_URL = "liga.json";
let league = null;
let filter = "pending";
let selectedPlayer = null;
let currentModalPlayer = null;

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const initials = n => n.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();

async function boot(){
  try{
    const r = await fetch(DATA_URL + "?v=" + Date.now());
    league = await r.json();
  }catch(e){
    const saved = localStorage.getItem("fc27-liga");
    league = saved ? JSON.parse(saved) : {league:{name:"FC 27 Liga",teams:[]},matches:[]};
  }
  if(league && Array.isArray(league.matches)){
    league.matches = organizeMatches(league.matches, false);
  }
  render();
}

function table(){
  const rows = Object.fromEntries(league.league.teams.map(t=>[t,{name:t,mp:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0}]));
  league.matches.forEach(m=>{
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

function getPlayerDetails(playerName){
  const rows = table();
  const rankIndex = rows.findIndex(r => r.name.toLowerCase() === playerName.toLowerCase());
  const stats = rankIndex >= 0 ? rows[rankIndex] : { mp:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, pts:0 };
  const rankNumber = rankIndex >= 0 ? rankIndex + 1 : "-";

  const playedMatches = league.matches.filter(m => m.played && (
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

  const pendingMatches = league.matches.filter(m => !m.played && (
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
      <div class="history-card">
        <div class="history-teams">
          <span class="${m.isHome ? 'is-self' : ''}">${esc(m.home)}</span>
          <span class="history-score">${m.homeScore} - ${m.awayScore}</span>
          <span class="${!m.isHome ? 'is-self' : ''}">${esc(m.away)}</span>
        </div>
        <span class="history-badge ${m.result}">
          ${m.result === 'win' ? 'MENANG' : m.result === 'loss' ? 'KALAH' : 'SERI'}
        </span>
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
    const matchesSection = $(".matches-card");
    if(matchesSection) {
      matchesSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

function getLeagueNotifications(){
  const rows = table();
  const notes = [];
  if(!rows.length) return notes;

  const first = rows[0];
  const last = rows[rows.length-1];

  notes.push({
    type:"king",
    title:"THRONE KING",
    text:`${first.name} sedang memimpin liga sebagai Juara 1.`
  });

  if(first.name.toLowerCase() === "teguh"){
    notes.push({
      type:"teguh",
      title:"SUDAH BIASA",
      text:"Teguh kembali duduk di nomor 1. Sudah biasa."
    });
  }

  if(rows.length >= 5){
    const zone = rows.slice(0,5).map(x=>x.name).join(", ");
    notes.push({
      type:"zonkou",
      title:"AREA ZONKOU",
      text:`5 besar saat ini: ${zone}.`
    });
  }

  if(last && last.name){
    notes.push({
      type:"danger",
      title:"ZONA DEGRADASI",
      text:`${last.name} saat ini berada di posisi ${rows.length}. Waktunya bangkit!`
    });
  }
  return notes;
}

function renderNotifications(){
  const notes = getLeagueNotifications();
  $("#notifications").innerHTML = `
    <div class="notice-head">
      <div><div class="eyebrow dark">LEAGUE ALERTS</div><h3>Notifikasi Liga</h3></div>
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

function render(){
  const teamCount = league?.league?.teams?.length || 0;
  const matchCount = league?.matches?.length || 0;
  if($("#leagueSummaryTitle")) $("#leagueSummaryTitle").innerHTML = `${teamCount} pemain.<br><strong>1 juara.</strong>`;
  if($("#totalMatchesStat")) $("#totalMatchesStat").textContent = matchCount;
  if($("#totalTeamsStat")) $("#totalTeamsStat").textContent = teamCount;

  renderStandings(); renderLeaders(); renderMatches(); renderNotifications();
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
    const pendingMatchesOfPlayer = league.matches.filter(m => !m.played && (
      m.home.toLowerCase() === selectedPlayer.toLowerCase() ||
      m.away.toLowerCase() === selectedPlayer.toLowerCase()
    ));
    banner.style.display = "flex";
    banner.innerHTML = `
      <div class="highlight-banner-text">
        <span>🎯 Menampilkan sisa pertandingan:</span>
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

  // Pertandingan yang sudah selesai TIDAK muncul di bawah!
  // Match center hanya menampilkan pertandingan yang belum dimainkan (!m.played).
  const ordered = organizeMatches(league.matches, false);
  let list = ordered.filter(m => !m.played);

  if(filter === "others"){
    list = list.filter(m => !isSwasMatch(m));
  } else if(filter === "swas"){
    list = list.filter(m => isSwasMatch(m));
  }

  if(list.length === 0){
    $("#matches").innerHTML = `<div class="empty-notice" style="grid-column:1/-1;padding:35px 20px;background:#fff;border-radius:14px;border:1px dashed var(--line);font-size:13px">Semua pertandingan pada daftar ini sudah selesai dimainkan! Silakan cek riwayat skor di tabel klasemen atas. 🎉</div>`;
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

function saveMatch(id){
  const card = document.querySelector(`[data-save="${id}"]`).parentElement;
  const inputs = card.querySelectorAll(".score");
  const hs = inputs[0].value.trim(), as = inputs[1].value.trim();
  if(hs===""||as===""||+hs<0||+as<0){alert("Masukkan skor kandang dan tandang.");return}
  const m = league.matches.find(x=>x.id===+id);
  m.homeScore = +hs; m.awayScore = +as; m.played = true;
  persist("Hasil tersimpan! Pertandingan berpindah ke riwayat klasemen.");
}

function persist(message="Hasil tersimpan. Klik “Simpan JSON” untuk memperbarui file liga.json."){
  localStorage.setItem("fc27-liga",JSON.stringify(league));
  render();
  toast(message);
}

function toast(msg){
  let t=document.querySelector(".toast"); if(!t){t=document.createElement("div");t.className="toast";document.body.appendChild(t)}
  t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800);
}

function downloadJSON(){
  const blob=new Blob([JSON.stringify(league,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="liga.json";a.click();URL.revokeObjectURL(a.href);
}

// Event Listeners
$("#standings").addEventListener("click", e => {
  const tr = e.target.closest("tr");
  if(tr && tr.dataset.player) openPlayerModal(tr.dataset.player);
});

$("#leaders").addEventListener("click", e => {
  const pod = e.target.closest(".pod");
  if(pod && pod.dataset.player) openPlayerModal(pod.dataset.player);
});

$("#modalPendingOpponents").addEventListener("click", e => {
  const chip = e.target.closest("[data-goto-player]");
  if(chip && chip.dataset.gotoPlayer) openPlayerModal(chip.dataset.gotoPlayer);
});

$("#modalCloseBtn").addEventListener("click", closePlayerModal);
$("#playerModal").addEventListener("click", e => {
  if(e.target === $("#playerModal")) closePlayerModal();
});
document.addEventListener("keydown", e => {
  if(e.key === "Escape" && !$("#playerModal").hidden) closePlayerModal();
});

$("#modalHighlightBtn").addEventListener("click", () => {
  if(currentModalPlayer) {
    const p = currentModalPlayer;
    closePlayerModal();
    setPlayerHighlight(p);
  }
});

$("#matches").addEventListener("click", e => {
  const id = e.target.dataset.save;
  if(id) saveMatch(id);
});

document.querySelectorAll(".filter[data-filter]").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".filter[data-filter]").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  filter = b.dataset.filter;
  renderMatches();
}));

$("#exportBtn").addEventListener("click", downloadJSON);
$("#randomBtn").addEventListener("click", randomizeMatches);
$("#importBtn").addEventListener("click", () => $("#fileInput").click());
$("#fileInput").addEventListener("change", e => {
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      league = JSON.parse(r.result);
      if(league && Array.isArray(league.matches)){
        league.matches = organizeMatches(league.matches, false);
      }
      localStorage.setItem("fc27-liga", JSON.stringify(league));
      render();
      toast("liga.json berhasil di-import.");
    } catch {
      alert("File JSON tidak valid.");
    }
  };
  r.readAsText(f);
});

boot();
