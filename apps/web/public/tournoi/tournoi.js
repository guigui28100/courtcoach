
(function(){
  var $=function(id){return document.getElementById(id)};
  function el(t,c,h){var e=document.createElement(t);if(c)e.className=c;if(h!=null)e.textContent=h;return e;}
  var BUF=3; // minutes pour changer de côté, s'installer et appeler les joueurs
  var S={dbl:false,n:11,courts:2,dur:38,avail:3,start:"14:00",fmt:"poules",names:[],mode:"jeux",opt:{jeux:"6",points:"9",temps:"20"},durManual:null,ver:0,nsig:"",csig:"",scores:{},pair:"hasard",perm:[],rounds:null,classif:"non"};
  var T=null;
  var FORMATS=[["poules","Poules"],["tmc","TMC"],["ko","Élimination directe"],["ladder","Montante-descendante"]];
  var OPTS={
    jeux:[["1","1 set de 1 jeu",8],["2","1 set de 2 jeux",12],["3","1 set de 3 jeux",16],["4","1 set de 4 jeux",20],["5","1 set de 5 jeux",28],["6","1 set de 6 jeux",35],["2s","2 sets de 6 jeux + super jeu décisif",60]],
    points:[["7","7 points",10],["8","8 points",10],["9","9 points",15],["10","10 points",15],["11","11 points",15],["15","15 points",20]],
    temps:[["10","10 min",10],["15","15 min",15],["20","20 min",20],["25","25 min",25],["30","30 min",30],["40","40 min",40]]};
  function optOf(){return OPTS[S.mode].filter(function(x){return x[0]===S.opt[S.mode];})[0]||OPTS[S.mode][0];}
  function playMin(){return optOf()[2];}
  function unit(){return S.mode==="jeux"?"jeux":"points";}
  function ruleText(){
    var v=S.opt[S.mode],sans="Pas d'avantage : à 40 partout, le point suivant décide.";
    if(S.mode==="jeux"){
      if(v==="1")return "Chaque match se joue en un seul jeu : le premier qui gagne ce jeu gagne le match. "+sans;
      if(v==="6")return "Chaque match se joue en 1 set de 6 jeux : le premier qui gagne 6 jeux a gagné. À 6 jeux partout, un jeu décisif en 7 points. "+sans;
      if(v!=="2s"){var nn=+v;return "Chaque match se joue en 1 set de "+nn+" jeux : le premier qui gagne "+nn+" jeux a gagné. À "+(nn-1)+" jeu"+(nn-1>1?"x":"")+" partout, un dernier jeu décisif en 7 points. "+sans;}
      return "Chaque match se joue en 2 sets de 6 jeux. Si chacun gagne un set, on joue un super jeu décisif en 10 points à la place du 3e set. "+sans;
    }
    if(S.mode==="points")return "Chaque match se joue au premier à "+v+" points : on compte simplement 1, 2, 3… (pas besoin de connaître 15-30-40). À "+(+v-1)+" partout, le point suivant décide. On sert 2 points chacun à tour de rôle"+(S.dbl?" (dans chaque équipe, les deux joueurs servent chacun leur tour)":"")+".";
    return "Chaque match dure "+v+" minutes. On compte les points simplement : 1, 2, 3… Tu lances le chrono quand tous les joueurs sont prêts ; à la sonnerie, on finit le point en cours et celui qui a le plus de points gagne le match. En cas d'égalité : un seul point décisif (en poule, un match nul est possible).";
  }
  function forfaitScore(){return S.mode==="jeux"?(S.opt.jeux==="2s"?"6–0":S.opt.jeux+"–0"):S.mode==="points"?S.opt.points+"–0":"5–0";}

  /* ---------- noms, équipes ---------- */
  function nameAt(i){return (S.names[i]||"").trim()||("Joueur "+(i+1));}
  function newPerm(){var a=[];for(var i=0;i<S.n;i++)a.push(i);for(var k=a.length-1;k>0;k--){var j=Math.floor(Math.random()*(k+1));var t=a[k];a[k]=a[j];a[j]=t;}S.perm=a;}
  function teamOrder(){ // ordre des joueurs, deux par équipe
    var o=[],i;
    if(S.pair==="hasard"){if(S.perm.length!==S.n)newPerm();return S.perm.slice();}
    if(S.pair==="libre"){if(S.perm.length!==S.n){S.perm=[];for(i=0;i<S.n;i++)S.perm.push(i);}return S.perm.slice();}
    if(S.pair==="equi"){for(i=0;i<Math.floor(S.n/2);i++)o.push(i,S.n-1-i);return o;}
    for(i=0;i<S.n;i++)o.push(i);return o;
  }
  function teams(){var o=teamOrder(),t=[];for(var j=0;j+1<o.length;j+=2)t.push([o[j],o[j+1]]);return t;}
  function entrants(){
    if(!S.dbl){var a=[];for(var i=0;i<S.n;i++)a.push(nameAt(i));return a;}
    return teams().map(function(p){return nameAt(p[0])+" / "+nameAt(p[1]);});
  }
  function drawNames(){
    var box=$("nlist");box.innerHTML="";
    function inp(i,ph){var x=document.createElement("input");x.type="text";x.value=S.names[i]||"";x.placeholder=ph;x.setAttribute("aria-label",ph);x.maxLength=30;x.oninput=function(){S.names[i]=x.value;render();};return x;}
    if(S.dbl&&S.pair==="manuel"){for(var p=0;p*2<S.n;p++){var rp=el("div","nrow pair");rp.appendChild(el("div","no","P"+(p+1)));rp.appendChild(inp(p*2,"Joueur "+(p*2+1)));if(p*2+1<S.n)rp.appendChild(inp(p*2+1,"Joueur "+(p*2+2)));box.appendChild(rp);}}
    else{for(var i=0;i<S.n;i++){var r=el("div","nrow");r.appendChild(el("div","no",String(i+1)));r.appendChild(inp(i,"Joueur "+(i+1)));box.appendChild(r);}}
  }
  function showTeams(){
    var c=$("teamscard");c.hidden=!S.dbl;if(!S.dbl)return;
    var box=$("teams");box.innerHTML="";
    teams().forEach(function(p,j){var d=el("div","team");d.appendChild(el("b",null,"Équipe "+(j+1)));
      if(S.pair==="libre"){[0,1].forEach(function(k){var pos=j*2+k;var sel=document.createElement("select");sel.setAttribute("aria-label","Équipe "+(j+1)+", joueur "+(k+1));for(var q=0;q<S.n;q++){var o=document.createElement("option");o.value=q;o.textContent=nameAt(q);if(S.perm[pos]===q)o.selected=true;sel.appendChild(o);}
        sel.onchange=function(){var want=+sel.value,at=S.perm.indexOf(want),t=S.perm[pos];S.perm[pos]=want;S.perm[at]=t;S.ver++;render();};d.appendChild(sel);if(!k)d.appendChild(el("span",null," et "));});}
      else d.appendChild(el("span",null,nameAt(p[0])+" et "+nameAt(p[1])));box.appendChild(d);});
    if(S.n%2){var l=el("div","team");l.appendChild(el("b",null,"Remplaçant"));l.appendChild(el("span",null,nameAt(teamOrder()[S.n-1])+" (sans partenaire : il remplace en cas d'absence)"));box.appendChild(l);}
    $("teamshint").textContent=S.pair==="hasard"?"Voici le résultat du tirage au sort. Les équipes sont numérotées : ce sont elles qui apparaissent ensuite dans les poules et les tableaux. Pas content du tirage ? Retouche « 🎲 Tirage au sort » plus haut.":S.pair==="equi"?"Paires équilibrées : le joueur le mieux classé (ligne 1) est avec le moins bien classé, le 2e avec l'avant-dernier, etc. Ainsi toutes les équipes ont à peu près la même force.":S.pair==="libre"?"Compose tes paires : choisis dans chaque menu le joueur voulu. Si ce joueur était déjà dans une autre équipe, les deux joueurs échangent leur place : personne n'est oublié ni en double.":"Les équipes sont celles que tu as écrites, deux joueurs par ligne.";
  }

  /* ---------- tableau à élimination ---------- */
  function pow2(n){var s=1;while(s<n)s*=2;return s;}
  function bracketOrder(S_){var o=[1];while(o.length<S_){var L=o.length,nx=[];o.forEach(function(x){nx.push(x,2*L+1-x);});o=nx;}return o;}
  function roundName(count){return count===2?"Finale":count===4?"Demi-finales":count===8?"Quarts de finale":count===16?"Huitièmes de finale":null;}
  var UID=0;
  // nœuds : {t:'e',i} | {t:'w',m} | {t:'l',m} | {t:'g',g,ids} | {t:'p',r,p} (place sur la montante-descendante)
  function ko(nodes,base,prio){
    var out={matches:[],r1:[],winner:null,finalId:null};
    if(nodes.length<2){out.winner=nodes[0]||null;return out;}
    var N=nodes.length,Sz=pow2(N),ord=bracketOrder(Sz),pos=ord.map(function(s){return s<=N?nodes[s-1]:null;});
    var cur=pos,round=1;
    while(cur.length>1){
      var next=[],cnt=cur.length,rn=roundName(cnt)||("Tour "+round);
      for(var i=0;i<cur.length;i+=2){
        var a=cur[i],b=cur[i+1];
        if(a&&b){
          var m={id:"m"+(++UID),a:a,b:b,base:base,rn:rn,phase:base+" · "+rn,deps:[],players:[],order:prio*100+round,round:round};
          [a,b].forEach(function(x){if(x.t==="w"||x.t==="l")m.deps.push(x.m);if(x.t==="g")x.ids.forEach(function(d){m.deps.push(d);});});
          out.matches.push(m);if(round===1)out.r1.push(m);next.push({t:"w",m:m.id});
        }else next.push(a||b);
      }
      cur=next;round++;
    }
    out.winner=cur[0];out.finalId=out.winner&&out.winner.t==="w"?out.winner.m:null;return out;
  }
  function ent(n){var a=[];for(var i=0;i<n;i++)a.push({t:"e",i:i});return a;}
  function buildKO(n){UID=0;var k=ko(ent(n),"Tableau",1),ms=k.matches,third=null;
    var semis=ms.filter(function(m){return m.rn==="Demi-finales";});
    if(S.classif==="oui"&&semis.length===2){var tm={id:"m"+(++UID),a:{t:"l",m:semis[0].id},b:{t:"l",m:semis[1].id},base:"Match pour la 3e place",rn:"Match de classement",phase:"Match pour la 3e place",deps:[semis[0].id,semis[1].id],players:[],order:150,round:99};ms=ms.concat([tm]);third=tm.id;}
    return {matches:ms,info:{type:"ko",final:k.finalId,third:third,semis:semis.map(function(m){return m.id;})}};}
  function buildTMC(n){
    UID=0;var main=ko(ent(n),"Tableau principal",1),all=main.matches.slice(),cons=null;
    if(main.r1.length>=2){cons=ko(main.r1.map(function(m){return {t:"l",m:m.id};}),"Consolante",1);all=all.concat(cons.matches);}
    return {matches:all,info:{type:"tmc",consolante:!!cons,r1:main.r1.length,final:main.finalId,consFinal:cons?cons.finalId:null}};
  }
  function buildPoules(n){
    UID=0;var G=n<=5?1:Math.max(2,Math.round(n/4)),groups=[];for(var g=0;g<G;g++)groups.push({id:g,players:[],ids:[]});
    for(var i=0;i<n;i++){var r=Math.floor(i/G),k=i%G,gi=r%2===0?k:G-1-k;groups[gi].players.push(i);}
    var matches=[];
    groups.forEach(function(gr){
      for(var x=0;x<gr.players.length;x++)for(var y=x+1;y<gr.players.length;y++){
        var m={id:"m"+(++UID),a:{t:"e",i:gr.players[x]},b:{t:"e",i:gr.players[y]},base:"Poule "+String.fromCharCode(65+gr.id),rn:"",phase:"Poule "+String.fromCharCode(65+gr.id),deps:[],players:[gr.players[x],gr.players[y]],order:0,round:1,group:gr.id};
        matches.push(m);gr.ids.push(m.id);
      }
    });
    var finals=[],final=null,ranks=[];
    if(G>=2){var q=groups.map(function(gr){return {t:"g",g:gr.id,ids:gr.ids};});var k2=ko(q,"Phase finale",2);finals=k2.matches;final=k2.finalId;ranks.push({r:0,k:q.length,final:final});
      if(S.classif==="oui"){
        var maxSz=0;groups.forEach(function(g){maxSz=Math.max(maxSz,g.players.length);});
        for(var rk=1;rk<maxSz;rk++){
          var nodes=groups.filter(function(g){return g.players.length>rk;}).map(function(g){return {t:"g",g:g.id,ids:g.ids,rk:rk};});
          if(nodes.length<2)continue;
          var lo=rk*G+1,hi=rk*G+nodes.length;
          var kk=ko(nodes,nodes.length===2?"Match pour la "+lo+"e place":"Classement · places "+lo+" à "+hi,2+rk);
          if(nodes.length===2&&kk.matches[0]){kk.matches[0].rn="Match de classement";kk.matches[0].phase=kk.matches[0].base;}
          finals=finals.concat(kk.matches);ranks.push({r:rk,k:nodes.length,final:kk.finalId});
        }
      }
    }
    return {matches:matches.concat(finals),info:{type:"poules",groups:groups,G:G,finals:finals.length,final:final,ranks:ranks}};
  }
  function autoRounds(){return Math.max(3,Math.min(8,Math.floor(S.avail*60/S.dur)));}
  function ladderOK(){var n=nEnt(),k=Math.min(S.courts,Math.floor(n/2));return n>=4&&(n-2*k)<=4;}
  function buildLadder(n){
    UID=0;var k=Math.min(S.courts,Math.floor(n/2)),R=Math.max(S.rounds||autoRounds(),n-2*k+1),matches=[],prev=[];
    for(var r=0;r<R;r++){var ids=[];for(var c=0;c<k;c++){var m={id:"m"+(++UID),a:{t:"p",r:r,p:2*c},b:{t:"p",r:r,p:2*c+1},base:"Tour "+(r+1),rn:"Terrain "+(c+1),phase:"Tour "+(r+1)+" · terrain "+(c+1),deps:prev.slice(),players:[],order:r*10+c,round:r+1,lad:true,r:r,c:c};matches.push(m);ids.push(m.id);}prev=ids;}
    return {matches:matches,info:{type:"ladder",k:k,R:R,bench:n-2*k}};
  }
  function build(f,n){return f==="poules"?buildPoules(n):f==="tmc"?buildTMC(n):f==="ladder"?buildLadder(n):buildKO(n);}

  /* ---------- planning ---------- */
  function schedule(matches,C){
    var slotOf={},remaining=matches.slice(),last={},played={},t=0,slots=[],guard=0;
    while(remaining.length&&guard++<20000){
      var ready=remaining.filter(function(m){return m.deps.every(function(d){return slotOf[d]!==undefined&&slotOf[d]<t;});});
      var maxp=0;Object.keys(played).forEach(function(k){maxp=Math.max(maxp,played[k]);});
      var score=function(m){var s=0;m.players.forEach(function(p){s+=(t-(last[p]===undefined?-1:last[p]))+(maxp-(played[p]||0))*0.5;});return s;};
      ready.sort(function(a,b){
        if(a.players.length&&b.players.length){var d=score(b)-score(a);return d||(matches.indexOf(a)-matches.indexOf(b));}
        return (a.order-b.order)||(matches.indexOf(a)-matches.indexOf(b));});
      var busy={},pick=[];
      ready.forEach(function(m){
        if(pick.length>=C)return;
        if(m.players.some(function(p){return busy[p];}))return;
        m.players.forEach(function(p){busy[p]=1;});pick.push(m);});
      pick.forEach(function(m){slotOf[m.id]=t;m.players.forEach(function(p){last[p]=t;played[p]=(played[p]||0)+1;});});
      remaining=remaining.filter(function(m){return slotOf[m.id]===undefined;});
      slots.push(pick);t++;
    }
    return {slots:slots,slotOf:slotOf};
  }
  function metrics(f,B,res,dur){
    var gaps=[],firsts=[],per={};
    if(f==="ladder")return {avgGap:0,maxGap:0,avgFirst:0,maxFirst:0,per:per};
    if(f==="poules"){
      B.matches.forEach(function(m){if(m.players.length)m.players.forEach(function(p){(per[p]=per[p]||[]).push(res.slotOf[m.id]);});});
      Object.keys(per).forEach(function(p){var a=per[p].sort(function(x,y){return x-y;});firsts.push(a[0]);for(var i=1;i<a.length;i++)gaps.push(a[i]-a[i-1]-1);});
    }else{
      B.matches.forEach(function(m){
        if(m.round===1&&m.a.t==="e"&&m.b.t==="e"){firsts.push(res.slotOf[m.id],res.slotOf[m.id]);}
        [m.a,m.b].forEach(function(x){if(x.t==="w"||x.t==="l")gaps.push(res.slotOf[m.id]-res.slotOf[x.m]-1);});
      });
    }
    function avg(a){return a.length?a.reduce(function(x,y){return x+y;},0)/a.length:0;}
    function mx(a){return a.length?Math.max.apply(null,a):0;}
    return {avgGap:avg(gaps)*dur,maxGap:mx(gaps)*dur,avgFirst:avg(firsts)*dur,maxFirst:mx(firsts)*dur,per:per};
  }
  function nEnt(){return S.dbl?Math.floor(S.n/2):S.n;}
  function calc(f){
    var n=nEnt(),B=build(f,n),res=schedule(B.matches,S.courts),M=metrics(f,B,res,S.dur);
    return {n:n,B:B,res:res,M:M,total:res.slots.length*S.dur,count:B.matches.length};
  }
  function hhmm(min){var h=Math.floor(min/60)%24,m=min%60;return (h<10?"0":"")+h+" h "+(m<10?"0":"")+m;}
  function startMin(){var p=S.start.split(":");return (+p[0])*60+(+p[1]||0);}
  function hm(mins){mins=Math.round(mins);return mins>=60?Math.floor(mins/60)+" h "+("0"+(mins%60)).slice(-2):mins+" min";}
  function altTotal(f){var save=S.courts;S.courts=Math.min(4,save+1);var t=calc(f).total;S.courts=save;return t;}

  /* ---------- scores et résultats ---------- */
  function sc(id){var s=S.scores[id];if(!s)return null;var a=s.a,b=s.b;if(a===""||b===""||a===undefined||b===undefined)return null;return {a:+a,b:+b};}
  function mById(id){return T.M[id];}
  function ladderOrder(r){
    var I=T.B.info,k=I.k,E=T.E.length,order=[];for(var i=0;i<E;i++)order.push(i);
    var flat=order.slice(0,2*k),bench=order.slice(2*k);
    for(var q=0;q<r;q++){
      var win=[],lose=[];
      for(var c=0;c<k;c++){var m=T.lad[q][c],s=sc(m.id);if(!s||s.a===s.b)return null;var A=flat[2*c],B=flat[2*c+1];win.push(s.a>s.b?A:B);lose.push(s.a>s.b?B:A);}
      var nf=[],nb=bench.slice();
      for(c=0;c<k;c++){var A2=c===0?win[0]:lose[c-1],B2;if(c<k-1)B2=win[c+1];else if(nb.length){B2=nb.shift();nb.push(lose[k-1]);}else B2=lose[k-1];nf.push(A2,B2);}
      flat=nf;bench=nb;
    }
    return {flat:flat,bench:bench};
  }
  function res(node){
    if(node.t==="e")return {i:node.i};
    if(node.t==="p"){var o=ladderOrder(node.r);return o?{i:o.flat[node.p]}:null;}
    if(node.t==="w"||node.t==="l"){
      var m=mById(node.m),s=sc(m.id);if(!s)return null;
      var A=res(m.a),B=res(m.b);if(!A||!B||s.a===s.b)return null;
      var win=s.a>s.b?A:B,lose=s.a>s.b?B:A;return node.t==="w"?win:lose;
    }
    var st=standings(node.g);return st.complete?{i:st.rows[node.rk||0].i}:null;
  }
  function standings(g){
    var gr=T.B.info.groups[g],rows={};
    gr.players.forEach(function(i){rows[i]={i:i,j:0,v:0,n:0,d:0,pp:0,pc:0,pts:0};});
    var complete=true;
    gr.ids.forEach(function(id){
      var m=mById(id),s=sc(id);if(!s){complete=false;return;}
      var a=rows[m.a.i],b=rows[m.b.i];a.j++;b.j++;a.pp+=s.a;a.pc+=s.b;b.pp+=s.b;b.pc+=s.a;
      if(s.a>s.b){a.v++;a.pts+=3;b.d++;}else if(s.b>s.a){b.v++;b.pts+=3;a.d++;}else{a.n++;b.n++;a.pts++;b.pts++;}
    });
    var list=Object.keys(rows).map(function(k){return rows[k];});
    function h2h(x,y){var f=gr.ids.map(mById).filter(function(m){return (m.a.i===x.i&&m.b.i===y.i)||(m.a.i===y.i&&m.b.i===x.i);})[0];if(!f)return 0;var s=sc(f.id);if(!s||s.a===s.b)return 0;var xw=f.a.i===x.i?s.a>s.b:s.b>s.a;return xw?-1:1;}
    list.sort(function(x,y){return (y.pts-x.pts)||((y.pp-y.pc)-(x.pp-x.pc))||(y.pp-x.pp)||h2h(x,y)||(x.i-y.i);});
    return {rows:list,complete:complete};
  }
  function label(node){
    var r=res(node);if(r)return T.E[r.i];
    if(node.t==="e")return T.E[node.i];
    if(node.t==="w")return "Gagnant du match "+T.num[node.m];
    if(node.t==="l")return "Perdant du match "+T.num[node.m];
    if(node.t==="p")return "À définir (résultats du tour "+node.r+")";
    var rk0=node.rk||0;return (rk0===0?"1er":(rk0+1)+"e")+" de la poule "+String.fromCharCode(65+node.g);
  }
  function ladderStats(){ // victoires, terrain actuel, classement
    var I=T.B.info,k=I.k,E=T.E.length,wins={},i;for(i=0;i<E;i++)wins[i]=0;
    var done=0;
    for(var q=0;q<I.R;q++){var o=ladderOrder(q);if(!o)break;var okRound=true;
      for(var c=0;c<k;c++){var m=T.lad[q][c],s=sc(m.id);if(!s||s.a===s.b){okRound=false;continue;}wins[s.a>s.b?o.flat[2*c]:o.flat[2*c+1]]++;}
      if(okRound)done=q+1;else break;}
    var cur=ladderOrder(Math.min(done,I.R-1)),courtOf={};
    if(cur){cur.flat.forEach(function(e,p){courtOf[e]=Math.floor(p/2);});cur.bench.forEach(function(e){courtOf[e]=k;});}
    var list=[];for(i=0;i<E;i++)list.push({i:i,w:wins[i],c:courtOf[i]===undefined?k:courtOf[i]});
    var final=null;
    if(done===I.R){ // classement final : par terrain du dernier tour, le vainqueur d'abord
      var o2=ladderOrder(I.R-1),fl=[];
      for(c=0;c<k;c++){var m2=T.lad[I.R-1][c],s2=sc(m2.id);var A=o2.flat[2*c],B=o2.flat[2*c+1];fl.push(s2.a>s2.b?A:B,s2.a>s2.b?B:A);}
      final=fl.concat(o2.bench);
    }
    list.sort(function(x,y){return (y.w-x.w)||(x.c-y.c)||(x.i-y.i);});
    return {list:list,done:done,final:final,next:done<I.R?ladderOrder(done):null};
  }
  function wl(id){if(!id)return null;var w=res({t:"w",m:id}),l=res({t:"l",m:id});return w?{w:T.E[w.i],l:l?T.E[l.i]:null}:null;}
  function finalRanking(){ // classement final : liste de {p:place, n:noms, ex:ex aequo}
    var I=T.B.info,out=[],x;
    if(I.type==="poules"&&I.G>1){
      var maxSz=0;I.groups.forEach(function(g){maxSz=Math.max(maxSz,g.players.length);});
      for(var r=0;r<maxSz;r++){
        var base=r*I.G,names=[];
        I.groups.forEach(function(g){if(g.players.length>r){var st=standings(g.id);if(st.complete)names.push(T.E[st.rows[r].i]);}});
        var rk=I.ranks.filter(function(z){return z.r===r;})[0];
        if(rk&&rk.final){x=wl(rk.final);out.push({p:base+1,n:x?x.w:null});out.push({p:base+2,n:x?x.l:null});
          var others=names.filter(function(nm){return !x||(nm!==x.w&&nm!==x.l);});
          if(rk.k>2&&others.length)out.push({p:base+3,n:others.join(", "),ex:true});}
        else if(names.length)out.push({p:base+1,n:names.join(", "),ex:names.length>1});
      }
    }else if(I.type==="ko"){
      x=wl(I.final);out.push({p:1,n:x?x.w:null});out.push({p:2,n:x?x.l:null});
      if(I.third){var y=wl(I.third);out.push({p:3,n:y?y.w:null});out.push({p:4,n:y?y.l:null});}
      else if(I.semis&&I.semis.length){var lost=[];I.semis.forEach(function(id){var z=wl(id);if(z&&z.l)lost.push(z.l);});if(lost.length)out.push({p:3,n:lost.join(", "),ex:true});}
    }else return null;
    return out;
  }
  function cheer(){
    var I=T.B.info,out=[];
    function nm(id){var m=id&&mById(id);if(!m)return null;var r=res({t:"w",m:id});return r?T.E[r.i]:null;}
    if(I.type==="poules"){
      if(I.G===1){var st=standings(0);if(st.complete)out.push(["Vainqueur du tournoi",T.E[st.rows[0].i]]);}
      else{var w=nm(I.final);if(w)out.push(["Vainqueur du tournoi",w]);}
    }else if(I.type==="ladder"){var ls=ladderStats();if(ls.final)out.push(["Vainqueur du tournoi",T.E[ls.final[0]]]);}
    else{var w1=nm(I.final);if(w1)out.push(["Vainqueur du tableau",w1]);if(I.type==="tmc"){var w2=nm(I.consFinal);if(w2)out.push(["Vainqueur de la consolante",w2]);}}
    return out;
  }

  /* ---------- liste des matchs (structure, avec cases de scores) ---------- */
  function buildTable(cur){
    T={B:cur.B,res:cur.res,M:{},num:{},court:{},E:entrants(),total:cur.total,lad:[]};
    cur.B.matches.forEach(function(m){T.M[m.id]=m;if(m.lad){(T.lad[m.r]=T.lad[m.r]||[])[m.c]=m;}});
    var k=0;cur.res.slots.forEach(function(sl){sl.forEach(function(m,ci){T.num[m.id]=++k;T.court[m.id]=ci+1;});});
    var tb=$("tbl");tb.innerHTML="";
    var isL=cur.B.info.type==="ladder";
    var thead=el("thead"),hr=el("tr");["N°","Terrain","Joueur / équipe 1","Score","Score","Joueur / équipe 2","Match"].forEach(function(h,i){hr.appendChild(el("th",i===3||i===4?"num":null,h));});thead.appendChild(hr);tb.appendChild(thead);
    var body=el("tbody"),lastPhase="";
    cur.res.slots.forEach(function(sl,si){
      var ph=sl.length?sl[0].phase:"",phk=ph.indexOf("Poule")===0?"Phase de poules":ph;
      if(ph&&phk!==lastPhase&&cur.B.info.type!=="ko"&&!isL){var tp=el("tr","ph"),tdp=el("td",null,phk);tdp.colSpan=7;tp.appendChild(tdp);body.appendChild(tp);lastPhase=phk;}
      var tr=el("tr","tourh");tr.id="tour"+si;
      var th=el("td"),tx=el("b",null,"Tour "+(si+1)+" · "+hhmm(startMin()+si*S.dur));th.appendChild(tx);
      var rt=el("span","rest");rt.id="rest"+si;rt.style.marginLeft="10px";th.appendChild(rt);th.colSpan=7;tr.appendChild(th);body.appendChild(tr);
      sl.forEach(function(m){
        var r=el("tr","mrow");
        var c0=el("td");c0.appendChild(el("span","n c"+((T.court[m.id]-1)%4+1),String(T.num[m.id])));r.appendChild(c0);
        r.appendChild(el("td",null,"Terrain "+T.court[m.id]));
        var na=el("td","nm");na.id="nm-"+m.id+"-a";r.appendChild(na);
        ["a","b"].forEach(function(side){
          var td=el("td","num"),inp=document.createElement("input");inp.type="text";inp.inputMode="numeric";inp.maxLength=2;inp.className="scin";inp.id="sc-"+m.id+"-"+side;
          inp.setAttribute("aria-label","Score "+(side==="a"?"du premier":"du second")+" joueur, match "+T.num[m.id]);
          inp.value=(S.scores[m.id]&&S.scores[m.id][side])||"";
          (function(mid){inp.oninput=function(){var v=inp.value.replace(/\D/g,"");inp.value=v;var s2=S.scores[mid]||(S.scores[mid]={a:"",b:""});s2[side]=v;refresh();};})(m.id);
          td.appendChild(inp);r.appendChild(td);
          if(side==="a"){}
        });
        var nb=el("td","nm");nb.id="nm-"+m.id+"-b";r.appendChild(nb);
        var tm=el("td"),pt=el("div","rest",isL?"Terrain "+T.court[m.id]+(T.court[m.id]===1?" (le plus fort)":""):m.phase);tm.appendChild(pt);
        var msg=el("div","rest");msg.id="msg-"+m.id;tm.appendChild(msg);r.appendChild(tm);
        body.appendChild(r);
      });
    });
    tb.appendChild(body);
  }

  /* ---------- mise à jour à chaque score ---------- */
  function refresh(){
    if(!T)return;
    var B=T.B,I=B.info,slots=T.res.slots,doneCount=0;
    B.matches.forEach(function(m){
      var A=res(m.a),Bn=res(m.b),s=sc(m.id),ready=!!(A&&Bn);
      var an=$("nm-"+m.id+"-a"),bn=$("nm-"+m.id+"-b"),ia=$("sc-"+m.id+"-a"),ib=$("sc-"+m.id+"-b");
      if(!an)return;
      an.textContent=label(m.a);bn.textContent=label(m.b);
      an.className="nm"+(A?"":" wait");bn.className="nm"+(Bn?"":" wait");
      ia.disabled=!ready;ib.disabled=!ready;
      var isP=m.phase.indexOf("Poule")===0,tie=!!(s&&s.a===s.b&&!isP);
      if(s&&ready){if(s.a!==s.b){doneCount++;(s.a>s.b?an:bn).className+=" win";}else if(isP)doneCount++;}
      $("msg-"+m.id).textContent=!ready?"En attente des résultats précédents":(tie?"Pas d'égalité ici : il faut un vainqueur (rejoue un point décisif)":"");
    });
    var allP=[];if(I.type==="poules"){for(var i=0;i<T.E.length;i++)allP.push(i);}
    var nextSlot=-1;
    slots.forEach(function(sl,si){
      var tr=$("tour"+si);if(!tr)return;
      var fin=sl.length>0&&sl.every(function(m){var s=sc(m.id);return s&&(s.a!==s.b||m.phase.indexOf("Poule")===0)&&res(m.a)&&res(m.b);});
      tr.className="tourh"+(fin?" done":"");if(!fin&&nextSlot<0)nextSlot=si;
      var rt=$("rest"+si),ph=sl.length?sl[0].phase:"";
      if(I.type==="poules"&&ph.indexOf("Poule")===0){var pl={};sl.forEach(function(m){m.players.forEach(function(p){pl[p]=1;});});var rest=allP.filter(function(p){return !pl[p];});rt.textContent="Au repos : "+(rest.length?(rest.length<=8?rest.map(function(p){return T.E[p];}).join(", "):rest.length+" joueurs"):"personne");}
      else if(I.type==="ladder"){var o=ladderOrder(si);rt.textContent="Sur le banc : "+(o?(o.bench.length?o.bench.map(function(p){return T.E[p];}).join(", "):"personne"):(I.bench?I.bench+" joueur"+(I.bench>1?"s":"")+" (selon les résultats)":"personne"));}
      else rt.textContent="";
    });
    // bandeau : vainqueur, prochain tour, ce qu'il faut dire
    var nx=$("next");nx.innerHTML="";
    var ch=cheer();
    ch.forEach(function(c){var d=el("div","champ",c[0]);d.appendChild(el("b",null,"🏆 "+c[1]));d.style.marginBottom="8px";nx.appendChild(d);});
    if(nextSlot>=0){
      var sl=slots[nextSlot],d2=el("div","next");d2.appendChild(el("small",null,"Prochain tour à lancer"));d2.appendChild(el("b",null,"Tour "+(nextSlot+1)+" · "+hhmm(startMin()+nextSlot*S.dur)));
      var say=[];
      sl.forEach(function(m){var ready=res(m.a)&&res(m.b);d2.appendChild(el("small",null,"Terrain "+T.court[m.id]+" · n° "+T.num[m.id]+" : "+label(m.a)+" – "+label(m.b)+(ready?"":" (en attente de résultats)")));if(ready)say.push("Terrain "+T.court[m.id]+" : "+label(m.a)+" contre "+label(m.b));});
      d2.appendChild(el("small",null,nextSlot===0&&doneCount===0?"Quand les matchs sont finis, écris les scores dans la liste des matchs plus bas : le tableau et les classements se remplissent tout seuls.":"Quand les matchs de ce tour sont finis, écris leurs scores dans la liste plus bas."));
      nx.appendChild(d2);
    }else if(!ch.length)nx.appendChild(el("p","hint","Tous les matchs sont joués."));
    // poules, tableau, classements : avec les scores
    var bd=$("board");bd.innerHTML="";
    if(I.type==="poules"){
      $("boardh").textContent=I.G>1?"Les poules, les scores et la phase finale":"La poule et les scores";
      var gs=el("div","groups");
      I.groups.forEach(function(gr){
        var st=standings(gr.id),g=el("div","group");g.appendChild(el("h3",null,"Poule "+String.fromCharCode(65+gr.id)));
        var t=el("table"),th=el("thead"),hr=el("tr");["#","Équipe"+(S.dbl?"":" / joueur"),"J","V","N","D",unit()==="jeux"?"Jeux":"Pts","Pts"].forEach(function(h,i){hr.appendChild(el("th",i>1?"num":null,h));});th.appendChild(hr);t.appendChild(th);
        var tb=el("tbody");
        st.rows.forEach(function(r,ri){var tr=el("tr",st.complete&&I.G>1&&ri===0?"q":"");[ri+1,T.E[r.i],r.j,r.v,r.n,r.d,r.pp+"-"+r.pc,r.pts].forEach(function(v,i){tr.appendChild(el("td",i>1?"num":null,String(v)));});tb.appendChild(tr);});
        t.appendChild(tb);g.appendChild(t);
        g.appendChild(el("p","hint",st.complete?(I.G>1?"Poule terminée : le premier est qualifié.":"Poule terminée."):"Classement : victoire 3 points, nul 1 point, puis différence de "+unit()+"."));
        var gm=el("div","gm");gm.appendChild(el("div","sm","Les matchs de la poule"));
        gr.ids.forEach(function(id){var m=mById(id),s=sc(id),d=el("div",s&&s.a>s.b?"w1":s&&s.b>s.a?"w2":"");d.appendChild(el("span",null,T.E[m.a.i]));d.appendChild(el("b",null,s?s.a+" – "+s.b:"– –"));d.appendChild(el("span",null,T.E[m.b.i]));gm.appendChild(d);});
        g.appendChild(gm);gs.appendChild(g);
      });
      bd.appendChild(gs);
    }else if(I.type==="ladder"){
      $("boardh").textContent="Les terrains, les scores et le classement";
      var ls=ladderStats();
      if(ls.next){bd.appendChild(el("div","bkt","Qui joue sur quel terrain au prochain tour"));var nt=el("div","groups");for(var c=0;c<I.k;c++){var cd=el("div","group");cd.appendChild(el("h3",null,"Terrain "+(c+1)+(c===0?" (le plus fort)":c===I.k-1?" (le plus faible)":"")));cd.appendChild(el("p",null,T.E[ls.next.flat[2*c]]+" – "+T.E[ls.next.flat[2*c+1]]));nt.appendChild(cd);}bd.appendChild(nt);if(ls.next.bench.length)bd.appendChild(el("p","hint","Sur le banc : "+ls.next.bench.map(function(p){return T.E[p];}).join(", ")+"."));}
      bd.appendChild(el("div","bkt",ls.final?"Classement final":"Classement provisoire"));
      var t2=el("table"),th2=el("thead"),hr2=el("tr");["#","Équipe"+(S.dbl?"":" / joueur"),"Victoires","Terrain actuel"].forEach(function(h,i){hr2.appendChild(el("th",i>1?"num":null,h));});th2.appendChild(hr2);t2.appendChild(th2);
      var tb2=el("tbody"),rows=ls.final?ls.final.map(function(e){return ls.list.filter(function(x){return x.i===e;})[0];}):ls.list;
      rows.forEach(function(r,ri){var tr=el("tr",ri===0&&ls.final?"q":"");[ri+1,T.E[r.i],r.w,r.c>=I.k?"banc":"Terrain "+(r.c+1)].forEach(function(v,i){tr.appendChild(el("td",i>1?"num":null,String(v)));});tb2.appendChild(tr);});
      t2.appendChild(tb2);var tw=el("div","tw");tw.appendChild(t2);bd.appendChild(tw);
      bd.appendChild(el("div","bkt","Les scores tour par tour"));
      for(var q=0;q<I.R;q++){var rowd=el("div","gm");rowd.appendChild(el("div","sm","Tour "+(q+1)));T.lad[q].forEach(function(m,ci){var s=sc(m.id),res1=res(m.a),res2=res(m.b);var d=el("div",s&&res1&&res2&&s.a>s.b?"w1":s&&res1&&res2&&s.b>s.a?"w2":"");d.appendChild(el("span",null,label(m.a)));d.appendChild(el("b",null,s&&res1&&res2?s.a+" – "+s.b:"– –"));d.appendChild(el("span",null,label(m.b)));rowd.appendChild(d);});bd.appendChild(rowd);}
    }else $("boardh").textContent=I.type==="tmc"?"Le tableau, la consolante et les scores":"Le tableau et les scores";
    var bases=[];B.matches.forEach(function(m){if(m.base.indexOf("Poule")!==0&&!m.lad&&bases.indexOf(m.base)<0)bases.push(m.base);});
    bases.forEach(function(base){
      bd.appendChild(el("div","bkt",base));
      var wrap=el("div","bk"),rounds={};
      B.matches.filter(function(m){return m.base===base;}).forEach(function(m){(rounds[m.round]=rounds[m.round]||[]).push(m);});
      Object.keys(rounds).sort(function(a,b){return a-b;}).forEach(function(r){
        var col=el("div","col");col.appendChild(el("h4",null,rounds[r][0].rn));
        rounds[r].forEach(function(m){
          var card=el("div","bm"),s=sc(m.id),A=res(m.a),Bn=res(m.b),ok=!!(s&&A&&Bn&&s.a!==s.b),show=!!(s&&A&&Bn);
          card.appendChild(el("div","h","n° "+T.num[m.id]+" · "+hhmm(startMin()+T.res.slotOf[m.id]*S.dur)));
          [[m.a,A,s&&s.a,ok&&s.a>s.b],[m.b,Bn,s&&s.b,ok&&s.b>s.a]].forEach(function(x){
            var row=el("div","r"+(x[3]?" w":x[1]?"":" p"));row.appendChild(el("span",null,label(x[0])));row.appendChild(el("span",null,show?String(x[2]):""));card.appendChild(row);});
          col.appendChild(card);});
        wrap.appendChild(col);});
      bd.appendChild(wrap);
    });
    var fr=finalRanking();
    if(fr&&fr.length){
      bd.appendChild(el("div","bkt","Classement final"));
      var tf=el("table"),thf=el("thead"),hrf=el("tr");["Place","Équipe"+(S.dbl?"":" / joueur")].forEach(function(h,i){hrf.appendChild(el("th",i?null:"num",h));});thf.appendChild(hrf);tf.appendChild(thf);
      var tbf=el("tbody");
      fr.forEach(function(r,ri){var tr=el("tr",ri===0&&r.n?"q":"");tr.appendChild(el("td","num",r.p+(r.p===1?"er":"e")+(r.ex?" ex æquo":"")));tr.appendChild(el("td",null,r.n||"— (à venir)"));tbf.appendChild(tr);});
      tf.appendChild(tbf);var twf=el("div","tw");twf.appendChild(tf);bd.appendChild(twf);
      if(I.type==="poules"&&S.classif!=="oui")bd.appendChild(el("p","hint","Sans match de classement, les joueurs de même rang dans leur poule sont classés « ex æquo ». Pour les départager, choisis « Matchs de classement : Oui » à l'étape ④."));
    }
    var fg=$("figs");fg.innerHTML="";
    [[doneCount+" / "+B.matches.length,"matchs joués"],[slots.length,"tours à lancer"],[hm(T.total),"durée prévue"],["vers "+hhmm(startMin()+T.total),"heure de fin prévue"]].forEach(function(o){var d=el("div","fig");d.appendChild(el("b",null,String(o[0])));d.appendChild(el("span",null,o[1]));fg.appendChild(d);});
  }

  /* ---------- rendu complet (quand un réglage change) ---------- */
  function render(){
    S.n=Math.max(S.dbl?6:3,S.n);
    S.dur=S.durManual||(playMin()+BUF);
    var n=nEnt();
    if(document.activeElement!==$("n-out"))$("n-out").value=S.n;$("c-out").textContent=S.courts;
    $("b-simple").setAttribute("aria-pressed",String(!S.dbl));$("b-double").setAttribute("aria-pressed",String(S.dbl));
    $("info").textContent=S.dbl?(n+" équipes ("+S.n+" joueurs) · "+S.courts+" terrain"+(S.courts>1?"s":"")+" · "+(S.courts*4)+" joueurs sur les courts en même temps"):(S.n+" joueurs · "+S.courts+" terrain"+(S.courts>1?"s":"")+" · "+(S.courts*2)+" joueurs sur les courts en même temps");
    var w=$("warn");
    if(S.dbl&&S.n%2){w.hidden=false;w.textContent="Nombre de joueurs impair : un joueur n'a pas de partenaire. Ajoute un joueur ou prévois un remplaçant (le dernier de la liste est laissé de côté).";}
    else if(n<3){w.hidden=false;w.textContent="Il faut au moins 3 "+(S.dbl?"équipes":"joueurs")+" pour faire un tournoi.";}
    else w.hidden=true;
    $("plh").textContent=S.dbl?"Les joueurs":"Les joueurs";
    $("plhint").textContent=S.dbl?(S.pair==="manuel"?"Écris les deux joueurs de chaque équipe (P1, P2…).":"Écris les noms. "+(S.pair==="equi"?"Du mieux classé au moins bien classé : le 1er sera avec le dernier, le 2e avec l'avant-dernier…":"Le tirage au sort forme ensuite les équipes de deux au hasard.")+" Les équipes obtenues s'affichent juste en dessous."):"Écris les noms, du mieux classé au moins bien classé : les têtes de série sont placées en haut du tableau et ont l'exemption au 1er tour. Le tirage au sort mélange la liste.";
    $("pairwrap").hidden=!S.dbl;
    ["manuel","hasard","equi","libre"].forEach(function(p){$("p-"+p).setAttribute("aria-pressed",String(S.pair===p));});
    var nsig=S.dbl+"|"+S.n+"|"+S.ver+"|"+(S.dbl?S.pair:"");if(nsig!==S.nsig){S.nsig=nsig;drawNames();}
    showTeams();
    ["jeux","points","temps"].forEach(function(m){$("m-"+m).setAttribute("aria-pressed",String(S.mode===m));});
    var oc=$("opts");oc.innerHTML="";
    OPTS[S.mode].forEach(function(o){var b=el("button","chipb",o[1]);b.type="button";b.setAttribute("aria-pressed",String(S.opt[S.mode]===o[0]));b.onclick=function(){S.opt[S.mode]=o[0];S.durManual=null;render();};oc.appendChild(b);});
    $("rule").textContent="Règle à annoncer : "+ruleText();
    $("d-out").textContent=S.dur;
    $("durinfo").textContent="Un tour = "+playMin()+" min de jeu environ + "+BUF+" min pour changer de côté et s'installer"+(S.durManual?" (durée réglée à la main).":".")+" Si tes matchs sont plus longs ou plus courts, ajuste avec − et +.";
    if(n<3){["fmts","figs","struct","tbl","wait","todo","board","next","ctbl","advice"].forEach(function(i){var x=$(i);if(x)x.innerHTML="";});T=null;return;}
    if(S.fmt==="ladder"&&!ladderOK())S.fmt="poules";
    var csig=S.dbl+"|"+S.n+"|"+S.fmt+"|"+S.ver+"|"+S.pair+"|"+S.classif+"|"+(S.fmt==="ladder"?(S.rounds||"a")+"|"+S.courts:"");if(csig!==S.csig){S.csig=csig;S.scores={};}
    var list=FORMATS.filter(function(f){return f[0]!=="ladder"||ladderOK();});
    var R={};list.forEach(function(f){R[f[0]]=calc(f[0]);});
    var rec=null;["poules","tmc","ko"].forEach(function(f){if(!rec&&R[f].total<=S.avail*60)rec=f;});
    if(!rec){rec="ko";["poules","tmc","ko"].forEach(function(f){if(R[f].total<R[rec].total)rec=f;});}
    var recName=FORMATS.filter(function(f){return f[0]===rec;})[0][1],rr=R[rec];
    var ladderTip=n>=4&&n<=2*S.courts?" Astuce : avec "+S.courts+" terrain"+(S.courts>1?"s":"")+" pour "+n+(S.dbl?" équipes":" joueurs")+", la montante-descendante fait jouer tout le monde sans aucune attente.":"";
    $("advice").textContent="Notre conseil avec "+S.courts+" terrain"+(S.courts>1?"s":"")+" : "+recName+" ("+rr.count+" matchs, fini vers "+hhmm(startMin()+rr.total)+")"+(rr.total<=S.avail*60?". C'est le format le plus complet qui tient dans ton temps.":". Aucun format classique ne tient dans ton temps : celui-ci est le plus court. Ajoute un terrain ou raccourcis les matchs.")+ladderTip;
    var DESC={poules:"Chacun joue plusieurs matchs dans sa petite poule, puis les meilleurs jouent la finale. Le plus équitable.",tmc:"Un tableau où on est éliminé quand on perd… sauf au 1er match : on rejoue dans la consolante.",ko:"Le plus rapide : tu perds, tu sors. Les moins bons jouent peu.",ladder:"Tu gagnes, tu montes d'un terrain ; tu perds, tu descends. Tout le monde joue à chaque tour."};
    var box=$("fmts");box.innerHTML="";
    list.forEach(function(f){
      var r=R[f[0]],fit=r.total<=S.avail*60,over=r.total-S.avail*60;
      var b=el("button","fmt");b.type="button";b.setAttribute("aria-pressed",String(S.fmt===f[0]));
      b.appendChild(el("b",null,f[1]));b.appendChild(el("div","d",DESC[f[0]]));
      var wait=f[0]==="ladder"?(r.B.info.bench?r.B.info.bench+" au repos par tour":"aucune"):(r.M.maxGap?hm(r.M.maxGap):"aucune");
      var fr=el("div","ffig");
      [[r.count+"","matchs"],[hm(r.total),"de jeu"],["≈ "+hhmm(startMin()+r.total),"fin"]].forEach(function(x){var d=el("div");d.appendChild(el("b",null,x[0]));d.appendChild(el("span",null,x[1]));fr.appendChild(d);});
      b.appendChild(fr);
      b.appendChild(el("div","rest","Attente maximale d'un joueur entre deux matchs : "+wait));
      b.appendChild(el("span","chip "+(fit?"ok":"no"),fit?"✔ Tient dans ton temps":"Trop long : +"+hm(over)));
      if(f[0]===rec)b.appendChild(el("span","chip na",fit?"★ Conseillé":"★ Le plus court"));
      b.onclick=function(){S.fmt=f[0];render();};box.appendChild(b);
    });
    var cw=$("classwrap"),canC=(S.fmt==="poules"&&n>5)||(S.fmt==="ko"&&n>=4);
    cw.hidden=!canC;
    if(canC){
      $("cl-non").setAttribute("aria-pressed",String(S.classif!=="oui"));$("cl-oui").setAttribute("aria-pressed",String(S.classif==="oui"));
      var keep=S.classif,cA,cB;S.classif="non";cA=calc(S.fmt);S.classif="oui";cB=calc(S.fmt);S.classif=keep;
      var dm=cB.count-cA.count,dt=cB.total-cA.total;
      $("clhint").textContent=(S.fmt==="poules"?"Après les poules, les 2es de poule jouent pour la 3e place, les 3es pour la 5e place, etc. : chaque joueur a une place précise au classement final. ":"On ajoute un match entre les deux perdants des demi-finales pour la 3e place. ")+"Cela ajoute "+dm+" match"+(dm>1?"s":"")+(dt>0?" (environ "+hm(dt)+" de plus)":" (sans allonger la durée : ils se jouent en même temps que les autres)")+". Sans cela, les joueurs de même rang sont ex æquo.";
    }
    var rw=$("roundswrap");rw.hidden=S.fmt!=="ladder";if(S.fmt==="ladder")$("r-out").textContent=S.rounds||autoRounds();
    var ct=$("ctbl");ct.innerHTML="";
    var th0=el("thead"),hr0=el("tr");hr0.appendChild(el("th",null,"Format"));for(var cc=1;cc<=4;cc++)hr0.appendChild(el("th",null,cc+" terrain"+(cc>1?"s":"")));th0.appendChild(hr0);ct.appendChild(th0);
    var tb0=el("tbody"),saveC=S.courts;
    list.forEach(function(f){var tr=el("tr"),t0=el("td",null,f[1]);t0.style.fontWeight="800";tr.appendChild(t0);
      for(var cc2=1;cc2<=4;cc2++){S.courts=cc2;var r=calc(f[0]);var td=el("td",null,(r.total<=S.avail*60?"✔ ":"✕ ")+hm(r.total));td.style.fontWeight=cc2===saveC?"800":"500";td.style.background=cc2===saveC?"var(--accent-soft)":"";td.style.color=r.total<=S.avail*60?"var(--win)":"var(--loss)";tr.appendChild(td);}
      tb0.appendChild(tr);});
    S.courts=saveC;ct.appendChild(tb0);
    var cur=R[S.fmt];
    buildTable(cur);
    var rd=$("ready");rd.innerHTML="";
    var fname=FORMATS.filter(function(f){return f[0]===S.fmt;})[0][1],okfit=cur.total<=S.avail*60;
    rd.appendChild(el("small",null,okfit?"✅ Ton tournoi est prêt":"⚠️ Ton tournoi est prêt, mais un peu long"));
    rd.appendChild(el("b",null,n+(S.dbl?" équipes":" joueurs")+" · "+S.courts+" terrain"+(S.courts>1?"s":"")+" · "+fname));
    rd.appendChild(el("small",null,cur.count+" matchs, "+S.dur+" min par tour, de "+hhmm(startMin())+" à "+hhmm(startMin()+cur.total)+"."+(okfit?"":" Tu peux changer de format ou ajouter un terrain ci-dessus.")));
    var gob=el("button","btn","Passer à l'étape ② : lancer les matchs →");gob.type="button";gob.onclick=function(){$("p2").scrollIntoView({behavior:"smooth",block:"start"});};rd.appendChild(gob);
    var st=$("struct");st.innerHTML="";
    var I=cur.B.info,fit2=cur.total<=S.avail*60;
    if(!fit2){st.appendChild(el("div","warn","Ce format dépasse de "+hm(cur.total-S.avail*60)+" le temps disponible. "+(S.courts<4&&I.type!=="ladder"?"Avec "+(S.courts+1)+" terrain"+(S.courts+1>1?"s":"")+", il finirait vers "+hhmm(startMin()+altTotal(S.fmt))+". ":"")+"Tu peux aussi raccourcir les matchs ou choisir un autre format."));}
    else if(S.courts<4&&I.type!=="ladder"){var alt=altTotal(S.fmt);if(alt<cur.total)st.appendChild(el("p","hint","Avec un terrain de plus, le tournoi serait fini "+hm(cur.total-alt)+" plus tôt (vers "+hhmm(startMin()+alt)+")."));}
    if(I.type==="poules")st.appendChild(el("p","hint",I.G>1?"Les premiers de poule jouent ensuite la phase finale"+(S.classif==="oui"?" et des matchs de classement pour toutes les autres places":"")+" ("+I.finals+" match"+(I.finals>1?"s":"")+" après les poules)." :"Une seule poule : tout le monde joue contre tout le monde et le classement de la poule est le classement final."));
    else if(I.type==="tmc")st.appendChild(el("p","hint",I.consolante?"Tableau principal pour tout le monde. Les "+I.r1+" joueurs (ou équipes) qui perdent leur premier match entrent dans la consolante : chacun joue donc au moins 2 matchs, sauf ceux qui ont une exemption au premier tour.":"Peu de joueurs : un seul tableau, sans consolante."));
    else if(I.type==="ladder")st.appendChild(el("p","hint","Montante-descendante : "+I.k+" terrain"+(I.k>1?"s":"")+", "+I.R+" tours. À chaque tour, le gagnant de chaque terrain monte d'un terrain et le perdant descend. "+(I.bench?I.bench+" joueur"+(I.bench>1?"s":"")+" (ou équipe"+(I.bench>1?"s":"")+") attendent sur le banc : ils prennent la place des perdants du dernier terrain. ":"Tout le monde joue à chaque tour. ")+"Le classement final se fait par terrain atteint au dernier tour."));
    else st.appendChild(el("p","hint","Les têtes de série (en haut de la liste) ont une exemption au premier tour quand le nombre de joueurs n'est pas une puissance de 2."));
    $("orderhint").textContent=(I.type==="poules"?"Les matchs sont rangés pour que personne ne joue deux fois de suite et que les joueurs qui ont attendu le plus passent en premier. ":I.type==="ladder"?"Tous les terrains jouent en même temps : les joueurs des tours suivants sont placés d'après les scores. ":"Les matchs d'un même tour sont lancés ensemble ; les tours suivants se remplissent avec les gagnants (et les perdants du 1er tour pour la consolante). ")+"Écris le score de chaque match dans les petites cases : tout le reste se met à jour.";
    var td=$("todo");td.innerHTML="";
    function sec(t,items){var x=el("section");x.appendChild(el("h3",null,t));var ol=el("ol");items.forEach(function(i){ol.appendChild(el("li",null,i));});x.appendChild(ol);td.appendChild(x);}
    var first=T.res.slots[0]||[],fl=first.map(function(m){return "n° "+T.num[m.id]+" (terrain "+T.court[m.id]+")";}).join(", ");
    var scoreWord=S.mode==="jeux"?"le score en jeux":S.mode==="points"?"le score en points":"le score";
    sec("Avant le tournoi",[
      "Choisis le nombre de joueurs et de terrains ci-dessus, écris les noms, fais le tirage au sort. Ensuite, tu n'as plus rien à régler.",
      "Annonce aux joueurs comment on joue : "+ruleText(),
      I.type==="poules"?"Montre les "+I.G+" poule"+(I.G>1?"s":"")+" et le tableau des tours : chaque joueur doit voir à quel tour il joue.":I.type==="ladder"?"Explique le principe : « Tu gagnes, tu montes d'un terrain. Tu perds, tu descends. Le terrain 1 est le plus fort. »":"Montre le tableau et la liste des matchs : chaque joueur doit voir quand son match est lancé.",
      "Prépare "+S.courts+" terrain"+(S.courts>1?"s":"")+" (numéros 1"+(S.courts>1?" à "+S.courts:"")+"), des balles par terrain, un stylo, un chronomètre ou ton téléphone"+(S.mode==="temps"?" (indispensable : le jeu est au temps)":"")+"."
    ]);
    sec("Pendant le tournoi",[
      "À "+hhmm(startMin())+", lance le tour 1 : "+fl+". Le bandeau noir « Prochain tour à lancer » te dit toujours quoi annoncer.",
      "Un tour dure "+S.dur+" minutes ("+playMin()+" de jeu + "+BUF+" pour s'installer).",
      S.mode==="temps"?"Lance le chrono quand tous les joueurs du tour sont prêts. À la sonnerie, on finit le point en cours ; les joueurs te donnent "+scoreWord+" et tu l'écris dans la liste des matchs.":"Dès qu'un match est fini, les joueurs te donnent "+scoreWord+" et tu l'écris dans la liste des matchs. Quand tous les matchs du tour sont finis, ou après "+S.dur+" minutes au plus tard, lance le tour suivant : ne laisse jamais un terrain vide.",
      I.type==="poules"?"Regarde la colonne « Au repos » : ces joueurs peuvent s'échauffer. Appelle ceux du tour suivant 5 minutes à l'avance.":I.type==="ladder"?"Les joueurs sur le banc attendent leur tour : dis-leur qu'ils entreront à la place des perdants du dernier terrain.":"À chaque tour, les gagnants montent dans le tableau"+(I.type==="tmc"?" et les perdants du premier tour vont dans la consolante":"")+" : le bandeau « Prochain tour à lancer » te dit qui appeler."
    ]);
    sec("À la fin",[
      I.type==="poules"?"Le classement de chaque poule se fait tout seul : victoires, puis différence de "+unit()+", puis résultat du match entre les deux."+(I.G>1?" Les premiers de poule jouent la phase finale"+(S.classif==="oui"?", les autres jouent des matchs de classement : le classement final apparaît dans l\'étape ③.":"."):" Le premier du classement gagne le tournoi."):I.type==="tmc"?"Le vainqueur du tableau principal gagne le tournoi ; le vainqueur de la consolante gagne la consolante.":I.type==="ladder"?"Le classement final apparaît tout seul : le gagnant du terrain 1 au dernier tour est premier.":"Le vainqueur de la finale gagne le tournoi.",
      "Garde les résultats pour la remise des prix : on pourra en faire l'affiche des résultats du club."
    ]);
    var fq=$("faq");fq.innerHTML="";
    ["Un joueur n'est pas là : attends 5 minutes, puis il perd par forfait. Écris "+forfaitScore()+" pour son adversaire.",
     "Un match n'est pas fini quand le tour se termine : donne 5 minutes de plus, puis arrête-le. Celui qui mène gagne.",
     "On n'est pas d'accord pour savoir si la balle est dedans ou dehors : en tournoi amical, on rejoue simplement le point.",
     "Un joueur se blesse : il perd par forfait ("+forfaitScore()+" pour l'autre) et on ne le remet pas à jouer. Il peut rester pour encourager.",
     "On est en retard : réduis la durée d'un tour avec − (en haut, « Durée prévue d'un tour »). Les heures se recalculent. Les scores déjà écrits restent.",
     "Un joueur de plus ou de moins : change le nombre de joueurs. Attention, le tournoi est refait et les scores déjà écrits sont effacés.",
     "Égalité à la fin d'un match au temps ou en points : on joue un seul point décisif (sauf en poule au temps : match nul)."
    ].forEach(function(t){fq.appendChild(el("li",null,t));});
    var tn=$("tennis");tn.innerHTML="";
    [["Le terrain","Il y a deux côtés séparés par un filet. Chaque joueur (ou équipe) joue de son côté."],["Un point","On frappe la balle à tour de rôle par-dessus le filet, dans le terrain de l'autre. On perd le point si la balle sort du terrain, touche le filet sans passer, ou rebondit deux fois chez soi."],["Le service","Chaque point commence par un service : le serveur lance la balle et la frappe en diagonale dans le carré en face. Il a le droit à deux essais (en tournoi amical, on peut n'en autoriser qu'un)."],["Compter","Dans ce tournoi, tu comptes simplement 1, 2, 3… (sauf si tu choisis « En jeux » : le tennis classique compte 15, 30, 40)."],["Dedans ou dehors","Une balle qui touche la ligne est bonne. Si les joueurs ne sont pas d'accord, on rejoue le point."]].forEach(function(x){var li=el("li");li.appendChild(el("b",null,x[0]+" : "));li.appendChild(document.createTextNode(x[1]));tn.appendChild(li);});
    var gl=$("gloss");gl.innerHTML="";
    [["Poule","Un petit groupe où chacun joue contre tous les autres."],["Tableau","L'arbre des matchs : on gagne, on avance ; on perd, on est éliminé."],["Consolante","Un deuxième tableau pour ceux qui ont perdu leur premier match, pour qu'ils rejouent."],["Tête de série","Un joueur mieux classé, placé pour ne pas rencontrer trop tôt un autre bon joueur."],["Exemption (ou « bye »)","Un joueur qui passe le premier tour sans jouer, quand le nombre de joueurs n'est pas pair."],["Montante-descendante","Le gagnant monte d'un terrain, le perdant descend : les joueurs se retrouvent peu à peu avec des adversaires de leur niveau."],["Jeu, set","Un jeu = une série de points. Un set = une série de jeux (souvent 6). Un match se joue en un ou deux sets."],["Jeu décisif (tie-break)","Quand le score est très serré, on termine par une petite manche : le premier à 7 points."],["Point décisif","Quand c'est égal, le point suivant décide du vainqueur."],["Forfait","Un joueur qui ne peut pas jouer : son adversaire gagne sans jouer."]].forEach(function(x){var li=el("li");li.appendChild(el("b",null,x[0]+" : "));li.appendChild(document.createTextNode(x[1]));gl.appendChild(li);});
    var M=cur.M,wt=$("wait");wt.innerHTML="";
    var fg2=el("div","figs");
    [[M.maxFirst?hm(M.maxFirst):"0 min","attente maxi avant son 1er match"],[hm(M.avgFirst),"attente moyenne avant le 1er match"],[M.maxGap?hm(M.maxGap):"0 min","attente maxi entre deux matchs"],[hm(M.avgGap),"attente moyenne entre deux matchs"]].forEach(function(o){var d=el("div","fig");d.appendChild(el("b",null,o[0]));d.appendChild(el("span",null,o[1]));fg2.appendChild(d);});
    wt.appendChild(fg2);
    $("waithint").textContent=I.type==="poules"?"Calculé exactement pour chaque joueur, d'après l'ordre prévu.":I.type==="ladder"?"Tout le monde joue à chaque tour, sauf ceux du banc (un tour d'attente quand il y a plus de joueurs que de places).":"Estimation : elle dépend des résultats. Les matchs qui alimentent le même match suivant sont lancés dans le même tour pour que le gagnant n'attende presque pas.";
    if(I.type==="poules"){
      var det=el("details");det.style.marginTop="10px";det.appendChild(el("summary",null,"Voir à quel tour joue chaque joueur"));
      var pl=el("div","pl");pl.style.marginTop="8px";
      T.E.forEach(function(name,i){var a=(M.per[i]||[]).map(function(s){return s+1;});var d=el("div");d.appendChild(el("span",null,name));d.appendChild(el("span",null,"tours "+a.join(", ")));pl.appendChild(d);});
      det.appendChild(pl);wt.appendChild(det);
    }
    refresh();
  }

  /* ---------- commandes ---------- */
  $("b-simple").onclick=function(){S.dbl=false;S.n=Math.max(3,S.n);render();};
  $("b-double").onclick=function(){S.dbl=true;S.n=Math.max(6,S.n%2?S.n+1:S.n);S.perm=[];render();};
  $("n-").onclick=function(){S.n=Math.max(S.dbl?6:3,S.n-(S.dbl?2:1));S.perm=[];render();};
  $("n+").onclick=function(){S.n=S.n+(S.dbl?2:1);S.perm=[];render();};
  var nTimer=null;
  function applyN(inp){var v=Math.floor(+inp.value);if(!(v>=3))v=3;if(S.dbl&&v%2)v++;if(v===S.n)return;S.n=v;S.perm=[];render();}
  $("n-out").onchange=function(){clearTimeout(nTimer);applyN(this);this.value=S.n;};
  $("n-out").oninput=function(){var me=this;clearTimeout(nTimer);nTimer=setTimeout(function(){applyN(me);},700);};
  $("c-").onclick=function(){S.courts=Math.max(1,S.courts-1);render();};
  $("c+").onclick=function(){S.courts=Math.min(4,S.courts+1);render();};
  $("m-jeux").onclick=function(){S.mode="jeux";S.durManual=null;render();};
  $("m-points").onclick=function(){S.mode="points";S.durManual=null;render();};
  $("m-temps").onclick=function(){S.mode="temps";S.durManual=null;render();};
  $("d-").onclick=function(){S.durManual=Math.max(5,S.dur-5);render();};
  $("d+").onclick=function(){S.durManual=Math.min(120,S.dur+5);render();};
  $("cl-non").onclick=function(){S.classif="non";render();};
  $("cl-oui").onclick=function(){S.classif="oui";render();};
  $("r-").onclick=function(){S.rounds=Math.max(2,(S.rounds||autoRounds())-1);render();};
  $("r+").onclick=function(){S.rounds=Math.min(10,(S.rounds||autoRounds())+1);render();};
  $("avail").onchange=function(){S.avail=+this.value;render();};
  $("start").onchange=function(){S.start=this.value||"14:00";render();};
  $("p-manuel").onclick=function(){S.pair="manuel";render();};
  $("p-hasard").onclick=function(){S.pair="hasard";newPerm();S.ver++;render();};
  $("p-equi").onclick=function(){S.pair="equi";render();};
  $("p-libre").onclick=function(){S.pair="libre";S.perm=[];S.ver++;render();};
  $("shuffle").onclick=function(){
    if(S.dbl){S.pair="hasard";newPerm();}
    else{var a=[];for(var i=0;i<S.n;i++)a.push(S.names[i]||"");for(var k=a.length-1;k>0;k--){var j=Math.floor(Math.random()*(k+1));var t=a[k];a[k]=a[j];a[j]=t;}S.names=a;}
    S.ver++;render();};
  $("clear").onclick=function(){S.names=[];S.ver++;render();};
  $("usepaste").onclick=function(){var l=$("paste").value.split("\n").map(function(x){return x.trim();}).filter(Boolean);if(l.length>=3){S.names=l;S.n=l.length;S.perm=[];S.ver++;render();}};
  S.names=["Antoine","Béatrice","Camille","David","Élodie","François","Gaëlle","Hugo","Inès","Julien","Karim","Léa","Marc","Nora","Olivier","Pauline","Quentin","Rémi","Sophie","Thomas","Ulysse","Valérie","William","Xavier","Yasmine","Zoé","Alice","Bruno","Chloé","Damien","Emma","Fabien"];
  var HOST=window.__tournoiHost||{};var touched=false;
  function store(){if(!touched||!HOST.save)return;try{HOST.save(JSON.stringify(S));}catch(e){}}
  function stored(){return typeof HOST.initial==="string"?HOST.initial:null;}
  var _refresh=refresh;
  refresh=function(){_refresh();store();skin(false);
    var p=$("poster");if(!p||!T)return;p.innerHTML="";
    var rows=[];T.B.matches.forEach(function(m){var a=res(m.a),b=res(m.b),x=sc(m.id);if(a&&b&&x)rows.push(label(m.a)+"  "+x.a+" – "+x.b+"  "+label(m.b));});
    p.appendChild(el("h3",null,(HOST.title||"Tournoi amical")+" – "+(S.dbl?"double":"simple")));
    p.appendChild(el("div",null,HOST.dateLabel||new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})));
    cheer().forEach(function(c){p.appendChild(el("div","champ","🏆 "+c[0]+" : "+c[1]));});
    var fr2=T.B.info.type==="ladder"||T.B.info.type==="tmc"?null:finalRanking();
    if(fr2&&fr2.some(function(r){return r.n;})){var ol=el("ul");fr2.forEach(function(r){if(r.n)ol.appendChild(el("li",null,r.p+(r.p===1?"er":"e")+(r.ex?" ex æquo":"")+" : "+r.n));});p.appendChild(el("div",null,"Classement final"));p.appendChild(ol);}
    if(!rows.length){p.appendChild(el("p",null,"Entre des scores : les résultats s'écriront ici."));return;}
    var ul=el("ul");rows.forEach(function(r){ul.appendChild(el("li",null,r));});p.appendChild(ul);
  };
  Array.prototype.forEach.call(document.querySelectorAll(".toc button"),function(b){b.onclick=function(){var t=$(b.getAttribute("data-t"));if(t)t.scrollIntoView({behavior:"smooth",block:"start"});};});
  function doPrint(k){document.body.setAttribute("data-pr",k);setTimeout(function(){window.print();setTimeout(function(){document.body.removeAttribute("data-pr");},500);},50);}
  var parts=["p1","p2","p3","p4"];
  function hl(){var cur="p1",y=window.innerHeight*0.35;parts.forEach(function(id){var e=$(id);if(e&&e.getBoundingClientRect().top<y)cur=id;});Array.prototype.forEach.call(document.querySelectorAll(".toc button"),function(b){b.classList.toggle("on",b.getAttribute("data-t")===cur);});}
  hl();
  $("printp").onclick=function(){doPrint("poster");};
  $("printl").onclick=function(){doPrint("list");};
  $("newt").onclick=function(){if(confirm("Effacer les scores et recommencer ?")){S.scores={};S.ver++;render();}};
  var saved=stored();
  if(saved){$("resume").hidden=false;$("resume").onclick=function(){try{var o=JSON.parse(saved);for(var k in o)S[k]=o[k];S.nsig="";render();$("resume").hidden=true;}catch(e){}};}
  /* ================= HABILLAGE « ASSISTANT » ================= */
  var app=$("app");
  var V={mode:"wizard",step:0,tab:"now",slot:null,filter:"all",armed:false};
  var SEC=function(l){return document.querySelector('#engine section[aria-label="'+l+'"]');};
  var AD={players:SEC("Les joueurs"),teams:SEC("Les équipes"),how:SEC("Comment on joue"),board:$("boardcard"),poster:$("posterwrap"),order:$("orderwrap"),help:SEC("Ce que j'ai à faire"),wait:SEC("Attente des joueurs")};
  var savedObj=null;try{var rawS=stored();if(rawS){savedObj=JSON.parse(rawS);}}catch(e){}
  var rootEl=$("tournoi-app-root")||$("app");
  function H(t,c,x){return el(t,c,x);}
  function B(label,cls,fn){var b=H("button",cls,label);b.type="button";b.onclick=fn;return b;}
  function upd(){render();skin(true);}
  function isPoule(m){return m.phase.indexOf("Poule")===0;}
  function ready(m){return !!(res(m.a)&&res(m.b));}
  function fin(m){var s=sc(m.id);return !!(s&&ready(m)&&(s.a!==s.b||isPoule(m)));}
  function slotFin(sl){return sl.length>0&&sl.every(fin);}
  function scrollTop(){try{if(HOST.scrollTop)HOST.scrollTop();else window.scrollTo(0,0);}catch(e){}}

  function tiles(list,cur,on){var g=H("div","tiles");list.forEach(function(o){var b=B("","tile"+(String(o.v)===String(cur)?" on":""),function(){on(o.v);});b.appendChild(H("b",null,o.l));if(o.s)b.appendChild(H("small",null,o.s));g.appendChild(b);});return g;}
  function setN(v){v=Math.floor(+v);var mn=S.dbl?6:3;if(!(v>=mn))v=mn;if(S.dbl&&v%2)v++;if(v===S.n)return;S.n=v;S.perm=[];S.pairs=[];}
  var DESC2={poules:"Chacun joue plusieurs matchs dans sa petite poule, puis les meilleurs jouent la finale. Le plus équitable.",tmc:"Tableau où on est éliminé quand on perd… sauf au 1er match : on rejoue dans la consolante.",ko:"Le plus rapide : tu perds, tu sors.",ladder:"Tu gagnes, tu montes d'un terrain ; tu perds, tu descends. Tout le monde joue à chaque tour."};

  var TITLES={who:"Qui joue ?",when:"Où et quand ?",names:"Les noms",teams:"Les équipes",rules:"Durée des matchs",format:"Format du tournoi",ready:"C'est prêt !"};
  function keys(){return ["who","when","ready"];}
  function fname(f){return FORMATS.filter(function(x){return x[0]===f;})[0][1];}
  function optLabel(){return optOf()[1];}

  /* ----- la meilleure formule pour tenir dans le temps ----- */
  var advCache={k:"",v:null};
  function advise(){
    var key=[S.dbl,S.n,S.courts,S.avail,S.start,S.mode].join("|");
    if(advCache.k===key)return advCache.v;
    var kO=S.opt[S.mode],kD=S.durManual,kDur=S.dur,kF=S.fmt,kC=S.classif,n=nEnt(),best=null,shortest=null;
    var fm=["poules","tmc","ko"];if(ladderOK())fm.push("ladder");
    var pen={poules:1,tmc:1,ladder:1,ko:0.6},pri={poules:4,tmc:3,ladder:2,ko:1};
    OPTS[S.mode].forEach(function(o){
      S.opt[S.mode]=o[0];S.durManual=null;S.dur=playMin()+BUF;
      fm.forEach(function(f){
        ["non","oui"].forEach(function(cl){
          if(cl==="oui"&&!((f==="poules"&&n>5)||(f==="ko"&&n>=4)))return;
          S.classif=cl;var r=calc(f),fit=r.total<=S.avail*60;
          var c={opt:o[0],optName:o[1],f:f,cl:cl,count:r.count,total:r.total,fit:fit,vol:r.count*playMin()*pen[f]+(cl==="oui"?1:0),pri:pri[f],min:playMin()};
          if(!shortest||c.total<shortest.total)shortest=c;
          if(fit&&(!best||c.vol>best.vol||(c.vol===best.vol&&c.pri>best.pri)))best=c;
        });});
    });
    S.opt[S.mode]=kO;S.durManual=kD;S.dur=kDur;S.fmt=kF;S.classif=kC;
    advCache={k:key,v:best||shortest};if(best)advCache.v.ok=true;else advCache.v.ok=false;
    return advCache.v;
  }
  function adviceCard(){
    var a=advise(),c=H("div","advice");
    c.appendChild(H("small",null,"💡 Notre conseil pour tenir dans ton temps"));
    var cur=S.opt[S.mode]===a.opt&&S.fmt===a.f&&S.classif===a.cl;
    c.appendChild(H("b",null,fname(a.f)+(a.cl==="oui"?" avec matchs de classement":"")+" · "+a.optName));
    c.appendChild(H("span",null,a.count+" matchs · fin vers "+hhmm(startMin()+a.total)+(a.ok?" : c'est la formule la plus complète qui tient dans tes "+hm(S.avail*60)+".":" : rien ne tient dans ton temps, c'est la plus courte. Ajoute un terrain, avance l'heure ou joue moins de jeux.")));
    if(cur)c.appendChild(H("span","okmsg","✔ C'est déjà ta formule."));
    else c.appendChild(B("Prendre cette formule","big small",function(){S.opt[S.mode]=a.opt;S.durManual=null;S.fmt=a.f;S.classif=a.cl;upd();}));
    return c;
  }

  /* ----- composition facile des paires ----- */
  function applyPairs(){var used={},o=[];(S.pairs||[]).forEach(function(p){o.push(p[0],p[1]);used[p[0]]=1;used[p[1]]=1;});for(var i=0;i<S.n;i++)if(!used[i])o.push(i);S.perm=o;S.ver++;}
  function unpaired(){var used={};(S.pairs||[]).forEach(function(p){used[p[0]]=1;used[p[1]]=1;});var u=[];for(var i=0;i<S.n;i++)if(!used[i])u.push(i);return u;}
  function pairsComplete(){return S.pair!=="libre"||unpaired().length===0;}
  function drawTeams(card){
    card.appendChild(H("p","wh","Comment veux-tu former les équipes de deux ?"));
    card.appendChild(tiles([{v:"hasard",l:"🎲 Au hasard",s:"tirage au sort"},{v:"equi",l:"⚖️ Équilibrées",s:"fort avec moins fort"},{v:"libre",l:"✋ Je choisis",s:"je fais mes paires"}],S.pair==="manuel"?"hasard":S.pair,function(v){
      S.pair=v;V.sel=null;if(v==="hasard"){newPerm();S.ver++;}else if(v==="libre"){S.pairs=[];applyPairs();}else{S.ver++;}upd();}));
    if(S.pair==="equi")card.appendChild(H("p","wh","Les joueurs sont classés dans l'ordre de ta liste (le 1er est le mieux classé) : le 1er joue avec le dernier, le 2e avec l'avant-dernier…"));
    if(S.pair==="libre"){
      var un=unpaired();
      card.appendChild(H("p","wh",un.length?"Touche un joueur, puis touche son partenaire.":"✔ Toutes les équipes sont formées."));
      if(un.length){
        var chips=H("div","pchips");
        un.forEach(function(i){chips.appendChild(B(nameAt(i),"pchip"+(V.sel===i?" on":""),function(){
          if(V.sel==null){V.sel=i;skin(true);return;}
          if(V.sel===i){V.sel=null;skin(true);return;}
          S.pairs=(S.pairs||[]).concat([[V.sel,i]]);V.sel=null;applyPairs();upd();}));});
        card.appendChild(chips);
        card.appendChild(B("🎲 Compléter au hasard les joueurs restants","big2",function(){
          var r=un.slice();for(var k=r.length-1;k>0;k--){var j=Math.floor(Math.random()*(k+1));var t=r[k];r[k]=r[j];r[j]=t;}
          for(var q=0;q+1<r.length;q+=2)S.pairs=(S.pairs||[]).concat([[r[q],r[q+1]]]);applyPairs();upd();}));
      }
      if((S.pairs||[]).length)card.appendChild(B("🧹 Tout défaire","chipx",function(){S.pairs=[];V.sel=null;applyPairs();upd();}));
    }
    var tl=H("div","tlist");
    var list=S.pair==="libre"?(S.pairs||[]).map(function(p){return p;}):teams();
    list.forEach(function(p,j){var t=H("div","tcard");t.appendChild(H("b",null,"Équipe "+(j+1)));t.appendChild(H("span",null,nameAt(p[0])+" + "+nameAt(p[1])));
      if(S.pair==="libre")t.appendChild(B("✕","sb",function(){S.pairs.splice(j,1);applyPairs();upd();}));tl.appendChild(t);});
    card.appendChild(tl);
    if(S.pair==="hasard")card.appendChild(B("🎲 Tirer au sort à nouveau","big2",function(){newPerm();S.ver++;upd();}));
  }

  function drawWizard(){
    var ks=keys();if(V.step>=ks.length)V.step=ks.length-1;
    var st=V.step,k=ks[st],n=nEnt();
    app.className=S.dbl?"dbl":"";
    var top=H("div","wtop");top.appendChild(H("div","wlogo","🎾 Tournoi amical"));
    var dots=H("div","dots");ks.forEach(function(t,i){dots.appendChild(H("span","dot"+(i===st?" on":i<st?" ok":""),String(i+1)));});top.appendChild(dots);
    app.appendChild(top);
    var card=H("div","wcard");card.appendChild(H("div","wstep","Étape "+(st+1)+" sur "+ks.length));card.appendChild(H("h1","wq",TITLES[k]));
    if(k==="ready")card.className+=" wready";
    body(card,k);
    function body(card,k){
    if(k==="who"){
      if(savedObj&&savedObj.live){var rc=H("div","resume");rc.appendChild(H("b",null,"📂 Un tournoi est déjà en cours sur cet appareil"));rc.appendChild(B("Reprendre mon tournoi","big",function(){for(var kk in savedObj)S[kk]=savedObj[kk];S.nsig="";V.mode="live";V.tab="now";render();skin(true);scrollTop();}));card.appendChild(rc);}
      card.appendChild(H("p","wh","Simple : 1 joueur contre 1. Double : deux équipes de 2 joueurs."));
      card.appendChild(tiles([{v:"s",l:"🎾 Simple",s:"1 contre 1"},{v:"d",l:"👥 Double",s:"2 contre 2"}],S.dbl?"d":"s",function(v){S.dbl=v==="d";if(S.dbl){S.n=Math.max(6,S.n%2?S.n+1:S.n);}S.perm=[];S.pairs=[];if(S.pair==="manuel")S.pair="hasard";upd();}));
      card.appendChild(H("h2","wsub","Combien de participants ?"+(S.dbl?" (joueurs, pas équipes)":"")));
      var nb=H("div","bign");nb.appendChild(B("−","nbtn",function(){setN(S.n-(S.dbl?2:1));upd();}));
      var inp=document.createElement("input");inp.type="number";inp.min=3;inp.value=S.n;inp.setAttribute("aria-label","Nombre de participants");inp.onchange=function(){setN(inp.value);upd();};nb.appendChild(inp);
      nb.appendChild(B("+","nbtn",function(){setN(S.n+(S.dbl?2:1));upd();}));card.appendChild(nb);
      var q=[6,8,12,16,24,32].filter(function(x){return !S.dbl||x%2===0;}).map(function(x){return {v:x,l:String(x)};});
      card.appendChild(tiles(q,S.n,function(v){setN(v);upd();}));
      if(S.dbl)card.appendChild(H("p","wh","= "+Math.floor(S.n/2)+" équipes de 2."));
    }else if(k==="when"){
      card.appendChild(H("h2","wsub","Combien de terrains sont disponibles ?"));
      card.appendChild(tiles([1,2,3,4].map(function(x){return {v:x,l:x+(x>1?" terrains":" terrain")};}),S.courts,function(v){S.courts=+v;upd();}));
      card.appendChild(H("h2","wsub","De combien de temps disposes-tu ?"));
      card.appendChild(tiles([["1","1 h"],["1.5","1 h 30"],["2","2 h"],["3","3 h"],["4","4 h"],["5","5 h"],["6","6 h"]].map(function(x){return {v:x[0],l:x[1]};}),String(S.avail),function(v){S.avail=+v;upd();}));
      card.appendChild(H("h2","wsub","À quelle heure on commence ?"));
      var ti=document.createElement("input");ti.type="time";ti.className="bigtime";ti.value=S.start;ti.onchange=function(){S.start=ti.value||"14:00";upd();};card.appendChild(ti);
    }else if(k==="names"){
      card.appendChild(H("p","wh","Écris les noms des "+S.n+" "+(S.dbl?"joueurs":"participants")+" (ou garde les exemples). "+(S.dbl?"Tu formeras les équipes à l'étape suivante.":"Du mieux classé au moins bien classé si tu connais le niveau.")));
      card.appendChild(AD.players);
    }else if(k==="teams"){
      drawTeams(card);
    }else if(k==="rules"){
      card.appendChild(adviceCard());
      card.appendChild(H("p","wh","Ou choisis toi-même comment on joue (durée d'un match) :"));
      card.appendChild(AD.how);
    }else if(k==="format"){
      var list=FORMATS.filter(function(f){return f[0]!=="ladder"||ladderOK();}),R={};list.forEach(function(f){R[f[0]]=calc(f[0]);});
      card.appendChild(adviceCard());
      card.appendChild(H("p","wh","Règle actuelle : "+optLabel()+" (≈ "+playMin()+" min par match). Touche le format voulu : le temps tient compte de tes "+S.courts+" terrain"+(S.courts>1?"s":"")+"."));
      var g=H("div","fcards"),a0=advise();
      list.forEach(function(f){var r=R[f[0]],fit=r.total<=S.avail*60;
        var c=B("","fcard"+(S.fmt===f[0]?" on":""),function(){S.fmt=f[0];upd();});
        c.appendChild(H("b",null,f[1]));if(f[0]===a0.f&&a0.ok)c.appendChild(H("span","rec","★ Conseillé"));
        c.appendChild(H("span","fd",DESC2[f[0]]));
        c.appendChild(H("span","ff",r.count+" matchs · "+hm(r.total)+" · fin vers "+hhmm(startMin()+r.total)));
        c.appendChild(H("span","fchip "+(fit?"ok":"no"),fit?"✔ Tient dans ton temps":"Trop long de "+hm(r.total-S.avail*60)));
        g.appendChild(c);});
      card.appendChild(g);
      var canC=(S.fmt==="poules"&&n>5)||(S.fmt==="ko"&&n>=4);
      if(canC){card.appendChild(H("h2","wsub","Faire des matchs de classement ?"));
        var keep=S.classif,a,b2;S.classif="non";a=calc(S.fmt);S.classif="oui";b2=calc(S.fmt);S.classif=keep;
        card.appendChild(tiles([{v:"non",l:"Non",s:"joueurs de même rang ex æquo"},{v:"oui",l:"Oui",s:"+"+(b2.count-a.count)+" matchs : une place pour chacun"}],S.classif,function(v){S.classif=v;upd();}));}
      if(S.fmt==="ladder"){card.appendChild(H("h2","wsub","Combien de tours ?"));card.appendChild(tiles([2,3,4,5,6,7,8].map(function(x){return {v:x,l:String(x)};}),S.rounds||autoRounds(),function(v){S.rounds=+v;upd();}));}
    }else{
      var cur=calc(S.fmt),ok=cur.total<=S.avail*60;
      var rc2=H("div","recap");
      rc2.appendChild(H("b",null,n+(S.dbl?" équipes":" joueurs")+" · "+S.courts+" terrain"+(S.courts>1?"s":"")));
      rc2.appendChild(H("span",null,fname(S.fmt)+(S.classif==="oui"?" + matchs de classement":"")+" · "+optLabel()));
      rc2.appendChild(H("span",null,cur.count+" matchs · "+S.dur+" min par tour · de "+hhmm(startMin())+" à "+hhmm(startMin()+cur.total)));
      rc2.appendChild(H("span",null,"Règle : "+ruleText()));
      card.appendChild(rc2);
      if(!ok)card.appendChild(H("div","warnb","⚠️ C'est plus long que ton temps disponible. Reviens changer le format, ajoute un terrain ou raccourcis les matchs."));
      if(T){
        var I=T.B.info;
        if(I.type==="poules"){var pdt=document.createElement("details");pdt.className="fold";var psm=document.createElement("summary");psm.textContent="👥 Voir les poules";pdt.appendChild(psm);var pg=H("div","pgrid");I.groups.forEach(function(gr){var d=H("div","pgrp");d.appendChild(H("b",null,"Poule "+String.fromCharCode(65+gr.id)));gr.players.forEach(function(i){d.appendChild(H("span",null,T.E[i]));});pg.appendChild(d);});pdt.appendChild(pg);card.appendChild(pdt);}
        var odt=document.createElement("details");odt.className="fold";var osm=document.createElement("summary");osm.textContent="📋 Voir tous les matchs dans l'ordre";odt.appendChild(osm);
        var ol=H("div","olist");
        T.res.slots.forEach(function(sl,i){var h3=H("div","oh","Tour "+(i+1)+" · "+hhmm(startMin()+i*S.dur));ol.appendChild(h3);sl.forEach(function(m){ol.appendChild(H("div","om","Terrain "+T.court[m.id]+" : "+label(m.a)+" – "+label(m.b)));});});
        odt.appendChild(ol);card.appendChild(odt);
      }
      var fsec=H("div","fsec");fsec.appendChild(H("h2","wsub","Choisis ta formule"));
      var adv=adviceCard();adv.firstChild.textContent="💡 Conseil (à titre indicatif) : la formule la plus complète qui tient dans ton temps";fsec.appendChild(adv);
      var fl=FORMATS.filter(function(f){return f[0]!=="ladder"||ladderOK();});
      fsec.appendChild(tiles(fl.map(function(f){var r=calc(f[0]);return {v:f[0],l:f[1],s:r.count+" matchs · fin "+hhmm(startMin()+r.total)+(r.total<=S.avail*60?" ✔":" ⚠ trop long")};}),S.fmt,function(v){S.fmt=v;upd();}));
      var canC2=(S.fmt==="poules"&&n>5)||(S.fmt==="ko"&&n>=4);
      if(canC2){var kp=S.classif,a2,b3;S.classif="non";a2=calc(S.fmt);S.classif="oui";b3=calc(S.fmt);S.classif=kp;
        fsec.appendChild(tiles([{v:"non",l:"Sans matchs de classement"},{v:"oui",l:"Avec classement",s:"+"+(b3.count-a2.count)+" matchs"}],S.classif,function(v){S.classif=v;upd();}));}
      card.insertBefore(fsec,rc2);
      [["names","✏️ Écrire les noms des joueurs"],S.dbl?["teams","👥 Former les équipes (tirage au sort par défaut)"]:null,["rules","⏱️ Durée des matchs (set, points, temps)"]].forEach(function(x){
        if(!x)return;var dt=document.createElement("details");dt.className="fold";if(V.open&&V.open[x[0]])dt.open=true;
        dt.ontoggle=function(){V.open=V.open||{};V.open[x[0]]=dt.open;};
        var sm=document.createElement("summary");sm.textContent=x[1];dt.appendChild(sm);var inner=H("div","foldin");
        body(inner,x[0]);
        dt.appendChild(inner);card.appendChild(dt);});
      card.appendChild(B("🚀 Lancer le tournoi","big go",function(){if(n<3)return;if(S.dbl&&S.pair==="libre"&&unpaired().length)return;S.live=true;V.mode="live";V.tab="now";V.slot=null;refresh();skin(true);scrollTop();}));
    }
    }
    app.appendChild(card);
    var nav=H("div","wnav");
    if(st>0)nav.appendChild(B("← Retour","nbk",function(){V.step--;skin(true);scrollTop();}));else nav.appendChild(H("span"));
    if(st<ks.length-1){var nx=B("Suivant →","big nx",function(){if(nEnt()<3)return;if(k==="teams"&&!pairsComplete()){V.warnPairs=true;skin(true);return;}V.warnPairs=false;V.step++;skin(true);scrollTop();});nav.appendChild(nx);}
    if(k==="teams"&&V.warnPairs&&!pairsComplete())card.appendChild(H("div","warnb","Il reste des joueurs sans partenaire : forme toutes les équipes pour continuer."));
    app.appendChild(nav);
  }


  /* ---------- pendant le tournoi ---------- */
  function setScore(id,side,val){var o=S.scores[id]||(S.scores[id]={a:"",b:""});o[side]=String(Math.max(0,Math.min(99,Math.floor(+val)||0)));var other=side==="a"?"b":"a";if(o[other]==="")o[other]="0";refresh();skin(true);}
  function editor(m){
    var A=res(m.a),Bn=res(m.b),rd=!!(A&&Bn),s=sc(m.id),done=fin(m),isL=T.B.info.type==="ladder";
    var c=H("div","ed"+(rd?"":" wait")+(done?" fin":""));
    c.appendChild(H("div","edh","Terrain "+T.court[m.id]+" · match n° "+T.num[m.id]+" · "+(isL?"tour "+m.round:m.phase)));
    [["a",m.a,A],["b",m.b,Bn]].forEach(function(x){
      var row=H("div","edr"),win=!!(done&&s&&(x[0]==="a"?s.a>s.b:s.b>s.a));
      row.appendChild(H("span","edn"+(x[2]?"":" w")+(win?" win":""),(win?"✔ ":"")+label(x[1])));
      var ctl=H("div","sctl"),val=S.scores[m.id]&&S.scores[m.id][x[0]];
      var minus=B("−","sb",function(){setScore(m.id,x[0],(+val||0)-1);}),plus=B("+","sb",function(){setScore(m.id,x[0],(+val||0)+1);});
      var inp=document.createElement("input");inp.type="text";inp.inputMode="numeric";inp.maxLength=2;inp.value=val===undefined||val===""?"":val;inp.placeholder="–";inp.setAttribute("aria-label","Score de "+label(x[1]));
      inp.onchange=function(){setScore(m.id,x[0],inp.value.replace(/\D/g,""));};
      if(!rd){minus.disabled=plus.disabled=inp.disabled=true;}
      ctl.appendChild(minus);ctl.appendChild(inp);ctl.appendChild(plus);row.appendChild(ctl);c.appendChild(row);});
    if(!rd)c.appendChild(H("div","edm","En attente des résultats précédents"));
    else if(s&&s.a===s.b&&!isPoule(m))c.appendChild(H("div","edm bad","Il faut un vainqueur : rejoue un point décisif."));
    else if(done)c.appendChild(H("div","edm ok","Match terminé ✔"));
    else c.appendChild(H("div","edm","Touche + et − pour écrire le score à la fin du match."));
    return c;
  }
  function counts(){var d=0;T.B.matches.forEach(function(m){if(fin(m))d++;});return {d:d,t:T.B.matches.length};}
  /* Qui a attendu le plus longtemps ? On lance en premier les matchs dont les joueurs attendent depuis le plus de tours. */
  function pIds(m){var a=res(m.a),b=res(m.b);return (a&&b)?[a.i,b.i]:null;}
  function lastPlayed(before){var last={};T.B.matches.forEach(function(m){var s=T.res.slotOf[m.id];if(s>=before||!fin(m))return;var p=pIds(m);if(p)p.forEach(function(i){if(last[i]===undefined||s>last[i])last[i]=s;});});return last;}
  function waitOf(m,last,idx){var p=pIds(m);return p?p.reduce(function(a,i){return a+(idx-(last[i]===undefined?-1:last[i]));},0):0;}
  function orderRound(sl,idx){var last=lastPlayed(idx);return sl.slice().sort(function(a,b){return (waitOf(b,last,idx)-waitOf(a,last,idx))||(T.court[a.id]-T.court[b.id]);});}
  /* Les matchs ne finissent pas tous en même temps : dès qu'un terrain se libère, on propose le match prêt (joueurs libres) dont les joueurs attendent le plus. */
  function freeSuggestions(idx){
    var sl=T.res.slots[idx],run={},freed=[];
    sl.forEach(function(m){var p=pIds(m);if(!p)return;if(fin(m))freed.push(m);else p.forEach(function(i){run[i]=1;});});
    if(!freed.length)return [];
    var last=lastPlayed(idx+1),cands=[];
    T.res.slots.forEach(function(s2,j){if(j<=idx)return;s2.forEach(function(m){if(fin(m))return;var p=pIds(m);if(!p||p.some(function(i){return run[i];}))return;cands.push({m:m,j:j,w:waitOf(m,last,idx),wait:Math.max.apply(null,p.map(function(i){return idx-(last[i]===undefined?-1:last[i]);}))});});});
    cands.sort(function(a,b){return (b.w-a.w)||(a.j-b.j);});
    var used={},out=[];
    for(var f=0;f<freed.length;f++){var pick=null;for(var c=0;c<cands.length;c++){var p2=pIds(cands[c].m);if(!p2.some(function(i){return used[i];})){pick=cands[c];break;}}
      if(!pick)break;pIds(pick.m).forEach(function(i){used[i]=1;});cands.splice(cands.indexOf(pick),1);out.push({court:T.court[freed[f].id],m:pick.m,j:pick.j,wait:pick.wait});}
    return out;
  }
  function drawNow(body){
    var slots=T.res.slots,auto=-1;slots.forEach(function(sl,i){if(auto<0&&!slotFin(sl))auto=i;});
    var all=auto<0,idx=V.slot!=null?V.slot:(all?slots.length-1:auto);
    if(all&&V.slot==null){var ch=cheer();var cb=H("div","champb");cb.appendChild(H("small",null,"Tournoi terminé !"));ch.forEach(function(c){cb.appendChild(H("b",null,"🏆 "+c[0]+" : "+c[1]));});cb.appendChild(B("Voir le classement et l'affiche →","big",function(){V.tab="res";skin(true);scrollTop();}));body.appendChild(cb);}
    var sl=slots[idx];
    var nv=H("div","tnav");
    nv.appendChild(B("◀","sb",function(){V.slot=Math.max(0,idx-1);skin(true);}));
    nv.appendChild(H("div","tti","Tour "+(idx+1)+" sur "+slots.length+" · "+hhmm(startMin()+idx*S.dur)));
    nv.appendChild(B("▶","sb",function(){V.slot=Math.min(slots.length-1,idx+1);skin(true);}));
    body.appendChild(nv);
    if(V.slot!=null&&V.slot!==auto&&!all)body.appendChild(B("↩ Revenir au tour en cours (tour "+(auto+1)+")","chipx",function(){V.slot=null;skin(true);}));
    var ord=orderRound(sl,idx);
    var say=[];ord.forEach(function(m){if(ready(m))say.push("Terrain "+T.court[m.id]+" : "+label(m.a)+" contre "+label(m.b));});
    if(say.length&&!slotFin(sl)){
      var an=H("div","announce");an.appendChild(H("small",null,"📣 Matchs à lancer, dans cet ordre"));
      var ol=H("ol","launch");ord.forEach(function(m){if(ready(m))ol.appendChild(H("li",fin(m)?"done":null,"Terrain "+T.court[m.id]+" : "+label(m.a)+" contre "+label(m.b)+(fin(m)?" ✔ terminé":"")));});an.appendChild(ol);
      an.appendChild(H("p","why","Les joueurs qui ont attendu le plus longtemps passent en premier : l'attente de chacun reste la plus courte possible."));
      body.appendChild(an);}
    var early=(idx===auto)?freeSuggestions(idx):[];
    if(early.length){var fe=H("div","early");fe.appendChild(H("b",null,"🆓 Un terrain est libre : lance tout de suite"));
      early.forEach(function(x){fe.appendChild(H("p",null,"Terrain "+x.court+" : "+label(x.m.a)+" contre "+label(x.m.b)+" — ils attendent depuis "+hm(x.wait*S.dur)+" ; ce match était prévu au tour "+(x.j+1)+", le lancer maintenant évite de les faire patienter."));});
      body.appendChild(fe);early.forEach(function(x){body.appendChild(editor(x.m));});}
    ord.forEach(function(m){body.appendChild(editor(m));});
    var rt=$("rest"+idx);if(rt&&rt.textContent)body.appendChild(H("p","rest2","😴 "+rt.textContent));
    if(slotFin(sl)&&idx<slots.length-1)body.appendChild(B("Tour suivant →","big",function(){V.slot=idx+1===auto?null:idx+1;skin(true);scrollTop();}));
    var nxs=slots[idx+1];
    if(nxs&&nxs.length){var pv=H("div","preview");pv.appendChild(H("small",null,"Ensuite · tour "+(idx+2)+" · "+hhmm(startMin()+(idx+1)*S.dur)));nxs.forEach(function(m){pv.appendChild(H("div",null,"Terrain "+T.court[m.id]+" : "+label(m.a)+" – "+label(m.b)));});body.appendChild(pv);}
  }
  function drawMatches(body){
    var vw=H("div","chipsrow");[["cards","🃏 Cartes (pour noter)"],["table","📊 Tableau complet"]].forEach(function(o){vw.appendChild(B(o[1],"chipx"+((V.view||"cards")===o[0]?" on":""),function(){V.view=o[0];skin(true);}));});body.appendChild(vw);
    if(V.view==="table"){body.appendChild(AD.order);return;}
    var f=H("div","chipsrow");[["all","Tous"],["todo","À jouer"],["done","Joués"]].forEach(function(o){f.appendChild(B(o[1],"chipx"+(V.filter===o[0]?" on":""),function(){V.filter=o[0];skin(true);}));});body.appendChild(f);
    T.res.slots.forEach(function(sl,i){
      var ms=sl.filter(function(m){return V.filter==="all"||(V.filter==="done"?fin(m):!fin(m));});if(!ms.length)return;
      var g=H("div","tgrp"+(slotFin(sl)?" fin":""));g.appendChild(H("h3",null,"Tour "+(i+1)+" · "+hhmm(startMin()+i*S.dur)+(slotFin(sl)?" ✔":"")));ms.forEach(function(m){g.appendChild(editor(m));});body.appendChild(g);});
  }
  function drawMore(body){
    var mb=H("div","morebtns");
    mb.appendChild(B("✏️ Modifier le tournoi (joueurs, terrains, format…)","big2",function(){V.mode="wizard";V.step=0;skin(true);scrollTop();}));
    mb.appendChild(B(V.armed?"⚠️ Sûr ? Appuie encore pour tout effacer":"🗑️ Recommencer à zéro (efface les scores)","big2"+(V.armed?" danger":""),function(){if(!V.armed){V.armed=true;skin(true);return;}V.armed=false;S.scores={};S.ver++;S.live=false;V.mode="wizard";V.step=0;render();skin(true);scrollTop();}));
    body.appendChild(mb);
    body.appendChild(AD.help);body.appendChild(AD.wait);
  }
  function drawLive(){
    var c=counts(),pct=c.t?Math.round(c.d*100/c.t):0;
    var hd=H("div","lhead");hd.appendChild(H("b",null,"🎾 Tournoi amical"));hd.appendChild(H("span",null,c.d+" / "+c.t+" matchs joués"));hd.appendChild(B("⋯ Options","chipx",function(){V.tab="more";V.armed=false;skin(true);scrollTop();}));
    var bar=H("div","pbar");var fill=H("i");fill.style.width=pct+"%";bar.appendChild(fill);hd.appendChild(bar);app.appendChild(hd);
    var body=H("div","lbody");
    if(V.tab==="now")drawNow(body);else if(V.tab==="matches")drawMatches(body);else if(V.tab==="res"){body.appendChild(AD.board);body.appendChild(AD.poster);}else drawMore(body);
    app.appendChild(body);
    var tb=H("nav","tabbar");[["now","🎾","À lancer"],["matches","📋","Tous les matchs"],["res","🏆","Classement"]].forEach(function(t){var b=B("","tab"+(V.tab===t[0]?" on":""),function(){V.tab=t[0];V.armed=false;skin(true);scrollTop();});b.appendChild(H("span","ti",t[1]));b.appendChild(H("span",null,t[2]));tb.appendChild(b);});
    app.appendChild(tb);
  }
  function skin(force){
    var ae=document.activeElement;
    if(!force&&ae&&ae.tagName==="INPUT"&&app.contains(ae))return;
    
    if(V.mode==="live"&&!T){V.mode="wizard";V.step=0;}
    var eng=$("engine");Object.keys(AD).forEach(function(k){if(AD[k]&&AD[k].parentNode!==eng)eng.appendChild(AD[k]);});
    app.textContent="";
    if(V.mode==="live")drawLive();else drawWizard();
  }

  // le tournoi enregistré avec l'animation se rouvre tout seul ; sinon on part de l'heure et du temps de l'animation
  if(savedObj){for(var kk0 in savedObj)S[kk0]=savedObj[kk0];S.nsig="";if(savedObj.live){V.mode="live";V.tab="now";}savedObj=null;}
  else{
    if(HOST.start&&/^\d\d:\d\d$/.test(HOST.start))S.start=HOST.start;
    if(HOST.avail){var best=null;Array.prototype.forEach.call($("avail").options,function(o){var d=Math.abs(+o.value-HOST.avail);if(best===null||d<best[0])best=[d,o.value];});if(best)S.avail=+best[1];}
    S.names=[];
  }
  ["click","input","change"].forEach(function(ev){$("app").addEventListener(ev,function(){touched=true;},true);});
  render();
  skin(true);
  if(HOST.ready)HOST.ready();
})();
