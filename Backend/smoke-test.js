const BASE = 'http://localhost:5000/api';
const qs = ['Was bedeutet Treu und Glauben?','Wie gründet man eine GmbH?','Was ist Schadensersatz?','Was ist eine Prokura?','Was besagt Art. 3 GG?','Was ist Notwehr?','Was ist Körperverletzung?','Was ist eine einstweilige Verfügung?','Wann darf die Polizei durchsuchen?','Was ist das Mahnverfahren?'];
async function getToken(){
  const r = await fetch(BASE+'/auth/guest',{method:'POST',headers:{'Content-Type':'application/json'}});
  const d = await r.json();
  return d.token || d.accessToken || (d.data && d.data.token);
}
async function t(){
  let token = await getToken();
  console.log('Got token\n');
  let p = 0;
  for(const q of qs){
    const r = await fetch(BASE+'/chat/query',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({question:q})});
    let d = await r.json();
    if(d.code === 'SESSION_LIMIT' || d.code === 'TOKEN_EXHAUSTED'){
      token = await getToken();
      const r2 = await fetch(BASE+'/chat/query',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({question:q})});
      d = await r2.json();
    }
    const a = (d.answer||d.response||d.content||d.message||(d.data&&d.data.answer)||JSON.stringify(d)).substring(0,150);
    const ok = !a.includes('Authentication') && !a.includes('"success":false') && !a.includes('Präzisierung') && a.length > 50;
    if(ok) p++;
    console.log((ok?'OK':'FAIL')+' '+q);
    console.log('  '+a.substring(0,100));
  }
  console.log('\nScore:'+p+'/10');
}
t();
