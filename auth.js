/* Sesión de administración compartida por todas las páginas.
   Roles: 'super' (todo) y 'mod' (solo Moderadores y Espíritus).
   Te logueas una vez en cualquier ⚙️ y vale para todas las páginas durante 12 horas (o hasta «Cerrar sesión»). */
window.KAuth = (() => {
  const K = 'karreAuth', TTL = 12 * 3600 * 1000;
  const MOD_PAGES = ['moderadores', 'espiritus'];
  const read = () => {
    try{
      const s = JSON.parse(localStorage.getItem(K));
      if(!s || !s.role || !s.pass || Date.now() - (s.at || 0) > TTL){ localStorage.removeItem(K); return null; }
      return s;
    }catch(e){ return null; }
  };
  const write = s => { try{ if(s) localStorage.setItem(K, JSON.stringify({ ...s, at: Date.now() })); else localStorage.removeItem(K); }catch(e){} };
  const role = () => (read() || {}).role || null;
  const pass = () => (read() || {}).pass || '';
  const can = page => { const r = role(); return r === 'super' || (r === 'mod' && MOD_PAGES.includes(page)); };

  // Devuelve { ok, role, msg }. localPwd = contraseña local de la página (solo sin base de datos)
  async function login(pwd, page, localPwd){
    if(!window.KDB || !KDB.enabled){
      const ok = !!pwd && !!localPwd && pwd === localPwd;
      if(ok) write({ role: 'super', pass: pwd });
      return { ok, role: ok ? 'super' : null, msg: ok ? '' : 'Contraseña incorrecta' };
    }
    let r = null;
    try{ r = await KDB.role(pwd); }
    catch(e){ if(!/karre_role|function|schema cache|404/i.test(e.message)) throw e; }   // sin el SQL de roles: seguimos con la contraseña de la página
    if(r === 'super' || r === 'mod'){
      write({ role: r, pass: pwd });
      const ok = can(page);
      return { ok, role: r, msg: ok ? '' : 'Con la contraseña de moderador solo puedes editar Moderadores y Espíritus' };
    }
    const ok = await KDB.login(page, pwd);   // contraseña antigua de la página: vale solo aquí
    return { ok, role: null, msg: ok ? '' : 'Contraseña incorrecta' };
  }
  const setPass = p => { const s = read(); if(s) write({ ...s, pass: p }); };
  const logout = () => { write(null); };

  // Los campos «Nueva contraseña» de cada página ya no hacen falta: las contraseñas se cambian en la portada
  function hideOldPasswordFields(){
    const el = document.getElementById('aPassword'); if(!el || el.dataset.keep) return;
    const box = el.parentElement;
    if(box && box.children.length <= 2 && box.tagName === 'DIV' && !box.classList.contains('card')) box.style.display = 'none';
    else { el.style.display = 'none'; const l = document.querySelector('label[for=aPassword]'); if(l) l.style.display = 'none'; }
  }
  const ready = () => { hideOldPasswordFields(); document.body.classList.toggle('is-super', role() === 'super'); document.body.classList.toggle('is-mod', role() === 'mod'); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

  return { role, pass, can, login, setPass, logout, refresh: ready };
})();
