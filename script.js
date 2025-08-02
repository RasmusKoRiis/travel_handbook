/* ─────────────────────────  CONFIG  ───────────────────────── */
const CITIES       = ['Utopia', 'Osaka', 'Hong Kong'];   // add more JSONs here
const DATA_DIR     = 'data';                             // folder for city JSON
const GUMROAD_USER = 'rasmuskoriis';                     // ← your Gumroad user-name
/* ───────────────────────────────────────────────────────────── */

/* ---------- Gumroad product-ID map (slug → product_id) ------ */
/* copy the “product_id” string from the sample-key block on    */
/* each product’s *Content* tab and paste it here               */
const PRODUCT_ID = {
  osaka:    'FOdyJTAQL7WoDm_T6ds1Xg==',
  hongkong: 'PUT-HK-PRODUCT_ID-HERE'
  // tokyo: '…'  ← add more when you sell new cities
};


/* direct checkout URLs – easiest to share & always valid */
const PRODUCT_URL = {
  osaka:    'https://rasmuskoriis.gumroad.com/l/osaka',      // ← copy from Product ▸ Share
  hongkong: 'https://rasmuskoriis.gumroad.com/l/hongkong'
  // tokyo: 'https://…'
};

/* ------------------------------------------------------------ */

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

/* ---------- Helpers ---------- */
const R=6371000, toRad=d=>d*Math.PI/180;
const dist=(aLat,aLng,bLat,bLng)=>{
  const dφ=toRad(bLat-aLat), dλ=toRad(bLng-aLng);
  const h=Math.sin(dφ/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dλ/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)));
};
const fmt=m=>m==null?'—':m<100?`${m} m`:`${(m/1000).toFixed(1)} km`;

function toggleIntroUI(isIntro){
  document.getElementById('filters').style.display = isIntro ? 'none':'flex';
  searchInput.style.display = isIntro ? 'none':'block';
}

/* ---------- Licence helpers ---------- */
const cacheKey = slug => `license-${slug}`;

function isUnlocked(slug){
  if (slug==='utopia') return true;                 // demo city
  return !!localStorage.getItem(cacheKey(slug));    // cached & verified before
}

async function verifyLicense(slug, key){
  const pid = PRODUCT_ID[slug];
  if (!pid) { console.warn('No product_id for', slug); return false; }

  try{
    const res = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_id: pid,
        license_key: key,
        increment_uses_count: 'false'
      })
    }).then(r=>r.json());

    return res.success;
  }catch(e){
    console.error('Gumroad API', e);
    return false;
  }
}

/* ---------- GATE + LOAD ---------- */
function resetFilter(){
  activeFilter=''; filterBtns.forEach(b=>b.classList.remove('active'));
}

async function gateAndLoad(city){
  const slug = city.toLowerCase().replace(/\s+/g,'');

  /* already verified earlier? */
  if (isUnlocked(slug)){
    buyBtn.classList.add('hidden'); unlockBtn.classList.add('hidden');
    resetFilter();
    return fetchJSON(slug, city);
  }

  /* locked: blank list + buttons */
  PLACES=[]; render();
  buyBtn.classList.remove('hidden'); unlockBtn.classList.remove('hidden');

  buyBtn.onclick = () => {
    const url = PRODUCT_URL[slug] || `https://gumroad.com/${GUMROAD_USER}/${slug}`;
    window.open(url, '_blank', 'noopener');
  };

  unlockBtn.onclick = async ()=>{
    const key = prompt('Paste your Gumroad license key:')?.trim();
    if (!key) return;

    unlockBtn.textContent = 'Checking…';
    const ok = await verifyLicense(slug, key);
    unlockBtn.textContent = 'I have a code 🔑';

    if (ok){
      localStorage.setItem(cacheKey(slug), key);
      buyBtn.classList.add('hidden'); unlockBtn.classList.add('hidden');
      gateAndLoad(city);                    // reload now unlocked
    }else{
      alert('That key is not valid for this city.');
    }
  };
}

async function fetchJSON(slug,city){
  try{
    const data=await fetch(`${DATA_DIR}/${slug}.json`).then(r=>{
      if(!r.ok) throw new Error('missing JSON'); return r.json();
    });
    PLACES = data.map(p=>{
      let lat=null, lon=null;
      if (p.latlng){                     /* real guide entries */
        [lat,lon] = p.latlng.split(',').map(n=>Number(n.trim()));
      }
      return {...p, city, latitude:lat, longitude:lon};
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
    const show = PLACES.filter(p=>{
        if (p.city !== currentCity) return false;
  
        /* category filter */
        const catOK = !activeFilter ||
          (p.category && p.category.trim().toLowerCase() === activeFilter);
  
        /* search bar */
        const q = searchTerm;
        const searchOK = !q ||
          p.name.toLowerCase().includes(q) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.comment  && p.comment.toLowerCase().includes(q));
  
        return catOK && searchOK;
      })
       .map(p=>{
         const useDist = Number.isFinite(p.latitude) && Number.isFinite(p.longitude);
         const d = (userPos && useDist) ? dist(userPos.lat,userPos.lng,p.latitude,p.longitude) : null;
         const m = d != null ? Math.round(d/1000*12) : null;
  
         const commentHTML = p.comment
           ? `<div class="comment">${p.comment.replace(/\n/g,'<br>')}</div>`
           : '';
  
         return {...p,distance:d,minutes:m,commentHTML};
       })
       .sort((a,b)=>(a.distance ?? 1e9) - (b.distance ?? 1e9));
  
     listWrap.innerHTML = show.map(p=>`
       <li class="place-item">
         <a class="place-link"
            href="https://www.google.com/maps?q=${p.latitude},${p.longitude}"
            target="_blank" rel="noopener">
           <div class="place-title">${p.name}</div>
           ${p.link
              ? `<span class="ext-icon"
                     onclick="event.stopPropagation();
                              window.open('${p.link}','_blank','noopener');">🟡</span>`
              : ''}
           ${
              /* ───── meta line only when something to show ───── */
              (p.category || p.distance!=null)
                ? `<span class="place-meta">
                     ${p.category ? `<span class="cat">${p.category}</span>` : ''}
                     ${p.category && p.distance!=null ? ' • ' : ''}
                     ${p.distance!=null ? `📍 ${fmt(p.distance)} • ${p.minutes} min` : ''}
                   </span>`
                : ''
           }
           ${p.commentHTML}
         </a>
       </li>`).join('');
  }
  


/* ---------- Events ---------- */
function bindEvents(){
  citySel.addEventListener('change', e=>{
    currentCity=e.target.value; resetFilter(); gateAndLoad(currentCity);
  });
  filterBtns.forEach(btn=>{
    btn.addEventListener('click',()=>{
      const cat = btn.dataset.cat.trim().toLowerCase();     // ← normalise once
      activeFilter = activeFilter === cat ? '' : cat;
      filterBtns.forEach(b =>
        b.classList.toggle('active', b.dataset.cat.trim().toLowerCase() === activeFilter)
      );
      render();
    });
  });
  searchInput.addEventListener('input',e=>{searchTerm=e.target.value.trim().toLowerCase();render();});
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
function init(){ populateCities(); bindEvents(); askLocation(); gateAndLoad(currentCity); }
init();
