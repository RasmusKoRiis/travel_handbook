/* ─────────────────────────  CONFIG  ───────────────────────── */
const CITIES       = ['Utopia', 'Osaka', 'Hong Kong'];   // add more JSONs here
const DATA_DIR     = 'data';                             // folder for city JSON
const GUMROAD_USER = 'YOUR_ACCOUNT';                     // Gumroad user
/* ───────────────────────────────────────────────────────────── */

/* ---------- DOM refs ---------- */
const citySel   = document.getElementById('citySelect');
const filterBtns= [...document.querySelectorAll('.filter-btn')];
const listWrap  = document.getElementById('placeList');
const geoBanner = document.getElementById('geoBanner');
const retryBtn  = document.getElementById('retryGeo');
const searchInput = document.getElementById('searchInput');
const buyBtn    = document.getElementById('buyBtn');
const unlockBtn = document.getElementById('unlockBtn');

/* ---------- State ---------- */
let PLACES=[], currentCity='', activeFilter='', userPos=null, searchTerm='';

/* ---------- Prefix table ---------- */
let CODE_PREFIX={};
fetch('codes.json')
  .then(r=>r.ok?r.json():{})
  .then(obj=>{ CODE_PREFIX=obj; gateAndLoad(currentCity); })
  .catch(()=>console.warn('codes.json missing – all cities free'));

/* ---------- Helpers ---------- */
const R=6371000, toRad=d=>d*Math.PI/180;
const dist=(aLat,aLng,bLat,bLng)=>{
  const dφ=toRad(bLat-aLat), dλ=toRad(bLng-aLng);
  const h=Math.sin(dφ/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dλ/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)));
};
const fmt=m=>m==null?'—':m<100?`${m} m`:`${(m/1000).toFixed(1)} km`;
const hasCode=slug=>{
  if(slug==='utopia') return true;
  const pre=CODE_PREFIX[slug]; if(!pre) return false;
  return (localStorage.getItem(`code-${slug}`)||'').startsWith(pre);
};

function resetFilter(){
  activeFilter = '';
  filterBtns.forEach(b => b.classList.remove('active'));
}

/* ---------- GATE + LOAD ---------- */
async function gateAndLoad(city){
  const slug=city.toLowerCase().replace(/\s+/g,'');
  if(hasCode(slug)){                   /* unlocked */
    resetFilter();
    buyBtn.classList.add('hidden'); unlockBtn.classList.add('hidden');
    return fetchJSON(slug,city);
  }
  /* locked */
  PLACES=[]; render();
  buyBtn.classList.remove('hidden'); unlockBtn.classList.remove('hidden');
  buyBtn.onclick=()=>window.open(`https://gumroad.com/${GUMROAD_USER}/${slug}`,'_blank');
}
async function fetchJSON(slug,city){
  try{
    const data=await fetch(`${DATA_DIR}/${slug}.json`).then(r=>{
      if(!r.ok) throw new Error('missing JSON'); return r.json();
    });
    PLACES=data.map(p=>{
      const [lat,lon]=p.latlng.split(',').map(n=>Number(n.trim()));
      return {...p,city,latitude:lat,longitude:lon};
    });
    render();
  }catch(e){
    listWrap.innerHTML=`<li style="padding:1rem">Missing ${DATA_DIR}/${slug}.json</li>`;
  }
}

/* ---------- UI ---------- */
function populateCities(){
  citySel.innerHTML=CITIES.map(c=>`<option value="${c}">${c.toUpperCase()}</option>`).join('');
  currentCity=CITIES[0];
}
function render(){
  const show=PLACES.filter(p=>
      p.city===currentCity &&
      (!activeFilter||p.category===activeFilter) &&
      (!searchTerm||
        p.name.toLowerCase().includes(searchTerm)||
        p.category.toLowerCase().includes(searchTerm)||
        (p.comment&&p.comment.toLowerCase().includes(searchTerm))
      ))
    .map(p=>{
      const d=userPos?dist(userPos.lat,userPos.lng,p.latitude,p.longitude):null;
      const m=d!=null?Math.round(d/1000*12):null;
      return {...p,distance:d,minutes:m};
    })
    .sort((a,b)=>(a.distance??1e9)-(b.distance??1e9));
  listWrap.innerHTML=show.map(p=>`
    <li class="place-item">
      <a class="place-link" href="https://www.google.com/maps?q=${p.latitude},${p.longitude}" target="_blank" rel="noopener">
        <div class="place-title">${p.name}</div>
        ${p.link?`<span class="ext-icon" onclick="event.stopPropagation();window.open('${p.link}','_blank','noopener');">🔗</span>`:''}
        <span class="place-meta"><span class="cat">${p.category}</span> • ${
          p.distance!=null?`📍 ${fmt(p.distance)} • ${p.minutes} min`:'📍 —'}</span>
      </a>
    </li>`).join('');
}

/* ---------- Events ---------- */
function bindEvents(){
  citySel.addEventListener('change', e => {
    currentCity = e.target.value;
    resetFilter();                // clear 🐾
    gateAndLoad(currentCity);     // then load / gate
  });
  filterBtns.forEach(btn=>{
    btn.addEventListener('click',()=>{
      const cat=btn.dataset.cat;
      activeFilter=activeFilter===cat?'':cat;
      filterBtns.forEach(b=>b.classList.toggle('active',b.dataset.cat===activeFilter));
      render();
    });
  });
  searchInput.addEventListener('input',e=>{searchTerm=e.target.value.trim().toLowerCase();render();});

  /* UNLOCK always available */
  unlockBtn.addEventListener('click',()=>{
    const slug=currentCity.toLowerCase().replace(/\s+/g,'');
    const code=prompt('Paste your access code:')||'';
    if(!code) return;
    if(code.startsWith((CODE_PREFIX[slug]||''))){
      localStorage.setItem(`code-${slug}`,code);
      buyBtn.classList.add('hidden'); unlockBtn.classList.add('hidden');
      gateAndLoad(currentCity);
    }else alert('Invalid code – please check your Gumroad e-mail.');
  });
}

/* ---------- Geo ---------- */
function showGeoBanner(s=true){geoBanner.classList.toggle('hidden',!s);}
function askLocation(){
  if(!navigator.geolocation){showGeoBanner(true);render();return;}
  navigator.geolocation.getCurrentPosition(
    p=>{userPos={lat:p.coords.latitude,lng:p.coords.longitude};showGeoBanner(false);render();},
    ()=>{showGeoBanner(true);render();},
    {enableHighAccuracy:true,timeout:8000,maximumAge:30000});
}
retryBtn.addEventListener('click',askLocation);

/* ---------- Boot ---------- */
function init(){
  populateCities(); bindEvents(); askLocation(); gateAndLoad(currentCity);
}
init();
