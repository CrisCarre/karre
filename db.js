window.KDB = (() => {
  const SUPABASE_URL      = 'https://tuucrcdvzenrpmoqqnqz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1dWNyY2R2emVucnBtb3FxbnF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDI5NTEsImV4cCI6MjA5NzI3ODk1MX0.tQA6dChjvv4Rf1VtNFLZMbRMhuMtWhOnueb9J2QShI8';

  const enabled = !!SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.startsWith('PEGA_');
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };

  async function rpc(fn, args){
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
    const t = await r.text();
    if(!r.ok){ let m = t; try{ m = JSON.parse(t).message || t; }catch(e){} throw new Error(m || ('Error ' + r.status)); }
    return t ? JSON.parse(t) : null;
  }

  // Lee los datos públicos de una página: { data, updated_at } o null
  async function load(id){
    const r = await fetch(`${SUPABASE_URL}/rest/v1/karre_pages?id=eq.${encodeURIComponent(id)}&select=data,updated_at`, { headers });
    if(!r.ok) throw new Error('No se pudo leer la base de datos (' + r.status + ')');
    const rows = await r.json();
    return rows[0] || null;
  }

  const login = (id, password) => rpc('karre_login', { p_id: id, p_password: password });

  // Guardados en cola: siempre llegan en orden. getPass es una función
  // para usar la contraseña vigente en el momento de enviar.
  let chain = Promise.resolve(), lastOwnSave = {};
  const queue = fn => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };
  const save = (id, data, getPass) =>
    queue(() => rpc('karre_save', { p_id: id, p_data: data, p_password: getPass() })).then(ts => { lastOwnSave[id] = ts; return ts; });
  // Cambia una contraseña secundaria (p. ej. 'ruleta_tirar') con la contraseña de admin de su página
  const setPassword = (adminId, getAdminPass, target, newPass, onOk) =>
    queue(() => rpc('karre_set_password', { p_admin_id: adminId, p_admin_pass: getAdminPass(), p_target: target, p_new: newPass }).then(r => { onOk && onOk(); return r; }));
  // Sorteo hecho en el servidor: { idx, prize }
  const spin = (page, wheel, pass) => rpc('karre_spin', { p_page: page, p_wheel: wheel, p_pass: pass || '' });
  // Pesos privados (solo con la contraseña de admin)
  const getWeights = (page, pass) => rpc('karre_get_weights', { p_page: page, p_pass: pass });
  const saveWeights = (page, getPass, weights) =>
    queue(() => rpc('karre_save_weights', { p_page: page, p_pass: getPass(), p_weights: weights }));
  const changePassword = (id, getOld, newPass, onOk) =>
    queue(() => rpc('karre_change_password', { p_id: id, p_old: getOld(), p_new: newPass }).then(r => { onOk && onOk(); return r; }));

  // Comprueba cada X segundos si otro dispositivo ha cambiado los datos
  function watch(id, onChange, isBusy, ms = 15000){
    let last = null;
    const tick = async () => {
      if(document.hidden || (isBusy && isBusy())) return;
      try{
        const row = await load(id); if(!row) return;
        if(last === null){ last = row.updated_at; return; }
        if(row.updated_at !== last && row.updated_at !== lastOwnSave[id]){ last = row.updated_at; onChange(row.data); }
        else last = row.updated_at;
      }catch(e){}
    };
    tick(); return setInterval(tick, ms);
  }

  // Votos públicos (p. ej. «Asistiré» de los torneos). voterId = id aleatorio guardado en el navegador.
  const vote = (item, voterId, on) => rpc('karre_vote', { p_item: item, p_voter: voterId, p_on: !!on });
  async function voteCounts(prefix, voterId){
    const rows = await rpc('karre_vote_counts', { p_prefix: prefix, p_voter: voterId || '' });
    const out = {}; (rows || []).forEach(r => out[r.item] = { n: +r.n || 0, mine: !!r.mine }); return out;
  }

  // Avisos pequeños abajo a la izquierda
  function toast(msg, ok = true){
    let el = document.getElementById('kdbToast');
    if(!el){
      el = document.createElement('div'); el.id = 'kdbToast';
      el.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:60;padding:9px 16px;border-radius:12px;font:700 .8rem Cinzel,serif;letter-spacing:1px;transition:opacity .3s;pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,.6)';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = ok ? 'rgba(20,60,25,.95)' : 'rgba(90,10,10,.95)';
    el.style.border = '1px solid ' + (ok ? '#39dc5a' : '#ff6b6b');
    el.style.color = '#fff'; el.style.opacity = '1';
    clearTimeout(el._t); el._t = setTimeout(() => el.style.opacity = '0', ok ? 1800 : 5000);
  }

  return { enabled, load, login, spin, getWeights, saveWeights, save, changePassword, setPassword, watch, toast, vote, voteCounts };
})();
