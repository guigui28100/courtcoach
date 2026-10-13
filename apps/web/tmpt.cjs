const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const U='http://localhost:5173', H={Origin:U}, S=process.env.S;
const lum=(c)=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
function measureFn(){
  const parse=s=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return[0,0,0,0];const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return[p[0],p[1],p[2],p.length>3?p[3]:1]};
  const bgOf=(el)=>{let layers=[];let n=el;while(n&&n.nodeType===1){const cs=getComputedStyle(n);if(cs.backgroundImage&&cs.backgroundImage!=='none')return{grad:true};const c=parse(cs.backgroundColor);if(c[3]>0){layers.push(c);if(c[3]>=0.99)break}n=n.parentElement}
    let base=[255,255,255];for(let i=layers.length-1;i>=0;i--){const c=layers[i];base=[0,1,2].map(k=>c[k]*c[3]+base[k]*(1-c[3]))}return{rgb:base}};
  return {parse,bgOf};
}
async function measure(el){return el.evaluate((node)=>{
  const parse=s=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return[0,0,0,1];const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return[p[0],p[1],p[2],p.length>3?p[3]:1]};
  const bgOf=(el)=>{let layers=[];let n=el;while(n&&n.nodeType===1){const cs=getComputedStyle(n);if(cs.backgroundImage&&cs.backgroundImage!=='none')return{grad:true};const c=parse(cs.backgroundColor);if(c[3]>0){layers.push(c);if(c[3]>=0.99)break}n=n.parentElement}
    let base=[255,255,255];for(let i=layers.length-1;i>=0;i--){const c=layers[i];base=[0,1,2].map(k=>c[k]*c[3]+base[k]*(1-c[3]))}return{rgb:base}};
  const out=[];const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let t;while(t=walker.nextNode()){if(!t.textContent.trim())continue;const el=t.parentElement;const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.opacity==='0')continue;const col=parse(cs.color);const bg=bgOf(el);if(bg.grad)continue;const a=col[3];const fg=[0,1,2].map(k=>col[k]*a+bg.rgb[k]*(1-a));out.push({fg,bg:bg.rgb,txt:t.textContent.trim().slice(0,28)})}
  return out;});}
async function auditPage(page,label,report){
  const sel='button, a[href], [role=tab], summary';
  const els=await page.$$(sel);let n=0;
  for(const el of els){
    if(n>150)break;
    const ok=await el.evaluate(e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>4&&r.height>4&&cs.visibility!=='hidden'&&cs.display!=='none'&&!e.disabled&&(e.innerText||'').trim().length>0});
    if(!ok)continue;n++;
    let before;try{await page.mouse.move(0,0);before=await measure(el);await el.scrollIntoViewIfNeeded({timeout:1500});await el.hover({timeout:1500,force:false});await page.waitForTimeout(260);}catch(e){continue}
    const after=await measure(el);
    for(let i=0;i<Math.min(before.length,after.length);i++){
      const cb=cr(before[i].fg,before[i].bg), ca=cr(after[i].fg,after[i].bg);
      if(ca<3 && ca<cb-0.4){report.push({label,txt:after[i].txt,before:cb.toFixed(2),after:ca.toFixed(2),cls:await el.evaluate(e=>(e.className||'').toString().slice(0,90))});break}
    }
  }
  return n;
}
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});const page=await ctx.newPage();page.on('dialog',d=>d.dismiss());
  const C=async(m,path,data)=>{const r=await ctx.request[m](U+'/api'+path,{data,headers:H});if(!r.ok())throw new Error(m+path+r.status()+await r.text());return r.status()===204?null:r.json().catch(()=>null)};
  await C('post','/auth/login',{email:'coach@test.fr',password:'MotDePasse-Test-2026!'});
  let list=await C('get','/players');
  if(!list.length){await page.goto(U+'/coach/centre');await page.click('summary:has-text("Pour essayer")');await page.click('button:has-text("fin de trimestre")');await page.waitForURL(/\/apercu$/,{timeout:25000});
   const kid=await C('post','/players',{firstName:'Mia',lastName:'Exemple',birthDate:'2017-05-02'});await C('post',`/players/${kid.id}/goals`,{season:'2026-2027',axis:'TECHNIQUE',title:'Service : lancer de balle'});list=await C('get','/players');}
  console.log(list.map(p=>[p.id,p.firstName,p.birthDate]));
  const teen=list.find(p=>p.firstName==='Léo')||list[0], kid=list.find(p=>p.firstName==='Mia')||list[list.length-1];
  const report=[];const tabs=['profil','depart','objectifs','evaluations','etoiles','videos','matchs','bulletins','accords'];
  const pages=[['/coach'],['/coach/adultes'],['/coach/adultes?onglet=videos'],['/coach/adultes?onglet=historique'],['/coach/adultes/apercu'],['/coach/adultes/apercu?onglet=videos'],['/coach/adultes/apercu?onglet=profil'],['/coach/centre'],...['joueurs','videos','bulletins','tournois','dossiers','entraineurs'].map(t=>['/coach/centre?onglet='+t]),...tabs.map(t=>[`/coach/centre/${teen.id}?onglet=${t}`]),['/coach/centre/fin-de-cours'],['/coach/securite']];
  for(const [u] of pages){await page.goto(U+u);await page.waitForTimeout(1200);const n=await auditPage(page,u,report);console.log(u,n,'elements')}
  // aperçus jeune : 2 âges x 2 modes x onglets
  for(const [who,pl] of [['ado',teen],['petit',kid]])for(const mode of ['dark','light']){
    await page.addInitScript((m)=>{try{localStorage.setItem('cc-theme',m)}catch(e){}},mode);
    for(const t of ['','missions','videos','matchs','progres','bulletins','depart','compte']){const u=`/coach/centre/${pl.id}/apercu${t?`?onglet=${t}`:''}`;await page.goto(U+u);await page.evaluate((m)=>{try{localStorage.setItem('cc-theme',m)}catch(e){}},mode);await page.reload();await page.waitForTimeout(1300);const n=await auditPage(page,`${who}/${mode} ${t||'accueil'}`,report);console.log(who,mode,t||'accueil',n)}
  }
  console.log(JSON.stringify(report,null,1));
  await b.close();
})();
