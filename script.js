/* --- Load CSV --- */
fetch('places.csv')
  .then(r => r.text())
  .then(csv => init(parseCSV(csv)))
  .catch(e => console.error('CSV load error', e));

/* --- CSV → objects --- */
function parseCSV(txt){
  const lines = txt.trim().split(/\r?\n/);            // handle \n or \r\n
  const keys  = lines.shift().split(';').map(s => s.trim());

  return lines.flatMap(line => {
    if (!line.trim()) return [];                      // skip blank lines

    const cols = line.split(';').map(c => c.trim());
    if (cols.length < keys.length) {                  // not enough columns
      console.warn('CSV row skipped (missing cells):', line);
      return [];
    }

    const obj = {};
    keys.forEach((k, i) => obj[k] = cols[i] || '');

    /* lat / lon from latlng (semicolon file) */
    if (obj.latlng) {
      const [lat, lon] = obj.latlng.split(',').map(s => Number(s.trim()));
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        obj.latitude  = lat;
        obj.longitude = lon;
      } else {
        console.warn('Bad latlng, row skipped:', line);
        return [];                                    // drop the bad row
      }
    } else {
      obj.latitude  = null;
      obj.longitude = null;
    }
    return obj;
  });
}


/* --- DOM refs --- */
const citySel=document.getElementById('citySelect');
const filterBtns=[...document.querySelectorAll('.filter-btn')];
const listWrap=document.getElementById('placeList');
const geoBanner  = document.getElementById('geoBanner');
const retryBtn   = document.getElementById('retryGeo');
const searchInput = document.getElementById('searchInput');   // NEW
let searchTerm = '';   

/* --- State --- */
let PLACES=[],currentCity='',activeFilter='',userPos=null;

/* --- Haversine (m) --- */
const R=6371000,toRad=d=>d*Math.PI/180;
function dist(aLat,aLng,bLat,bLng){
  const dφ=toRad(bLat-aLat),dλ=toRad(bLng-aLng);
  const h=Math.sin(dφ/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dλ/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)));
}

/* --- Init --- */
function init(data){
  PLACES=data; populateCities(); bindEvents(); askLocation(); render();
}

/* --- Dropdown (caps label) --- */
function populateCities(){
  const cities=[...new Set(PLACES.map(p=>p.city))].sort();
  citySel.innerHTML=cities.map(c=>`<option value="${c}">${c.toUpperCase()}</option>`).join('');
  currentCity=cities[0];
}

/* pretty-print distance */
function formatDistance(m) {
  if (m === null) return '—';
  return m < 100
    ? `${m} m`
    : `${(m / 1000).toFixed(1)} km`;
}

/* --- Render list with minutes --- */
function render(){
  const visible=PLACES
  .filter(p =>
    p.city === currentCity &&
    (!activeFilter || p.category === activeFilter) &&
    (!searchTerm ||
      p.name.toLowerCase().includes(searchTerm) ||
      p.category.toLowerCase().includes(searchTerm) ||
      (p.comment && p.comment.toLowerCase().includes(searchTerm))
    )
  )
    .map(p=>{
      const d=userPos?dist(userPos.lat,userPos.lng,p.latitude,p.longitude):null;
      const m=d!=null?Math.round(d/1000*12):null;          // 1000 m ≈ 12 min
      return {...p,distance:d,minutes:m};
    })
    .sort((a,b)=>(a.distance??1e9)-(b.distance??1e9));

    listWrap.innerHTML = visible.map(p => `
        <li class="place-item">
      <a class="place-link"
        href="https://www.google.com/maps?q=${p.latitude},${p.longitude}"
        target="_blank" rel="noopener">
        <div class="place-title">${p.name}</div>
        <span class="place-meta">
          <span class="cat">${p.category}</span> • ${
            p.distance != null
              ? `📍 ${formatDistance(p.distance)} • ${p.minutes} min`
              : '📍 —'
          }
        </span>
      </a>
    </li>`).join('');
}

/* --- Events --- */
function bindEvents(){
  citySel.addEventListener('change',e=>{currentCity=e.target.value;render();});

  filterBtns.forEach(btn=>{
    btn.addEventListener('click',()=>{
      const cat=btn.dataset.cat;
      activeFilter=activeFilter===cat?'':cat;
      filterBtns.forEach(b=>b.classList.toggle('active',b.dataset.cat===activeFilter));
      render();
    });
  });

  /* ✨ dot → expand → collapse */
  searchInput.addEventListener('click', ()=>{
    if(!searchInput.classList.contains('open')){
      searchInput.classList.add('open');
      searchInput.focus();
    }
  });

  searchInput.addEventListener('blur', ()=>{
    if(!searchInput.value.trim()){      // empty → collapse
      searchInput.classList.remove('open');
    }
  });

  /* live filtering */
  searchInput.addEventListener('input', e=>{
    searchTerm = e.target.value.trim().toLowerCase();
    render();
  });
}


/* --- Geo --- */

function showGeoBanner(show=true){
  geoBanner.classList.toggle('hidden', !show);
}

function askLocation(){
  if(!navigator.geolocation){
    showGeoBanner(true);
    render();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos=>{
      userPos={lat:pos.coords.latitude,lng:pos.coords.longitude};
      showGeoBanner(false);   // hide banner
      render();
    },
    err=>{
      console.warn('Geo denied or error', err);
      showGeoBanner(true);    // show banner with retry
      render();
    },
    {enableHighAccuracy:true,timeout:8000,maximumAge:30000}
  );
}

/* hook up the retry button once */
retryBtn.addEventListener('click', askLocation);

