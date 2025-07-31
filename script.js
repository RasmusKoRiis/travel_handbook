/* --- Load CSV --- */
fetch('places.csv')
  .then(r => r.text())
  .then(csv => init(parseCSV(csv)))
  .catch(e => console.error('CSV load error', e));

/* --- CSV → objects --- */
function parseCSV(txt){
  const [head,...rows]=txt.trim().split('\n');
  const keys=head.split(',').map(h=>h.trim());
  return rows.map(r=>{
    const v=r.split(',').map(c=>c.trim());
    const obj={}; keys.forEach((k,i)=>obj[k]=v[i]);
    obj.latitude=Number(obj.latitude); obj.longitude=Number(obj.longitude);
    return obj;
  });
}

/* --- DOM refs --- */
const citySel=document.getElementById('citySelect');
const filterBtns=[...document.querySelectorAll('.filter-btn')];
const listWrap=document.getElementById('placeList');
const geoBanner  = document.getElementById('geoBanner');
const retryBtn   = document.getElementById('retryGeo');

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

/* --- Render list with minutes --- */
function render(){
  const visible=PLACES
    .filter(p=>p.city===currentCity && (!activeFilter||p.category===activeFilter))
    .map(p=>{
      const d=userPos?dist(userPos.lat,userPos.lng,p.latitude,p.longitude):null;
      const m=d!=null?Math.round(d/1000*12):null;          // 1000 m ≈ 12 min
      return {...p,distance:d,minutes:m};
    })
    .sort((a,b)=>(a.distance??1e9)-(b.distance??1e9));

    listWrap.innerHTML = visible.map(p => `
        <li class="place-item">
          <a href="https://www.google.com/maps?q=${p.latitude},${p.longitude}"
             target="_blank" rel="noopener">
            ${p.name}
          </a>
          <span class="place-meta">
            <span class="cat">${p.category}</span> • ${
              p.distance != null
                ? `📍 ${p.distance} m • ${p.minutes} min`
                : '📍 —'
            }
          </span>
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

