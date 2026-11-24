(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const LETRAS = ["B", "I", "N", "G", "O"];
  const FALA_LETRA = { B: "Bê", I: "I", N: "Ene", G: "Gê", O: "Ó" };
  const letraDe = (n) => LETRAS[Math.floor((n - 1) / 15)];
  const veloz = new URLSearchParams(location.search).has("rapido");        // só para testes
  const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------- preferências
  const pref = {
    ler: (k, p) => { try { const v = localStorage.getItem("bingo-" + k); return v === null ? p : v; } catch { return p; } },
    gravar: (k, v) => { try { localStorage.setItem("bingo-" + k, v); } catch {} }
  };
  let vozLigada = pref.ler("voz", "1") === "1";
  let somLigado = pref.ler("som", "1") === "1";

  // ---------------------------------------------------------------- sons (WebAudio, sem arquivos)
  let ac = null;
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (ac && ac.state === "suspended") ac.resume(); return ac; }
  function tom(freq, dur, tipo = "sine", vol = 0.12, atraso = 0) {
    if (!somLigado) return; const c = audio(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + atraso;
    o.type = tipo; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const somGiro = () => { for (let i = 0; i < 9; i++) tom(180 + Math.random() * 160, 0.08, "triangle", 0.07, i * 0.12); };
  const somBola = () => { tom(660, 0.18, "sine", 0.14); tom(990, 0.25, "sine", 0.1, 0.09); };
  const somMarca = () => tom(520, 0.1, "square", 0.05);
  const somErro = () => tom(150, 0.18, "sawtooth", 0.07);
  const somVitoria = () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tom(f, 0.22, "triangle", 0.13, i * 0.14));

  // ---------------------------------------------------------------- voz feminina (síntese do aparelho)
  const sint = "speechSynthesis" in window ? window.speechSynthesis : null;
  let vozes = [], vozAtual = null;
  const FEMININAS = /(francisca|maria|luciana|vit[oó]ria|camila|google portugu[eê]s|feminina|female|helena|fernanda|raquel)/i;
  function carregarVozes() {
    if (!sint) return;
    vozes = sint.getVoices().filter((v) => /^pt/i.test(v.lang));
    vozes.sort((a, b) => (/pt[-_]BR/i.test(b.lang) - /pt[-_]BR/i.test(a.lang)) || (FEMININAS.test(b.name) - FEMININAS.test(a.name)));
    const sel = $("#selVoz"); sel.textContent = "";
    vozes.forEach((v, i) => { const o = document.createElement("option"); o.value = String(i); o.textContent = v.name + " (" + v.lang + ")"; sel.append(o); });
    const salva = pref.ler("vozNome", "");
    let i = vozes.findIndex((v) => v.name === salva);
    if (i < 0) i = vozes.findIndex((v) => /pt[-_]BR/i.test(v.lang) && FEMININAS.test(v.name));
    if (i < 0) i = vozes.findIndex((v) => /pt[-_]BR/i.test(v.lang));
    if (i < 0) i = 0;
    vozAtual = vozes[i] || null; if (vozes.length) sel.value = String(i);
    $("#vozInfo").textContent = !sint ? "Este navegador não tem voz. O sorteio funciona sem som falado."
      : vozes.length ? "Se a voz soar masculina, escolha outra na lista. As opções dependem do seu aparelho."
      : "Nenhuma voz em português foi encontrada neste aparelho. O navegador vai usar a voz padrão.";
  }
  if (sint) { carregarVozes(); sint.onvoiceschanged = carregarVozes; }
  $("#selVoz").addEventListener("change", (e) => { vozAtual = vozes[Number(e.target.value)] || null; if (vozAtual) pref.gravar("vozNome", vozAtual.name); falar("Bingo! Vamos jogar."); });
  function falar(texto) {
    if (!sint || !vozLigada) return;
    try {
      sint.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "pt-BR"; if (vozAtual) u.voice = vozAtual; u.rate = 0.92; u.pitch = 1.12; u.volume = 1;
      sint.speak(u);
    } catch {}
  }
  const frase = (n) => `${FALA_LETRA[letraDe(n)]}, ${n}.`;

  // ---------------------------------------------------------------- globo 3D (esfera de bolas em perspectiva)
  const globo = $("#globo"), minis = [];
  const N_MINI = 28, COR = ["cB", "cI", "cN", "cG", "cO"];
  for (let i = 0; i < N_MINI; i++) {
    const y = 1 - 2 * (i + 0.5) / N_MINI, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    const el = document.createElement("span"); el.className = "mini " + COR[i % 5];
    globo.append(el); minis.push({ el, col: i % 5, num: 0, x: Math.cos(th) * r, y, z: Math.sin(th) * r });
  }
  // cada bola do globo mostra um número que ainda não saiu (da mesma letra/cor)
  function atribuirMini(m) {
    const em = new Set(minis.map((x) => x.num));
    const pool = restantes.filter((n) => Math.floor((n - 1) / 15) === m.col && !em.has(n));
    m.num = pool.length ? pool[Math.floor(Math.random() * pool.length)] : 0;
    m.el.textContent = m.num || ""; m.el.style.visibility = m.num ? "visible" : "hidden";
  }
  const resetGlobo = () => { minis.forEach((m) => { m.num = 0; }); minis.forEach(atribuirMini); };
  const tirarDoGlobo = (n) => { const m = minis.find((x) => x.num === n); if (m) atribuirMini(m); };
  let ang = 0, vel = 0.007, velAlvo = 0.007, inclina = 0.45, ultimo = 0;
  function quadroGlobo(t) {
    const dt = Math.min(48, t - (ultimo || t)); ultimo = t;
    vel += (velAlvo - vel) * 0.06; ang += vel * (dt / 16);
    const R = globo.clientWidth * 0.36, ca = Math.cos(ang), sa = Math.sin(ang), cb = Math.cos(inclina), sb = Math.sin(inclina);
    const tam = globo.clientWidth / 260;
    for (const m of minis) {
      const x1 = m.x * ca + m.z * sa, z1 = -m.x * sa + m.z * ca;
      const y2 = m.y * cb - z1 * sb, z2 = m.y * sb + z1 * cb, prof = (z2 + 1) / 2;
      m.el.style.transform = `translate(${(x1 * R).toFixed(1)}px, ${(y2 * R).toFixed(1)}px) scale(${((0.62 + 0.55 * prof) * tam).toFixed(3)})`;
      m.el.style.zIndex = String(Math.round(prof * 100)); m.el.style.opacity = (0.5 + 0.5 * prof).toFixed(2);
    }
    requestAnimationFrame(quadroGlobo);
  }
  requestAnimationFrame(quadroGlobo);

  // ---------------------------------------------------------------- estado da partida
  let restantes, chamados, ocupado = false, autoLigado = false, autoTimer = null;
  const bolaEl = $("#bolaAtual"), faixa = $("#faixa");

  // quadro 1-75
  const quadro = $("#quadro"), celQuadro = {};
  LETRAS.forEach((L, li) => {
    const l = document.createElement("span"); l.className = "letra c" + L; l.textContent = L; quadro.append(l);
    for (let k = 1; k <= 15; k++) {
      const n = li * 15 + k, c = document.createElement("span"); c.className = "n c" + L; c.textContent = n; c.setAttribute("aria-label", L + " " + n); quadro.append(c); celQuadro[n] = c;
    }
  });

  function mostrarBola(n) {
    const L = letraDe(n);
    bolaEl.className = "bola-grande c" + L; void bolaEl.offsetWidth; if (!reduzido) bolaEl.classList.add("entra");
    $("#bolaLetra").textContent = L; $("#bolaNum").textContent = n;
    bolaEl.setAttribute("aria-label", "Bola " + L + " " + n);
  }
  function limparBola() {
    bolaEl.className = "bola-grande vazia"; $("#bolaLetra").textContent = "–"; $("#bolaNum").textContent = "?";
    bolaEl.setAttribute("aria-label", "Nenhuma bola sorteada ainda");
  }
  function desenharHistorico() {
    const ol = $("#historico"); ol.textContent = "";
    chamados.slice(-6).reverse().forEach((n, i) => {
      const li = document.createElement("li"); li.className = "chip c" + letraDe(n); li.textContent = n; if (i === 0) li.style.outline = "2px solid var(--ouro)"; ol.append(li);
    });
    $("#contagem").textContent = chamados.length + " de 75";
  }
  function marcarQuadro() {
    Object.entries(celQuadro).forEach(([n, el]) => { el.classList.remove("saiu", "ultima"); });
    chamados.forEach((n, i) => { celQuadro[n].classList.add("saiu"); if (i === chamados.length - 1) celQuadro[n].classList.add("ultima"); });
  }

  function sortear() {
    if (ocupado) return;
    if (!restantes.length) { avisar("Todas as bolas já saíram."); pararAuto(); return; }
    ocupado = true; $("#bSortear").disabled = true; audio();
    globo.classList.add("treme"); velAlvo = 0.16; somGiro();
    setTimeout(() => {
      const i = Math.floor(Math.random() * restantes.length), n = restantes.splice(i, 1)[0];
      chamados.push(n); tirarDoGlobo(n); globo.classList.remove("treme"); velAlvo = 0.007;
      mostrarBola(n); somBola(); desenharHistorico(); marcarQuadro(); falar(frase(n));
      if ($("#chkAuto").checked && cartelaTem(n)) marcar(n, true);
      conferir();
      ocupado = false; $("#bSortear").disabled = false;
      if (autoLigado) agendarAuto();
    }, (reduzido ? 300 : 1250) * (veloz ? 0.05 : 1));
  }
  function agendarAuto() {
    clearTimeout(autoTimer);
    if (!restantes.length) { pararAuto(); return; }
    autoTimer = setTimeout(sortear, veloz ? 60 : Number($("#selTempo").value));
  }
  function pararAuto() { autoLigado = false; clearTimeout(autoTimer); $("#bAuto").setAttribute("aria-pressed", "false"); $("#bAuto").textContent = "Automático"; }
  $("#bSortear").addEventListener("click", () => { audio(); sortear(); });
  $("#bAuto").addEventListener("click", () => {
    audio();
    if (autoLigado) { pararAuto(); return; }
    autoLigado = true; $("#bAuto").setAttribute("aria-pressed", "true"); $("#bAuto").textContent = "Parar automático";
    if (!ocupado) sortear();
  });
  $("#selTempo").addEventListener("change", () => { if (autoLigado && !ocupado) agendarAuto(); });

  // ---------------------------------------------------------------- cartela
  let cartela = [], marcadas = new Set(), linhaFeita = false, bingoFeito = false;
  const sorteiaCol = (min, qtd) => {
    const pool = Array.from({ length: 15 }, (_, i) => min + i);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, qtd).sort((a, b) => a - b);
  };
  function novaCartela() {
    cartela = LETRAS.map((_, c) => { const col = sorteiaCol(c * 15 + 1, c === 2 ? 4 : 5); if (c === 2) col.splice(2, 0, 0); return col; });   // 0 = espaço livre
    marcadas = new Set(); linhaFeita = false; bingoFeito = false; avisar("");
    desenharCartela();
    chamados.forEach((n) => { if ($("#chkAuto").checked && cartelaTem(n)) marcadas.add(n); }); desenharCartela();
  }
  const cartelaTem = (n) => cartela.some((col) => col.includes(n));
  function desenharCartela() {
    const box = $("#cartela"); box.textContent = ""; box.setAttribute("aria-rowcount", "6");
    LETRAS.forEach((L) => { const h = document.createElement("div"); h.className = "cabeca c" + L; h.textContent = L; box.append(h); });
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const n = cartela[c][r], b = document.createElement("button"); b.type = "button"; b.className = "celula"; b.dataset.n = n;
      if (n === 0) { b.classList.add("livre", "marcada"); b.textContent = "LIVRE"; b.setAttribute("aria-label", "Espaço livre"); b.disabled = true; }
      else { b.textContent = n; b.setAttribute("aria-label", LETRAS[c] + " " + n + (marcadas.has(n) ? ", marcado" : "")); if (marcadas.has(n)) b.classList.add("marcada"); b.addEventListener("click", () => tocar(n, b)); }
      box.append(b);
    }
  }
  function tocar(n, b) {
    if (marcadas.has(n)) { marcadas.delete(n); desenharCartela(); return; }
    if (!chamados.includes(n)) { somErro(); b.classList.remove("balanca"); void b.offsetWidth; b.classList.add("balanca"); avisar("Esse número ainda não saiu."); return; }
    marcar(n, false); conferir();
  }
  function marcar(n, auto) { marcadas.add(n); if (!auto) somMarca(); desenharCartela(); }
  const ok = (c, r) => cartela[c][r] === 0 || marcadas.has(cartela[c][r]);
  function conferir() {
    let linhas = 0;
    for (let r = 0; r < 5; r++) if ([0, 1, 2, 3, 4].every((c) => ok(c, r))) linhas++;
    for (let c = 0; c < 5; c++) if ([0, 1, 2, 3, 4].every((r) => ok(c, r))) linhas++;
    if ([0, 1, 2, 3, 4].every((i) => ok(i, i))) linhas++;
    if ([0, 1, 2, 3, 4].every((i) => ok(i, 4 - i))) linhas++;
    const cheia = [0, 1, 2, 3, 4].every((c) => [0, 1, 2, 3, 4].every((r) => ok(c, r)));
    if (cheia && !bingoFeito) { bingoFeito = true; pararAuto(); anunciar("BINGO!", "Bingo! Parabéns, cartela cheia!"); }
    else if (linhas > 0 && !linhaFeita) { linhaFeita = true; anunciar("LINHA!", "Linha completa! Continue, falta a cartela cheia."); }
  }
  function anunciar(txt, fala) {
    faixa.textContent = txt; faixa.hidden = false; somVitoria(); setTimeout(() => falar(fala), 600);
    avisar(txt === "BINGO!" ? "Bingo! Toque em Nova partida para jogar de novo." : "Você fez uma linha!");
    const fecha = () => { faixa.hidden = true; }; faixa.onclick = fecha; setTimeout(fecha, 3800);
  }
  function avisar(t) { $("#aviso").textContent = t; }

  // ---------------------------------------------------------------- partida
  function novaPartida() {
    pararAuto(); clearTimeout(autoTimer); if (sint) try { sint.cancel(); } catch {}
    restantes = Array.from({ length: 75 }, (_, i) => i + 1); chamados = []; resetGlobo(); ocupado = false; $("#bSortear").disabled = false;
    marcadas = new Set(); linhaFeita = false; bingoFeito = false; avisar(""); faixa.hidden = true;
    limparBola(); desenharHistorico(); marcarQuadro(); if (cartela.length) desenharCartela();
  }
  $("#bNova").addEventListener("click", () => { if (chamados.length && !bingoFeito && !confirm("Começar uma nova partida? As bolas sorteadas serão apagadas.")) return; novaPartida(); });
  $("#bCartela").addEventListener("click", novaCartela);
  $("#chkAuto").addEventListener("change", () => { if ($("#chkAuto").checked) { chamados.forEach((n) => { if (cartelaTem(n)) marcadas.add(n); }); desenharCartela(); conferir(); } });

  // ---------------------------------------------------------------- chaves e voz
  function chave(id, valor, chaveNome, aoMudar) {
    const b = $(id); b.setAttribute("aria-pressed", String(valor));
    b.addEventListener("click", () => { const v = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(v)); pref.gravar(chaveNome, v ? "1" : "0"); aoMudar(v); });
  }
  chave("#bVoz", vozLigada, "voz", (v) => { vozLigada = v; if (!v && sint) try { sint.cancel(); } catch {} else falar("Voz ligada."); });
  chave("#bSom", somLigado, "som", (v) => { somLigado = v; if (v) { audio(); somBola(); } });
  $("#bTestar").addEventListener("click", () => { const v = vozLigada; vozLigada = true; falar("Bê, sete. Ene, quarenta e três. Ó, setenta e um."); vozLigada = v; });

  // ---------------------------------------------------------------- tela cheia
  const raiz = document.documentElement, btnTela = $("#bTela");
  const pedirTela = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
  const sairTela = document.exitFullscreen || document.webkitExitFullscreen;
  const emTela = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (pedirTela && sairTela) {
    btnTela.hidden = false;
    btnTela.addEventListener("click", () => {
      try { if (emTela()) sairTela.call(document); else pedirTela.call(raiz); } catch {}
    });
    const atualizar = () => { btnTela.setAttribute("aria-pressed", String(emTela())); btnTela.textContent = emTela() ? "Sair da tela cheia" : "Tela cheia"; };
    document.addEventListener("fullscreenchange", atualizar); document.addEventListener("webkitfullscreenchange", atualizar);
  }

  novaPartida(); novaCartela();
})();