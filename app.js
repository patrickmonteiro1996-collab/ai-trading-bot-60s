const symbols=["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT"], names={BTCUSDT:"BTC",ETHUSDT:"ETH",SOLUSDT:"SOL",XRPUSDT:"XRP"};
let balance=100,wins=0,losses=0,history=[],market={},active=null,timerId=null,lastCandidate=null;
let autoMode=false,autoTimerId=null,lastAutoKey=null,startingTrade=false;
const AUTO_LIMIT=30;
const $=id=>document.getElementById(id), fmt=n=>Number(n).toLocaleString("pt-PT",{minimumFractionDigits:2,maximumFractionDigits:2});
async function loadMarket(){
  try{
    const results=await Promise.all(symbols.map(async s=>{
      const r=await fetch(`https://api.binance.com/api/v3/klines?symbol=${s}&interval=1m&limit=60`,{cache:"no-store"});
      if(!r.ok) throw new Error("feed"); return [s,await r.json()];
    }));
    results.forEach(([s,k])=>market[s]=k.map(x=>({t:x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5]})));
    $("feedStatus").textContent="Dados públicos recebidos · "+new Date().toLocaleTimeString("pt-PT");
    renderCoins(); analyze();
  }catch(e){$("feedStatus").textContent="Sem ligação aos dados · tenta novamente"; $("signal").innerHTML="<div class='muted'>Não foi possível obter cotações. Verifica a ligação.</div><strong>—</strong>";}
}
function ema(a,p){let k=2/(p+1),v=a[0];for(let i=1;i<a.length;i++)v=a[i]*k+v*(1-k);return v}
function rsi(a,p=14){let up=0,dn=0;for(let i=a.length-p;i<a.length;i++){let d=a[i]-a[i-1];if(d>0)up+=d;else dn-=d}if(dn===0)return 100;return 100-100/(1+up/dn)}
function evaluate(s){
 const k=market[s];if(!k||k.length<30)return null;
 const closes=k.slice(0,-1).map(x=>x.c),last=k[k.length-1],e9=ema(closes.slice(-30),9),e21=ema(closes.slice(-30),21),momentum=(closes.at(-1)-closes.at(-4))/closes.at(-4)*100,rv=rsi(closes);
 let score=0;score+=e9>e21?1:-1;score+=momentum>0.025?1:momentum<-.025?-1:0;score+=rv>52&&rv<70?1:rv<48&&rv>30?-1:0;
 const dir=score>=2?"UP":score<=-2?"DOWN":"NEUTRAL";
 const confidence=dir==="NEUTRAL"?50:Math.min(75,50+Math.abs(score)*8);
 return {s,dir,score,confidence,price:last.c,start:closes.at(-1)};
}
function bestCandidate(){
 const all=symbols.map(evaluate).filter(Boolean);
 if(!all.length)return null;
 all.sort((a,b)=>Math.abs(b.score)-Math.abs(a.score));
 return all[0];
}
function analyze(){
 const chosen=bestCandidate();lastCandidate=chosen;
 if(!chosen){$("startBtn").disabled=true;return;}
 const manual=$("asset").value!=="AUTO";
 const c=manual?evaluate($("asset").value):chosen;
 if(!c)return;
 $("signal").className="signal "+(c.dir==="UP"?"up":c.dir==="DOWN"?"down":"");
 $("signal").innerHTML=`<div class="muted">${manual?"SINAL DO ATIVO SELECIONADO":"MELHOR SINAL ENTRE 4 ATIVOS"}</div><strong>${c.dir==="UP"?"UP ↑":c.dir==="DOWN"?"DOWN ↓":"AGUARDAR"}</strong><small>${names[c.s]} · EMA 9/21, momentum e RSI</small>`;
 $("confidence").textContent=c.confidence+"% · heurística";
 $("selectedPrice").textContent=fmt(c.price)+" USDT";
 $("startBtn").disabled=c.dir==="NEUTRAL"||!!active||balance<2;
 updateAutoButton();
}
function renderCoins(){symbols.forEach(s=>{let k=market[s];if(!k)return;let el=[...$("coins").children][symbols.indexOf(s)];el.innerHTML=`<b>${names[s]}/USDT</b><strong>${fmt(k.at(-1).c)}</strong><small>Último candle · USDT</small>`})}
function render(){
 $("balance").textContent=fmt(balance)+" CHF";$("trades").textContent=history.length;$("wins").textContent=wins;$("losses").textContent=losses;$("winrate").textContent=history.length?(wins/history.length*100).toFixed(1)+"%":"—";
 $("history").innerHTML=history.length?history.slice(0,30).map(x=>`<div class="entry"><div><b>${x.asset} · ${x.dir}</b><small>${x.time} · ${x.result==="win"?"Acertou":"Falhou"}</small></div><b class="${x.delta>0?"green":"red"}">${x.delta>0?"+":""}${fmt(x.delta)} CHF</b></div>`).join(""):"<div class='muted'>Ainda não existem operações.</div>";
}
function startTrade(automatic=false,candidate=null){
 if(active||startingTrade)return;
 const chosen=candidate||($("asset").value==="AUTO"?bestCandidate():evaluate($("asset").value));
 if(!chosen||chosen.dir==="NEUTRAL"||balance<2)return;
 startingTrade=true;
 const s=chosen.s,dir=chosen.dir,start=chosen.start,stake=2;
 active={s,dir,start,stake,end:Date.now()+60000,automatic};
 startingTrade=false;
 $("startBtn").disabled=true;
 function tick(){
  if(!active)return;
  let remain=Math.max(0,Math.ceil((active.end-Date.now())/1000));
  $("timer").textContent=`${names[s]} · ${dir} · resultado em ${remain} s`;
  if(remain<=0)settle();else timerId=setTimeout(tick,250);
 }
 tick();updateAutoButton();
}
async function settle(){
 clearTimeout(timerId);let a=active;if(!a)return;active=null;
 try{
  const r=await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${a.s}`,{cache:"no-store"});
  if(!r.ok)throw new Error("price");
  const j=await r.json();let end=+j.price;let won=a.dir==="UP"?end>a.start:end<a.start;let delta=won?1.4:-2;
  balance=Math.round((balance+delta)*100)/100;if(won)wins++;else losses++;
  history.unshift({asset:names[a.s],dir:a.dir,result:won?"win":"loss",delta,time:new Date().toLocaleTimeString("pt-PT")});
 }catch(e){
  $("timer").textContent="Resultado não registado: falhou a cotação final.";render();analyze();
  if(autoMode)scheduleAutoScan(10000);return;
 }
 $("timer").textContent="Operação concluída · saldo atualizado";render();analyze();updateAutoButton();
 if(autoMode){
  if(history.length>=AUTO_LIMIT)stopAuto("Limite de 30 operações atingido.");
  else if(balance<2)stopAuto("Saldo virtual insuficiente para continuar.");
  else scheduleAutoScan(3000);
 }
}
function updateAutoButton(){
 const b=$("autoBtn");if(!b)return;
 b.textContent=autoMode?`Desligar automático (${history.length}/${AUTO_LIMIT})`:`Ligar automático · até ${AUTO_LIMIT} operações`;
 b.style.background=autoMode?"#9b2c2c":"#087f5b";
 b.style.borderColor=autoMode?"#c65b5b":"#15966b";
 b.disabled=!autoMode&&(balance<2||history.length>=AUTO_LIMIT);
}
function scheduleAutoScan(delay=5000){
 clearTimeout(autoTimerId);if(autoMode)autoTimerId=setTimeout(()=>{autoTimerId=null;maybeAutoTrade();},delay);
}
function maybeAutoTrade(){
 if(!autoMode)return;
 if(active||startingTrade){scheduleAutoScan(2000);return;}
 if(history.length>=AUTO_LIMIT){stopAuto("Limite de 30 operações atingido.");return;}
 if(balance<2){stopAuto("Saldo virtual insuficiente para continuar.");return;}
 const chosen=$("asset").value==="AUTO"?bestCandidate():evaluate($("asset").value);
 if(!chosen||chosen.dir==="NEUTRAL"||chosen.confidence<66){
  $("timer").textContent="Modo automático ligado · à espera de sinal válido";scheduleAutoScan(5000);return;
 }
 const candle=market[chosen.s]?.at(-2)?.t??market[chosen.s]?.at(-1)?.t;
 const key=`${chosen.s}:${candle}:${chosen.dir}`;
 if(key===lastAutoKey){scheduleAutoScan(5000);return;}
 lastAutoKey=key;$("timer").textContent="Modo automático · a iniciar operação virtual";startTrade(true,chosen);
}
function stopAuto(message="Modo automático desligado."){
 autoMode=false;clearTimeout(autoTimerId);autoTimerId=null;$("timer").textContent=message;updateAutoButton();
}
// Cria o controlo automático sem precisar de alterar o index.html.
const autoBtn=document.createElement("button");
autoBtn.id="autoBtn";autoBtn.type="button";autoBtn.className=$("startBtn").className;
autoBtn.style.width="100%";autoBtn.style.marginBottom="10px";autoBtn.style.background="#087f5b";
autoBtn.style.border="1px solid #15966b";autoBtn.style.color="#fff";autoBtn.style.borderRadius="14px";
autoBtn.style.padding="16px";autoBtn.style.fontWeight="700";
autoBtn.textContent=`Ligar automático · até ${AUTO_LIMIT} operações`;
$("startBtn").parentElement.insertBefore(autoBtn,$("startBtn"));
autoBtn.addEventListener("click",()=>{
 if(autoMode){stopAuto();return;}
 if(balance<2||history.length>=AUTO_LIMIT)return;
 autoMode=true;updateAutoButton();
 $("timer").textContent="Modo automático ligado · à procura de sinal válido";maybeAutoTrade();
});
$("asset").addEventListener("change",analyze);$("startBtn").addEventListener("click",()=>startTrade(false));
$("resetBtn").addEventListener("click",()=>{
 stopAuto("Simulação reiniciada");
 if(active){clearTimeout(timerId);active=null}
 startingTrade=false;balance=100;wins=0;losses=0;history=[];lastAutoKey=null;
 render();$("timer").textContent="Simulação reiniciada";analyze();updateAutoButton();
});
render();loadMarket();setInterval(loadMarket,15000);
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
