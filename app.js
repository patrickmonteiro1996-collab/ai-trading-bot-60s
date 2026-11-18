const symbols=["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT"], names={BTCUSDT:"BTC",ETHUSDT:"ETH",SOLUSDT:"SOL",XRPUSDT:"XRP"};
let balance=100,wins=0,losses=0,history=[],market={},active=null,timerId=null;
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
function analyze(){
 const s=$("asset").value,k=market[s];if(!k||k.length<30)return;
 const closes=k.slice(0,-1).map(x=>x.c),last=k[k.length-1],e9=ema(closes.slice(-30),9),e21=ema(closes.slice(-30),21),momentum=(closes.at(-1)-closes.at(-4))/closes.at(-4)*100,rv=rsi(closes);
 let score=0;score+=e9>e21?1:-1;score+=momentum>0.025?1:momentum<-.025?-1:0;score+=rv>52&&rv<70?1:rv<48&&rv>30?-1:0;
 let dir=score>=2?"UP":score<=-2?"DOWN":"NEUTRAL",confidence=dir==="NEUTRAL"?50:Math.min(75,50+Math.abs(score)*8);
 $("signal").className="signal "+(dir==="UP"?"up":dir==="DOWN"?"down":"");$("signal").innerHTML=`<div class="muted">SINAL EXPERIMENTAL</div><strong>${dir==="UP"?"UP ↑":dir==="DOWN"?"DOWN ↓":"AGUARDAR"}</strong><small>Baseado em EMA 9/21, momentum e RSI</small>`;
 $("confidence").textContent=confidence+"% · heurística";$("selectedPrice").textContent=fmt(last.c)+" USDT";$("startBtn").disabled=dir==="NEUTRAL"||!!active||balance<2;
}
function renderCoins(){symbols.forEach(s=>{let k=market[s];if(!k)return;let el=[...$("coins").children][symbols.indexOf(s)];el.innerHTML=`<b>${names[s]}/USDT</b><strong>${fmt(k.at(-1).c)}</strong><small>Último candle · USDT</small>`})}
function render(){
 $("balance").textContent=fmt(balance)+" CHF";$("trades").textContent=history.length;$("wins").textContent=wins;$("losses").textContent=losses;$("winrate").textContent=history.length?(wins/history.length*100).toFixed(1)+"%":"—";
 $("history").innerHTML=history.length?history.slice(0,30).map(x=>`<div class="entry"><div><b>${x.asset} · ${x.dir}</b><small>${x.time} · ${x.result==="win"?"Acertou":"Falhou"}</small></div><b class="${x.delta>0?"green":"red"}">${x.delta>0?"+":""}${fmt(x.delta)} CHF</b></div>`).join(""):"<div class='muted'>Ainda não existem operações.</div>";
}
function startTrade(){
 if(active)return;const s=$("asset").value,k=market[s];if(!k)return;
 const closes=k.slice(0,-1).map(x=>x.c),e9=ema(closes.slice(-30),9),e21=ema(closes.slice(-30),21),mom=(closes.at(-1)-closes.at(-4))/closes.at(-4)*100,rv=rsi(closes);
 let score=(e9>e21?1:-1)+(mom>0.025?1:mom<-.025?-1:0)+(rv>52&&rv<70?1:rv<48&&rv>30?-1:0);
 const dir=score>=2?"UP":score<=-2?"DOWN":null;if(!dir)return;
 const start=closes.at(-1),stake=2; if(balance<stake)return;
 active={s,dir,start,stake,end:Date.now()+60000};$("startBtn").disabled=true;
 function tick(){let remain=Math.max(0,Math.ceil((active.end-Date.now())/1000));$("timer").textContent="A avaliar · "+remain+" s";if(remain<=0)settle();else timerId=setTimeout(tick,250)}
 tick();
}
async function settle(){
 clearTimeout(timerId);let a=active;active=null;
 try{const r=await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${a.s}`,{cache:"no-store"});const j=await r.json();let end=+j.price;let won=a.dir==="UP"?end>a.start:end<a.start;let delta=won?1.4:-2;balance=Math.round((balance+delta)*100)/100;if(won)wins++;else losses++;history.unshift({asset:names[a.s],dir:a.dir,result:won?"win":"loss",delta,time:new Date().toLocaleTimeString("pt-PT")});}
 catch(e){$("timer").textContent="Resultado não registado: falhou a cotação final.";render();return}
 $("timer").textContent="Operação concluída · saldo atualizado";render();analyze();
}
$("asset").addEventListener("change",analyze);$("startBtn").addEventListener("click",startTrade);
$("resetBtn").addEventListener("click",()=>{if(active){clearTimeout(timerId);active=null}balance=100;wins=0;losses=0;history=[];render();$("timer").textContent="Simulação reiniciada";analyze()});
render();loadMarket();setInterval(loadMarket,15000);
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));