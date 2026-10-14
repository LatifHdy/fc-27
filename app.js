const DATA_URL = "liga.json";
let league = null;
let filter = "all";

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

function randomizeMatches(){
  // Only randomize display/order, never alter home/away teams or saved scores.
  league.matches = shuffle(league.matches);
  persist("Jadwal pertandingan berhasil diacak.");
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

  // Teguh special message whenever Teguh is #1
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
  const rows=table();
  $("#standings").innerHTML=rows.map((x,i)=>`
    <tr>
      <td class="pos ${i===0?'top1':''}">${String(i+1).padStart(2,"0")}</td>
      <td><div class="team-cell"><span class="team-badge">${esc(initials(x.name))}</span><strong>${esc(x.name)}</strong></div></td>
      <td>${x.mp}</td><td>${x.w}</td><td>${x.d}</td><td>${x.l}</td>
      <td>${x.gf}</td><td>${x.ga}</td><td class="diff ${x.gd>0?'pos':x.gd<0?'neg':''}">${x.gd>0?"+":""}${x.gd}</td>
      <td class="pts">${x.pts}</td>
    </tr>`).join("");
}
function renderLeaders(){
  const rows=table();
  const top=rows.slice(0,3);
  const order=[top[1],top[0],top[2]].filter(Boolean);
  $("#leaders").innerHTML=`
    <div class="leaders-title"><h3>TOP OF THE TABLE</h3><span>${top[0]?.pts||0} POINTS LEADER</span></div>
    <div class="podium">${order.map((x,i)=>x?`
      <div class="pod ${i===1?'first':''}">
        <div class="rank">${i===1?'01':i===0?'02':'03'}</div>
        <div class="avatar">${esc(initials(x.name))}</div>
        <b>${esc(x.name)}</b><small>${x.mp} match</small><div class="pts">${x.pts} pts</div>
      </div>`:"").join("")}</div>`;
}
function renderMatches(){
  const list=league.matches.filter(m=>filter==="all"||(filter==="played"?m.played:!m.played));
  $("#matches").innerHTML=list.map(m=>`
    <div class="match ${m.played?'played':''}">
      <div class="side">${esc(m.home)}</div>
      <div class="scorebox">
        <div class="scoreline">
          <input class="score" inputmode="numeric" min="0" type="number" value="${m.played?m.homeScore:""}" placeholder="–" data-id="${m.id}" data-side="home">
          <span class="dash">-</span>
          <input class="score" inputmode="numeric" min="0" type="number" value="${m.played?m.awayScore:""}" placeholder="–" data-id="${m.id}" data-side="away">
        </div>
        <div class="vs">${m.played?'FULL TIME':'VS'}</div>
      </div>
      <div class="side away">${esc(m.away)}</div>
      <button class="save-score" data-save="${m.id}">${m.played?'UPDATE HASIL':'SIMPAN HASIL'}</button>
    </div>`).join("");
}
function saveMatch(id){
  const card=document.querySelector(`[data-save="${id}"]`).parentElement;
  const inputs=card.querySelectorAll(".score");
  const hs=inputs[0].value.trim(), as=inputs[1].value.trim();
  if(hs===""||as===""||+hs<0||+as<0){alert("Masukkan skor kandang dan tandang.");return}
  const m=league.matches.find(x=>x.id===+id);
  m.homeScore=+hs;m.awayScore=+as;m.played=true;
  persist();
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
$("#matches").addEventListener("click",e=>{const id=e.target.dataset.save;if(id)saveMatch(id)});
document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;renderMatches()}));
$("#exportBtn").addEventListener("click",downloadJSON);
$("#randomBtn").addEventListener("click",randomizeMatches);
$("#importBtn").addEventListener("click",()=>$("#fileInput").click());
$("#fileInput").addEventListener("change",e=>{
  const f=e.target.files[0]; if(!f)return;
  const r=new FileReader();r.onload=()=>{try{league=JSON.parse(r.result);localStorage.setItem("fc27-liga",JSON.stringify(league));render();toast("liga.json berhasil di-import.")}catch{alert("File JSON tidak valid.")}};r.readAsText(f);
});
boot();
