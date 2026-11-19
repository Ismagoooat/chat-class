/*!
 * tutoriel.js — Tutoriel guidé « nouveau arrivant » pour le Chat de Classe
 * ---------------------------------------------------------------------------
 * FICHIER AUTONOME : aucune dépendance (ni Tailwind, ni Firebase, ni le script
 * principal). Il s'intègre en UNE ligne, juste avant </body> :
 *
 *     <script src="tutoriel.js"></script>
 *
 * Pour le retirer : supprimer cette ligne. Rien d'autre à nettoyer.
 *
 * Ce que fait le fichier :
 *   - affiche un parcours guidé (spotlight + bulle) sur les parties importantes ;
 *   - se lance tout seul après la CRÉATION d'un compte (réglable : CONFIG.autoStart) ;
 *   - ajoute un bouton « 🎓 Tutoriel » dans le menu pour le relancer ;
 *   - est skippable à tout moment : bouton « Passer », ✕, ou touche Échap.
 *
 * Comment il trouve les éléments du site (voir `target` dans STEPS) :
 *   1. d'abord un attribut  data-tuto="nom"  (à ajouter dans la nouvelle version
 *      du site : c'est la méthode la plus robuste, voir INTEGRATION.md) ;
 *   2. sinon les id / attributs actuels du site (secours).
 *   Si un élément est introuvable, l'étape s'affiche quand même, centrée,
 *   sans mise en surbrillance : le tuto ne plante jamais à cause d'un changement.
 *
 * Fonctions du site utilisées (toutes optionnelles) :
 *   window.switchChannel(canal), window.toggleSidebar()
 *
 * API publique :  Tuto.start()  Tuto.stop()  Tuto.reset()  Tuto.isDone()
 */
(function () {
  "use strict";
  if (window.Tuto) return;

  /* =====================================================================
   *  1. RÉGLAGES
   * ===================================================================== */
  const CONFIG = {
    // 'new-accounts' : se lance seulement après la création d'un compte
    // 'everyone'     : se lance une fois pour tout le monde (si jamais vu sur cet appareil)
    // 'off'          : ne se lance jamais seul (bouton « Tutoriel » uniquement)
    autoStart: "new-accounts",
    addMenuButton: true,           // ajoute « 🎓 Tutoriel » sous « ❓ Commandes »
    menuButtonAfter: "#help-btn",  // élément après lequel insérer le bouton
    doneKey: "chat_tuto_done",     // localStorage : tuto déjà vu/passé
    pendingKey: "chat_tuto_pending", // localStorage : compte tout juste créé
    pendingMaxAgeMs: 30 * 60 * 1000,
    startDelayMs: 900,             // délai après la connexion avant de se lancer
    mobileBreakpoint: 768,         // même seuil que la sidebar du site (md)
  };

  /* =====================================================================
   *  2. ÉTAPES  (c'est ici qu'on modifie le contenu du tuto)
   *  - target : sélecteur CSS, ou liste de sélecteurs essayés dans l'ordre.
   *             Un sélecteur peut en viser plusieurs (a, b) → zone englobante.
   *  - room   : 'chat' (un salon de discussion) | 'hw' | 'games'
   *  - sidebar: true = ouvrir le menu latéral sur mobile pour cette étape
   * ===================================================================== */
  const STEPS = [
    {
      title: "👋 Bienvenue sur le Chat de Classe !",
      text:
        "<p>En une minute, on te montre l'essentiel : <b>discuter</b>, retrouver les <b>devoirs</b> et <b>jouer</b> avec la classe.</p>" +
        "<p class='tuto-muted'>Tu peux quitter quand tu veux avec « Passer » (ou la touche Échap). Tu pourras le relancer via « 🎓 Tutoriel » dans le menu.</p>",
      target: null,
      next: "C'est parti !",
    },
    {
      title: "💬 Les salons",
      text:
        "<p>Ici, tu choisis où discuter. Clique sur un salon pour y entrer : <b>général</b>, <b>loisirs-partage</b>, et d'autres créés par les admins.</p>" +
        "<p class='tuto-muted'>Les salons 🔒 privés ne s'affichent que si tu y as accès.</p>",
      target: ['[data-tuto="rooms"]', "#room-list"],
      room: "chat",
      sidebar: true,
    },
    {
      title: "📨 Le fil de discussion",
      text:
        "<p>Les messages arrivent <b>en direct</b> : pas besoin de rafraîchir la page. « Quelqu'un écrit… » apparaît quand un camarade tape.</p>" +
        "<p class='tuto-muted'>Une annonce 📢 des admins peut s'afficher en haut du salon.</p>",
      target: ['[data-tuto="messages"]', "#messages-container"],
      room: "chat",
    },
    {
      title: "✍️ Écrire un message",
      text:
        "<p>Tape ton message puis <b>Entrée</b> pour l'envoyer (500 caractères max).</p>" +
        "<ul><li><code>**mot**</code> → <b>gras</b></li><li><code>@pseudo</code> → mentionne un camarade</li><li><code>/help</code> → liste des commandes</li></ul>",
      target: ['[data-tuto="composer-input"]', "#message-input"],
      room: "chat",
    },
    {
      title: "📊 Sondages, images et fichiers",
      text:
        "<p><b>📊</b> lance un sondage : la classe vote en un clic.</p>" +
        "<p><b>🖼️</b> partage une image ou un fichier (PDF, Word, texte…, 600 Ko max) depuis ton appareil ou avec un lien.</p>" +
        "<p class='tuto-muted'>Selon le salon, ces boutons peuvent être désactivés.</p>",
      target: ['[data-tuto="composer-tools"]', "#poll-btn, #img-btn"],
      room: "chat",
    },
    {
      title: "⋯ Réagir et répondre",
      text:
        "<p>Clique sur <b>⋯</b> à côté d'un message pour <b>réagir</b> avec un emoji ou <b>répondre</b> en citant le message.</p>" +
        "<p>Sur tes propres messages, tu peux aussi les <b>modifier</b> ou les <b>supprimer</b>.</p>",
      target: ['[data-tuto="message-menu"]', '#messages-container [data-act="menu"]'],
      room: "chat",
    },
    {
      title: "📚 L'espace devoirs",
      text:
        "<p>Le coin d'entraide de la classe, rangé par rubriques : <b>🙋 Demande d'aide</b>, <b>🙋‍♂️ Demande de cours</b>, <b>📚 Cours</b>, <b>📝 Feuille de révision</b> et <b>📌 Autres</b>.</p>" +
        "<ul><li><b>＋ Ajouter</b> pour publier : titre, détails, <b>date limite</b> (facultatif), image ou fichier.</li>" +
        "<li>Sur chaque publication, tu peux <b>réagir</b> (👍 ✅ …) et <b>commenter</b> pour aider ou répondre.</li></ul>" +
        "<p class='tuto-muted'>On y accède avec le bouton « 📚 Espace devoirs » du menu.</p>",
      target: ['[data-tuto="hw-toolbar"]', '#hw-zone [data-hw="all"], #hw-zone [onclick="openHwEditor()"]', "#hw-zone"],
      room: "hw",
    },
    {
      title: "🎮 L'espace jeux",
      text:
        "<p>Lance une partie, un camarade la rejoint, et c'est parti : <b>Morpion</b>, <b>Puissance 4</b>, <b>Pierre-feuille-ciseaux</b>, <b>Cochon</b>, <b>Mémory</b> et <b>Réflexe</b>.</p>" +
        "<p class='tuto-muted'>Les parties en attente de joueur apparaissent dans la liste : clique sur « Rejoindre ».</p>",
      target: ['[data-tuto="games-list"]', '#games-zone [data-gm="new"]', "#games-zone"],
      room: "games",
    },
    {
      title: "🟢 Qui est en ligne",
      text:
        "<p>Les camarades connectés en ce moment. <b>Clique sur un pseudo</b> pour voir son profil et lui envoyer un <b>message privé</b>.</p>",
      target: ['[data-tuto="online"]', "#online-list"],
      sidebar: true,
    },
    {
      title: "📥 Messages privés, idées et profil",
      text:
        "<ul><li><b>📥 Boîte de réception</b> : tes messages privés (pastille rouge = nouveau).</li>" +
        "<li><b>☝️ Boîte à idées</b> : propose une amélioration ou signale un bug.</li>" +
        "<li><b>👤 Mon profil</b> : pseudo, bio, avatar, couleur, mot de passe.</li></ul>",
      target: [
        '[data-tuto="my-actions"]',
        '#sidebar [onclick="openInbox()"], #sidebar [onclick="openSuggestionsModal()"], #sidebar [onclick="openProfileEditor()"]',
      ],
      sidebar: true,
    },
    {
      title: "🔧 Les petits outils",
      text:
        "<p><b>🔍</b> cherche dans les messages du salon, <b>🔔</b> coupe ou remet le son, <b>🌙</b> active le mode sombre.</p>" +
        "<p>Le bouton <b>ℹ️</b> à côté du titre affiche les règles du salon (délai entre messages, qui peut écrire…).</p>",
      target: ['[data-tuto="topbar-tools"]', "#search-input, #sound-btn, #theme-btn", "#sound-btn, #theme-btn"],
    },
    {
      title: "❓ Les commandes, et c'est tout !",
      text:
        "<p>Tape <code>/help</code> dans un message, ou clique ici, pour voir les commandes : <code>/roll</code> (dé), <code>/flip</code> (pile ou face), <code>/8ball</code>…</p>" +
        "<p><b>Tu es prêt(e) !</b> Passe dire bonjour dans le salon général 🙂</p>",
      target: ['[data-tuto="help"]', "#help-btn"],
      sidebar: true,
      next: "Terminer",
    },
  ];

  /* =====================================================================
   *  3. OUTILS
   * ===================================================================== */
  const $ = (s, r) => (r || document).querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const isMobile = () => window.innerWidth < CONFIG.mobileBreakpoint;

  function isShown(el) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (r.right <= 0 || r.left >= window.innerWidth || r.bottom <= 0 || r.top >= window.innerHeight + 4000) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  }

  function findTargets(step) {
    const list = [].concat(step.target || []);
    for (const sel of list) {
      let els = [];
      try { els = [...document.querySelectorAll(sel)].filter(isShown); } catch (e) {}
      if (els.length) return els;
    }
    return [];
  }

  function unionRect(els) {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    els.forEach((e) => {
      const x = e.getBoundingClientRect();
      l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom);
    });
    return { left: l, top: t, width: r - l, height: b - t };
  }

  /* ---- Pilotage de l'interface du site (tout est optionnel) ---- */
  const sidebarEl = () => $("#sidebar");
  const sidebarOpen = () => { const s = sidebarEl(); return !!s && !s.classList.contains("-translate-x-full"); };

  function setSidebar(open) {
    if (!isMobile()) return false;                 // sur ordinateur la barre est toujours visible
    if (sidebarOpen() === open) return false;
    if (typeof window.toggleSidebar === "function") { window.toggleSidebar(); return true; }
    return false;
  }

  function channelTitle() { const t = $("#active-channel-title"); return t ? t.textContent : ""; }
  function currentRoomKind() {
    const t = channelTitle();
    if (t.indexOf("Espace devoirs") !== -1) return "hw";
    if (t.indexOf("Espace jeux") !== -1) return "games";
    return "chat";
  }
  function goRoom(kind) {
    if (!kind || typeof window.switchChannel !== "function") return false;
    if (currentRoomKind() === kind) return false;
    window.switchChannel(kind === "hw" ? "__hw" : kind === "games" ? "__games" : "general");
    return true;
  }

  /* =====================================================================
   *  4. STYLE (préfixé tuto-, indépendant de Tailwind)
   * ===================================================================== */
  const CSS = `
.tuto-root{position:fixed;inset:0;z-index:2147483000;font-family:"Plus Jakarta Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.tuto-block{position:absolute;inset:0;background:transparent}
.tuto-hole{position:fixed;border-radius:14px;pointer-events:none;box-shadow:0 0 0 3px rgba(96,165,250,.95),0 0 0 200vmax rgba(2,6,23,.74);transition:left .28s ease,top .28s ease,width .28s ease,height .28s ease,opacity .2s}
.tuto-hole.tuto-none{opacity:1;border-radius:0;box-shadow:0 0 0 200vmax rgba(2,6,23,.74)}
.tuto-card{position:fixed;box-sizing:border-box;width:min(390px,calc(100vw - 24px));max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);overflow:auto;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:20px;padding:18px 18px 14px;box-shadow:0 24px 60px rgba(2,6,23,.45);transition:left .28s ease,top .28s ease;animation:tuto-pop .22s ease}
.tuto-card h3{margin:0 28px 8px 0;font-size:17px;line-height:1.3;font-weight:800}
.tuto-text{font-size:14px;line-height:1.5;color:#334155}
.tuto-text p{margin:.45em 0}
.tuto-text ul{margin:.45em 0;padding-left:1.15em;list-style:disc}
.tuto-text li{margin:.25em 0}
.tuto-text b{color:#0f172a}
.tuto-text code{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:0 5px;font-size:12.5px;color:#1d4ed8}
.tuto-muted{color:#64748b;font-size:12.5px}
.tuto-x{position:absolute;top:10px;right:10px;width:30px;height:30px;border:0;border-radius:10px;background:transparent;color:#94a3b8;font-size:16px;cursor:pointer}
.tuto-x:hover{background:#f1f5f9;color:#334155}
.tuto-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;flex-wrap:wrap}
.tuto-dots{display:flex;align-items:center;gap:5px}
.tuto-dot{width:6px;height:6px;border-radius:99px;background:#cbd5e1;transition:all .2s}
.tuto-dot.on{width:18px;background:#2563eb}
.tuto-count{font-size:11.5px;color:#94a3b8;margin-left:6px;font-weight:600}
.tuto-btns{display:flex;align-items:center;gap:6px;margin-left:auto}
.tuto-btn{font:inherit;font-size:13.5px;font-weight:700;border-radius:12px;padding:8px 14px;cursor:pointer;border:1px solid transparent}
.tuto-btn:focus-visible,.tuto-x:focus-visible{outline:2px solid #3b82f6;outline-offset:2px}
.tuto-primary{background:#2563eb;color:#fff}.tuto-primary:hover{background:#1d4ed8}
.tuto-ghost{background:#f1f5f9;color:#475569;border-color:#e2e8f0}.tuto-ghost:hover{background:#e2e8f0}
.tuto-skip{background:transparent;color:#64748b;text-decoration:underline;padding:8px 6px}.tuto-skip:hover{color:#0f172a}
.tuto-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483001;background:#0f172a;color:#fff;border:1px solid #334155;border-radius:14px;padding:10px 16px;font:600 13px "Plus Jakarta Sans",system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:calc(100vw - 24px);text-align:center;animation:tuto-pop .22s ease}
.dark .tuto-card{background:#1e293b;color:#f1f5f9;border-color:#334155}
.dark .tuto-text{color:#cbd5e1}.dark .tuto-text b{color:#f8fafc}
.dark .tuto-text code{background:#0f172a;border-color:#334155;color:#93c5fd}
.dark .tuto-muted{color:#94a3b8}
.dark .tuto-x:hover{background:#334155;color:#e2e8f0}
.dark .tuto-dot{background:#475569}.dark .tuto-dot.on{background:#60a5fa}
.dark .tuto-ghost{background:#334155;color:#e2e8f0;border-color:#475569}.dark .tuto-ghost:hover{background:#475569}
.dark .tuto-skip{background:transparent;color:#94a3b8}.dark .tuto-skip:hover{color:#f1f5f9}
@keyframes tuto-pop{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.tuto-hole,.tuto-card{transition:none;animation:none}}
`;

  function injectStyle() {
    if ($("#tuto-style")) return;
    const st = document.createElement("style");
    st.id = "tuto-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* =====================================================================
   *  5. MOTEUR
   * ===================================================================== */
  let active = false, idx = 0, runToken = 0;
  let root, hole, card, els = {};
  let followTimer = null, openedSidebar = false, movedRoom = false;

  function build() {
    root = document.createElement("div");
    root.className = "tuto-root";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "tuto-title");
    root.innerHTML =
      '<div class="tuto-block"></div>' +
      '<div class="tuto-hole tuto-none"></div>' +
      '<div class="tuto-card">' +
        '<button type="button" class="tuto-x" aria-label="Fermer le tutoriel" title="Fermer">✕</button>' +
        '<h3 id="tuto-title"></h3>' +
        '<div class="tuto-text"></div>' +
        '<div class="tuto-foot">' +
          '<div class="tuto-dots"></div>' +
          '<div class="tuto-btns">' +
            '<button type="button" class="tuto-btn tuto-skip">Passer</button>' +
            '<button type="button" class="tuto-btn tuto-ghost tuto-prev">Retour</button>' +
            '<button type="button" class="tuto-btn tuto-primary tuto-next">Suivant</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    document.body.appendChild(root);
    hole = $(".tuto-hole", root);
    card = $(".tuto-card", root);
    els = {
      title: $("#tuto-title", root), text: $(".tuto-text", root), dots: $(".tuto-dots", root),
      skip: $(".tuto-skip", root), prev: $(".tuto-prev", root), next: $(".tuto-next", root), x: $(".tuto-x", root),
    };
    els.x.addEventListener("click", () => finish(false));
    els.skip.addEventListener("click", () => finish(false));
    els.prev.addEventListener("click", () => go(idx - 1));
    els.next.addEventListener("click", () => (idx >= STEPS.length - 1 ? finish(true) : go(idx + 1)));
    // Cliquer à côté de la bulle ne fait rien (évite les clics accidentels sur le site)
    $(".tuto-block", root).addEventListener("click", (e) => e.stopPropagation());
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(false); }
    else if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); els.next.click(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); if (idx > 0) go(idx - 1); }
  }
  const onResize = () => place();

  async function waitTargets(step, timeout) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (findTargets(step).length) return true;
      await sleep(120);
    }
    return false;
  }

  async function go(i) {
    if (!active) return;
    i = Math.max(0, Math.min(STEPS.length - 1, i));
    idx = i;
    const token = ++runToken;
    const s = STEPS[i];

    renderCard(s);

    // 1. Préparer l'interface du site (salon + menu latéral sur mobile)
    let changed = false;
    if (s.room && goRoom(s.room)) { changed = true; movedRoom = true; }
    if (s.target) {
      if (setSidebar(!!s.sidebar)) { changed = true; if (s.sidebar) openedSidebar = true; }
    } else if (setSidebar(false)) changed = true;
    if (changed) await sleep(380);
    if (token !== runToken || !active) return;

    // 2. Attendre que la cible soit affichée (données chargées depuis Firebase…)
    if (s.target) await waitTargets(s, s.room ? 2200 : 900);
    if (token !== runToken || !active) return;

    // 3. Amener la cible dans l'écran, puis la mettre en valeur
    const t = findTargets(s);
    if (t.length === 1) {
      const r = t[0].getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) {
        try { t[0].scrollIntoView({ block: "center", behavior: "auto" }); } catch (e) {}
        await sleep(60);
      }
    }
    place();
    try { els.next.focus({ preventScroll: true }); } catch (e) {}
  }

  function renderCard(s) {
    els.title.textContent = s.title;
    els.text.innerHTML = s.text;
    const last = idx === STEPS.length - 1;
    els.next.textContent = s.next || "Suivant";
    els.prev.style.display = idx === 0 ? "none" : "";
    els.skip.style.display = last ? "none" : "";
    els.dots.innerHTML =
      STEPS.map((_, k) => '<span class="tuto-dot' + (k === idx ? " on" : "") + '"></span>').join("") +
      '<span class="tuto-count">' + (idx + 1) + "/" + STEPS.length + "</span>";
    card.style.animation = "none"; void card.offsetWidth; card.style.animation = "";
  }

  /* Position du halo + de la bulle (appelée aussi en continu pour suivre les changements de mise en page) */
  function place() {
    if (!active || !card) return;
    const s = STEPS[idx];
    const vw = window.innerWidth, vh = window.innerHeight, M = 12, GAP = 14, PAD = 6;
    const found = s.target ? findTargets(s) : [];
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let left, top;

    if (!found.length) {                                   // pas de cible : bulle centrée, fond assombri
      hole.className = "tuto-hole tuto-none";
      hole.style.cssText = "left:" + vw / 2 + "px;top:" + vh / 2 + "px;width:0;height:0";
      left = (vw - cw) / 2; top = (vh - ch) / 2;
    } else {
      const u = unionRect(found);
      const rect = {
        left: Math.max(0, u.left - PAD), top: Math.max(0, u.top - PAD),
        width: Math.min(vw, u.width + PAD * 2), height: Math.min(vh, u.height + PAD * 2),
      };
      hole.className = "tuto-hole";
      hole.style.cssText = "left:" + rect.left + "px;top:" + rect.top + "px;width:" + rect.width + "px;height:" + rect.height + "px";
      const r = { l: rect.left, t: rect.top, r: rect.left + rect.width, b: rect.top + rect.height };
      const big = rect.width * rect.height > vw * vh * 0.35 || (rect.width > vw * 0.6 && rect.height > vh * 0.5);

      if (big) {                                           // grande zone : bulle en bas de la zone
        left = r.l + (rect.width - cw) / 2;
        top = Math.min(r.b - ch - 20, vh - ch - M);
      } else if (vw < 640) {                               // mobile : bulle en haut ou en bas, à l'opposé de la cible
        left = (vw - cw) / 2;
        top = (r.t + r.b) / 2 > vh / 2 ? M : vh - ch - M;
      } else {                                             // ordinateur : à droite, en dessous, au-dessus, à gauche
        const spots = [
          [r.r + GAP, r.t + (rect.height - ch) / 2],
          [r.l + (rect.width - cw) / 2, r.b + GAP],
          [r.l + (rect.width - cw) / 2, r.t - ch - GAP],
          [r.l - cw - GAP, r.t + (rect.height - ch) / 2],
        ];
        const fits = ([x, y]) => x >= M && y >= M && x + cw <= vw - M && y + ch <= vh - M;
        const pick = spots.find(fits) || spots[1];
        left = pick[0]; top = pick[1];
      }
    }
    left = Math.max(M, Math.min(vw - cw - M, left));
    top = Math.max(M, Math.min(vh - ch - M, top));
    card.style.left = left + "px";
    card.style.top = top + "px";
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "tuto-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4500);
  }

  function finish(completed) {
    if (!active) return;
    active = false;
    runToken++;
    clearInterval(followTimer);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onResize, true);
    if (root) root.remove();
    root = hole = card = null;
    store.set(CONFIG.doneKey, "1");
    store.del(CONFIG.pendingKey);
    // Remettre le site dans un état normal : salon général, menu mobile refermé
    if (movedRoom) goRoom("chat");
    if (openedSidebar || isMobile()) setSidebar(false);
    openedSidebar = movedRoom = false;
    toast(completed ? "🎉 Tutoriel terminé ! Relance-le via « 🎓 Tutoriel » dans le menu." : "Tutoriel fermé. Tu peux le relancer via « 🎓 Tutoriel » dans le menu.");
    document.dispatchEvent(new CustomEvent("tuto:end", { detail: { completed: !!completed } }));
  }

  function start() {
    if (active) return;
    injectStyle();
    active = true;
    build();
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    followTimer = setInterval(place, 400);
    document.dispatchEvent(new CustomEvent("tuto:start"));
    go(0);
  }

  /* =====================================================================
   *  6. BOUTON DE MENU + LANCEMENT AUTOMATIQUE
   * ===================================================================== */
  function injectMenuButton() {
    if ($("#tuto-menu-btn")) return true;
    const anchor = $(CONFIG.menuButtonAfter);
    if (!anchor) return false;
    const b = document.createElement("button");
    b.id = "tuto-menu-btn";
    b.type = "button";
    b.className = anchor.className;                 // reprend le style des boutons du menu
    b.textContent = "🎓 Tutoriel";
    b.addEventListener("click", () => start());
    anchor.insertAdjacentElement("afterend", b);
    return true;
  }

  function siteReady() {
    const am = $("#auth-modal"), u = $("#current-user-display");
    return !!(am && am.classList.contains("hidden") && u && u.textContent.trim() && sidebarEl());
  }

  function markIfRegistering() {
    const pf = $("#pseudo-field");                  // visible seulement en mode « Créer un compte »
    if (pf && !pf.classList.contains("hidden")) store.set(CONFIG.pendingKey, String(Date.now()));
  }

  function shouldAutoStart() {
    if (store.get(CONFIG.doneKey)) return false;
    if (CONFIG.autoStart === "everyone") return true;
    if (CONFIG.autoStart === "new-accounts") {
      const ts = parseInt(store.get(CONFIG.pendingKey) || "0", 10);
      return !!ts && Date.now() - ts < CONFIG.pendingMaxAgeMs;
    }
    return false;
  }

  function init() {
    if (CONFIG.autoStart === "new-accounts") {
      document.addEventListener("click", (e) => {
        const t = e.target && e.target.closest ? e.target : null;
        if (!t) return;
        if (t.closest("#auth-submit")) markIfRegistering();
        else if (t.closest("#tab-login")) store.del(CONFIG.pendingKey);
      }, true);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target && e.target.closest && e.target.closest("#auth-modal")) markIfRegistering();
      }, true);
    }

    const t0 = Date.now();
    let started = false;
    const iv = setInterval(() => {
      if (CONFIG.addMenuButton) injectMenuButton();
      if (!started && siteReady()) {
        started = true;
        if (shouldAutoStart()) setTimeout(() => { if (!active) start(); }, CONFIG.startDelayMs);
      }
      const menuOk = !CONFIG.addMenuButton || $("#tuto-menu-btn");
      if ((started && menuOk) || Date.now() - t0 > 2 * 60 * 60 * 1000) clearInterval(iv);
    }, 400);
  }

  window.Tuto = {
    start,
    stop: () => finish(false),
    reset: () => { store.del(CONFIG.doneKey); store.del(CONFIG.pendingKey); },
    isDone: () => !!store.get(CONFIG.doneKey),
    config: CONFIG,
    steps: STEPS,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
