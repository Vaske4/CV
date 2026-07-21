/* ===========================================================
   site.js — shared behaviour for every page of the portfolio.

   Handles the four things every page needs: the EN/DE language
   switch, the scroll-in reveals, the scroll spy on the nav, and
   the mobile burger menu.

   Each page defines its own copy dictionary and then calls:

     initSite({ translations: { en: {...}, de: {...} } });

   Pass nothing (or omit `translations`) and the language switch
   is simply skipped — everything else still runs.
   =========================================================== */

const LANG_KEY = 'siteLang';

function initSite(options = {}) {
  const translations = options.translations || null;

  /* ---------- i18n ----------
     Elements point at a dictionary key through a data attribute:
       data-i18n       -> textContent
       data-i18n-html  -> innerHTML (for copy containing markup)
       data-i18n-aria  -> aria-label
       data-i18n-alt   -> alt
     A missing key falls back to whatever is already in the HTML. */
  if (translations) {
    const applyLang = (lang) => {
      const dict = translations[lang] || translations.en;
      document.documentElement.lang = lang;

      const set = (attr, apply) => {
        document.querySelectorAll('[' + attr + ']').forEach(el => {
          const value = dict[el.getAttribute(attr)];
          if (value != null) apply(el, value);
        });
      };

      set('data-i18n', (el, v) => { el.textContent = v; });
      set('data-i18n-html', (el, v) => { el.innerHTML = v; });
      set('data-i18n-aria', (el, v) => el.setAttribute('aria-label', v));
      set('data-i18n-alt', (el, v) => el.setAttribute('alt', v));
      if (dict.page_title) document.title = dict.page_title;

      document.querySelectorAll('.lang-switch button').forEach(b => {
        const on = b.dataset.lang === lang;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    };

    // English on the first visit; the manual choice is remembered and
    // shared across pages through localStorage.
    applyLang(localStorage.getItem(LANG_KEY) || 'en');

    document.querySelectorAll('.lang-switch button').forEach(btn => {
      btn.addEventListener('click', () => {
        localStorage.setItem(LANG_KEY, btn.dataset.lang);
        applyLang(btn.dataset.lang);
      });
    });
  }

  /* ---------- Scroll-in reveals, staggered in groups of three ---------- */
  const revealTargets = [...document.querySelectorAll('.fade-up')];
  const reveal = el => el.classList.add('in');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          reveal(e.target);
          observer.unobserve(e.target);
        }
      }
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });

    revealTargets.forEach((el, i) => {
      el.style.transitionDelay = ((i % 3) * 0.07) + 's';
      observer.observe(el);
    });

    // Anything already on screen at load reveals immediately; the timeout
    // is a safety net so content can never stay invisible if the observer
    // misfires (e.g. inside a container that is still laying out).
    requestAnimationFrame(() => {
      revealTargets.forEach(el => {
        if (el.getBoundingClientRect().top < window.innerHeight * 1.05) reveal(el);
      });
    });
    setTimeout(() => revealTargets.forEach(reveal), 1800);
  } else {
    revealTargets.forEach(reveal);
  }

  /* ---------- Scroll spy + nav shadow ---------- */
  const siteNav = document.querySelector('.site-nav');
  const sections = [...document.querySelectorAll('section[id]')];
  const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];

  if (siteNav) {
    const onScroll = () => {
      siteNav.classList.toggle('scrolled', window.scrollY > 20);

      if (!sections.length) return;
      const y = window.scrollY + 100; // sticky nav offset
      let id = sections[0].id;
      for (const s of sections) {
        if (y >= s.offsetTop) id = s.id;
      }
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Mobile burger menu ---------- */
  const body = document.body;
  const menuBtn = document.querySelector('.menu-toggle');
  const navList = document.querySelector('.nav-links');

  menuBtn?.addEventListener('click', () => {
    const open = body.classList.toggle('nav-open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  navList?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    if (body.classList.contains('nav-open')) {
      body.classList.remove('nav-open');
      menuBtn?.setAttribute('aria-expanded', 'false');
    }
  }));
}
