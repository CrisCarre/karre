/* Temporizador compartido por todas las páginas.
   Se configura en el admin de la portada (index.html) y la cuenta atrás sigue al cambiar de página.
   Solo se muestra en navegadores donde has entrado al admin, o con ?timer / ?obs en la dirección. */
(() => {
  const DEF = { on: false, secs: 600, text: '¡HORA DE DAR DRACOPAVOS!', image: '', repeat: true };
  const K_HERE = 'karreTimerHere', K_END = 'karreTimerEnd', K_ACK = 'karreTimerAck', K_SIG = 'karreTimerSig', K_CFG = 'karreTimerCfg';
  const ls = {
    get: k => { try{ return localStorage.getItem(k); }catch(e){ return null; } },
    set: (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} }
  };
  const here = () => /[?&](obs|timer)\b/.test(location.search) || !!ls.get(K_HERE);
  let cfg = { ...DEF };
  try{ cfg = { ...DEF, ...(JSON.parse(ls.get(K_CFG)) || {}) }; }catch(e){}
  const sig = c => JSON.stringify([!!c.on, +c.secs || 600]);

  /* ---------- interfaz ---------- */
  const css = `
.ktm-chip{position:fixed;left:14px;bottom:14px;z-index:60;display:none;align-items:center;gap:6px;padding:7px 13px;border-radius:20px;cursor:pointer;
  font-family:'Cinzel',serif;font-weight:900;font-size:.8rem;letter-spacing:1px;color:#ffe3a0;background:rgba(20,4,2,.9);border:2px solid #8a5a12}
.ktm-chip.show{display:inline-flex}
.ktm-chip{opacity:0;transition:opacity .25s,transform .15s}   /* oculto: solo aparece al pasar el ratón por esa esquina */
.ktm-chip:hover,.ktm-chip:focus-visible{opacity:1;border-color:#f5c451}
.ktm-chip:active{transform:scale(.94)}
.ktm-plus{position:fixed;left:40px;bottom:52px;z-index:61;font-family:'Cinzel',serif;font-weight:900;color:#8aff9e;text-shadow:0 0 8px #000;pointer-events:none;animation:ktmUp .9s ease-out forwards}
@keyframes ktmUp{to{transform:translateY(-26px);opacity:0}}
.ktm-chip.soon{color:#fff;border-color:#ff7a00;box-shadow:0 0 14px rgba(255,120,0,.7)}
body.obs .ktm-chip{display:none!important}
.ktm-modal{position:fixed;inset:0;z-index:70;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.72);backdrop-filter:blur(4px)}
.ktm-modal.show{display:flex}
.ktm-card{position:relative;max-width:560px;width:100%;text-align:center;padding:26px;border-radius:18px;border:3px solid #f5c451;
  background:linear-gradient(180deg,#2a0704,#120302);box-shadow:0 0 40px rgba(255,80,0,.5),inset 0 0 30px rgba(0,0,0,.8);animation:ktmPop .6s cubic-bezier(.2,1.8,.4,1)}
@keyframes ktmPop{from{transform:scale(.2) rotate(-12deg);opacity:0}}
.ktm-card img{max-width:100%;max-height:300px;object-fit:contain;border-radius:14px;margin:4px 0 12px}
.ktm-t{font-family:'Metal Mania',cursive;font-size:clamp(2.2rem,7vw,3.6rem);line-height:1.05;background:linear-gradient(180deg,#fff6c2,#ffc53d 40%,#ff5a00 75%,#a80f07);
  -webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 16px rgba(255,90,0,.9));animation:ktmShake 1.2s ease-in-out infinite}
@keyframes ktmShake{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(-2deg) scale(1.04)}75%{transform:rotate(2deg) scale(1.04)}}
.ktm-ok{margin-top:16px;font-family:'Cinzel',serif;font-weight:700;padding:10px 22px;border-radius:10px;cursor:pointer;border:1px solid #f5c451;color:#fff;
  background:linear-gradient(180deg,#ffb300,#ff5a00 50%,#b3130f);text-shadow:0 1px 0 #5a0704;font-size:.9rem}`;
  let chip, left, modal, img, txt;
  function build(){
    const st = document.createElement('style'); st.textContent = css; document.head.append(st);
    chip = document.createElement('button'); chip.type = 'button'; chip.className = 'ktm-chip'; chip.title = 'Pulsa para añadir 1 minuto';
    chip.innerHTML = '⏰ <span></span>'; left = chip.querySelector('span'); chip.onclick = addMinute;
    modal = document.createElement('div'); modal.className = 'ktm-modal';
    modal.innerHTML = '<div class="ktm-card"><img alt=""><div class="ktm-t"></div><button type="button" class="ktm-ok">¡Hecho!</button></div>';
    img = modal.querySelector('img'); txt = modal.querySelector('.ktm-t');
    modal.querySelector('.ktm-ok').onclick = done;
    document.body.append(chip, modal);
  }

  /* ---------- lógica ---------- */
  let fanfared = 0, ac = null;
  function fanfare(){
    try{
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); const t = ac.currentTime;
      [[523,0],[659,.12],[784,.24],[1047,.36],[784,.52],[1047,.62]].forEach(([f, d]) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.18, t + d + .02); g.gain.exponentialRampToValueAtTime(.001, t + d + (d > .6 ? .9 : .3));
        o.connect(g).connect(ac.destination); o.start(t + d); o.stop(t + d + 1);
      });
    }catch(e){}
  }
  function restart(){
    if(!cfg.on){ ls.set(K_END, ''); return tick(); }
    const end = Date.now() + Math.max(5, +cfg.secs || 600) * 1000;
    ls.set(K_END, String(end)); ls.set(K_SIG, sig(cfg)); tick();
  }
  function addMinute(){
    const end = +ls.get(K_END) || 0; if(!end) return;
    ls.set(K_END, String(Math.max(end, Date.now()) + 60000)); tick();
    const f = document.createElement('div'); f.className = 'ktm-plus'; f.textContent = '+1:00'; document.body.append(f); setTimeout(() => f.remove(), 950);
  }
  function done(){
    const end = +ls.get(K_END) || 0; ls.set(K_ACK, String(end)); modal.classList.remove('show');
    if(cfg.repeat !== false) restart(); else { ls.set(K_END, ''); tick(); }
  }
  function tick(){
    if(!chip) return;
    if(!cfg.on || !here()){ chip.classList.remove('show'); modal.classList.remove('show'); return; }
    if(ls.get(K_SIG) !== sig(cfg)){ restart(); return; }          // primera vez o has cambiado los segundos
    const end = +ls.get(K_END) || 0;
    if(!end){ chip.classList.remove('show'); modal.classList.remove('show'); return; }   // parado (sin repetir)
    const s = Math.max(0, Math.ceil((end - Date.now()) / 1000)), m = Math.floor(s / 60);
    left.textContent = (m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0');
    chip.classList.add('show'); chip.classList.toggle('soon', s <= 10);
    if(s <= 0 && ls.get(K_ACK) !== String(end)){
      if(!modal.classList.contains('show')){
        txt.textContent = (cfg.text || '').trim() || DEF.text;
        img.style.display = cfg.image ? '' : 'none'; if(cfg.image) img.src = cfg.image;
        modal.classList.add('show');
        if(fanfared !== end && Date.now() - end < 5000){ fanfared = end; fanfare(); }   // suena solo al llegar a 0, no al recargar más tarde
      }
    } else modal.classList.remove('show');
  }
  function setConfig(c, reset){
    cfg = { ...DEF, ...(c || {}) }; ls.set(K_CFG, JSON.stringify(cfg));
    if(reset) restart(); else tick();
  }
  async function loadConfig(){
    try{
      if(window.KDB && KDB.enabled){ const row = await KDB.load('inicio'); if(row && row.data && row.data.timer) return setConfig(row.data.timer); }
      else { const d = JSON.parse(ls.get('karreInicio_v1') || 'null'); if(d && d.timer) return setConfig(d.timer); }
    }catch(e){}
    tick();
  }

  window.KarreTimer = {
    setConfig,                                   // la portada lo llama al guardar: KarreTimer.setConfig(cfg, true)
    allowHere: () => { ls.set(K_HERE, '1'); tick(); }
  };
  const init = () => { build(); tick(); loadConfig(); setInterval(tick, 250); setInterval(loadConfig, 60000); };
  addEventListener('storage', e => { if([K_END, K_ACK, K_CFG].includes(e.key)){ if(e.key === K_CFG){ try{ cfg = { ...DEF, ...JSON.parse(e.newValue) }; }catch(x){} } tick(); } });
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
