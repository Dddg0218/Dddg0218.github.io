/* =========================================================
   邵逸煌 · 个人主页  main.js
   1 工具 / 提示      2 主题        3 入场与滚动揭示
   4 数字滚动         5 滚动状态      6 指针交互
   7 复制与快捷面板   8 后端交互（联系 / 留言 / 访问）
   ========================================================= */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var body = doc.body;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function on(el, type, fn, opts) { if (el) el.addEventListener(type, fn, opts); }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------------- 0. API 层 ---------------- */
  var API = location.protocol === 'file:' ? '' : '/api';
  var apiOnline = false;

  function apiFetch(path, options, timeout) {
    if (!API) return Promise.reject(new Error('offline'));
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeout || 4500);
    var headers = { 'Accept': 'application/json' };
    if (options && options.body) headers['Content-Type'] = 'application/json';
    var config = Object.assign({ signal: ctrl ? ctrl.signal : undefined, headers: headers }, options || {});
    return fetch(API + path, config)
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error((data && data.error) || 'HTTP ' + res.status);
          return data;
        });
      })
      .finally(function () { clearTimeout(timer); });
  }

  /* ---------------- 1. 提示条 ---------------- */
  var toastStack = $('#toast-stack');

  function toast(message) {
    if (!toastStack) return;
    var el = doc.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    toastStack.appendChild(el);
    setTimeout(function () {
      el.classList.add('is-out');
      setTimeout(function () { el.remove(); }, 320);
    }, 2600);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      doc.body.appendChild(ta);
      ta.select();
      try { doc.execCommand('copy'); resolve(); } catch (err) { reject(err); }
      ta.remove();
    });
  }

  /* ---------------- 2. 主题 ---------------- */
  var themeBtn = $('#theme-toggle');
  var themeMeta = doc.querySelector('meta[name="theme-color"]');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#141110' : '#f7f2e9');
    if (themeBtn) {
      themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
      themeBtn.setAttribute('aria-label', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
    }
  }

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('syh-theme', next); } catch (err) { /* 无痕模式忽略 */ }
    toast(next === 'dark' ? '已切换为深色' : '已切换为浅色');
  }

  on(themeBtn, 'click', toggleTheme);

  /* ---------------- 3. 入场与滚动揭示 ---------------- */
  var revealEls = $$('[data-reveal]');
  revealEls.forEach(function (el) {
    var d = el.getAttribute('data-reveal-delay');
    if (d) el.style.setProperty('--d', d + 'ms');
  });

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { revealObserver.observe(el); });

    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        counterObserver.unobserve(entry.target);
      });
    }, { threshold: 0.35 });
    $$('[data-count]').forEach(function (el) { counterObserver.observe(el); });

    var timeline = $('#timeline');
    if (timeline) {
      var timelineObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          timeline.classList.add('is-drawn');
          timelineObserver.unobserve(timeline);
        });
      }, { threshold: 0.12 });
      timelineObserver.observe(timeline);
    }
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    $$('[data-count]').forEach(function (el) { el.textContent = finalText(el); });
    var tl = $('#timeline');
    if (tl) tl.classList.add('is-drawn');
  }

  /* 3.1 兜底：滚动时再检查一遍，避免 IntersectionObserver 在低帧率下漏触发 */
  var pendingReveal = revealEls.slice();
  var pendingCounters = $$('[data-count]');

  function revealInView() {
    if (!pendingReveal.length && !pendingCounters.length) return;
    var trigger = window.innerHeight * 0.94;
    pendingReveal = pendingReveal.filter(function (el) {
      if (el.classList.contains('is-visible')) return false;
      if (el.getBoundingClientRect().top < trigger) {
        el.classList.add('is-visible');
        return false;
      }
      return true;
    });
    pendingCounters = pendingCounters.filter(function (el) {
      if (el.getAttribute('data-done') === '1') return false;
      if (el.getBoundingClientRect().top < window.innerHeight) {
        runCounter(el);
        return false;
      }
      return true;
    });
  }

  /* ---------------- 4. 数字滚动 ---------------- */
  function trimZero(str) {
    return str.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
  }

  function formatNumber(value, format) {
    if (format === 'wan') {
      if (value >= 100000000) return trimZero((value / 100000000).toFixed(2)) + '亿';
      if (value >= 10000) {
        var w = value / 10000;
        return trimZero(w >= 100 ? String(Math.round(w)) : w.toFixed(1)) + '万';
      }
      return String(Math.round(value));
    }
    return Math.round(value).toLocaleString('en-US');
  }

  function finalText(el) {
    return formatNumber(Number(el.getAttribute('data-count')) || 0, el.getAttribute('data-format'));
  }

  function runCounter(el) {
    if (el.getAttribute('data-done') === '1') return;
    el.setAttribute('data-done', '1');
    var target = Number(el.getAttribute('data-count')) || 0;
    var format = el.getAttribute('data-format');
    if (reduced) { el.textContent = formatNumber(target, format); return; }
    var duration = 1900;
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var p = clamp((ts - start) / duration, 0, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatNumber(target * eased, format);
      if (p < 1) window.requestAnimationFrame(tick);
      else el.textContent = formatNumber(target, format);
    }
    window.requestAnimationFrame(tick);
  }

  /* ---------------- 5. 滚动状态 ---------------- */
  var header = $('#site-header');
  var progressBar = $('#scroll-progress-bar');
  var toTop = $('#to-top');
  var toTopRing = $('#to-top-ring');
  var navLinks = $$('.nav-link');
  var navPill = $('#nav-pill');
  var sections = ['about', 'projects', 'skills', 'journey', 'numbers', 'platforms', 'contact']
    .map(function (id) { return doc.getElementById(id); })
    .filter(Boolean);
  var ringLength = 100.5;
  var activeId = '';
  var ticking = false;

  function movePill(link) {
    if (!navPill || !link) return;
    var nav = link.closest('.nav');
    if (!nav) return;
    var navRect = nav.getBoundingClientRect();
    var rect = link.getBoundingClientRect();
    navPill.style.width = (rect.width * 0.55).toFixed(1) + 'px';
    navPill.style.transform = 'translateX(' + (rect.left - navRect.left + rect.width * 0.225).toFixed(1) + 'px)';
    navPill.style.opacity = '1';
  }

  function updateScrollState() {
    var y = window.pageYOffset || doc.documentElement.scrollTop;
    var max = doc.documentElement.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? clamp(y / max, 0, 1) : 0;

    if (progressBar) progressBar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
    if (header) header.classList.toggle('is-scrolled', y > 8);
    if (toTop) toTop.classList.toggle('is-on', y > window.innerHeight * 0.6);
    if (toTopRing) toTopRing.style.strokeDashoffset = String((ringLength * (1 - ratio)).toFixed(2));

    var probe = y + (header ? header.offsetHeight : 74) + window.innerHeight * 0.28;
    var current = '';
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= probe) current = sections[i].id;
    }
    if (current !== activeId) {
      activeId = current;
      navLinks.forEach(function (link) {
        var isOn = link.getAttribute('href') === '#' + current;
        link.classList.toggle('is-active', isOn);
        if (isOn) movePill(link);
      });
      if (!current && navPill) navPill.style.opacity = '0';
    }

    revealInView();
  }

  function requestScrollUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateScrollState();
      ticking = false;
    });
  }

  on(window, 'scroll', requestScrollUpdate, { passive: true });
  on(window, 'resize', requestScrollUpdate);
  on(toTop, 'click', function () {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  /* ---------------- 5.1 移动端菜单 ---------------- */
  var menuBtn = $('#menu-btn');
  var scrim = $('#nav-scrim');

  function setNav(open) {
    body.classList.toggle('nav-open', open);
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
    }
    if (scrim) {
      if (open) {
        scrim.hidden = false;
        window.requestAnimationFrame(function () { scrim.classList.add('is-on'); });
      } else {
        scrim.classList.remove('is-on');
        setTimeout(function () {
          if (!body.classList.contains('nav-open')) scrim.hidden = true;
        }, 350);
      }
    }
    if (open) {
      var first = $('.nav-link');
      if (first && window.innerWidth <= 760) {
        setTimeout(function () { first.focus(); }, 280);
      }
    }
  }

  on(menuBtn, 'click', function () { setNav(!body.classList.contains('nav-open')); });
  on(scrim, 'click', function () { setNav(false); });
  navLinks.forEach(function (link) { on(link, 'click', function () { setNav(false); }); });

  on(doc, 'keydown', function (e) {
    if (e.key === 'Escape' && body.classList.contains('nav-open')) setNav(false);
    if (e.key === 'Tab' && body.classList.contains('nav-open')) {
      var focusables = $$('.nav a');
      if (!focusables.length) return;
      var firstEl = focusables[0];
      var lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && doc.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && doc.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }
  });

  on(window, 'resize', function () {
    if (window.innerWidth > 760 && body.classList.contains('nav-open')) setNav(false);
  });

  /* ---------------- 6. 指针交互 ---------------- */
  if (finePointer && !reduced) {
    var aura = $('#cursor-aura');
    if (aura) {
      var ax = window.innerWidth / 2;
      var ay = window.innerHeight / 2;
      var tx = ax;
      var ty = ay;
      on(window, 'pointermove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
      (function auraLoop() {
        ax = lerp(ax, tx, 0.1);
        ay = lerp(ay, ty, 0.1);
        aura.style.transform = 'translate3d(' + ax.toFixed(1) + 'px,' + ay.toFixed(1) + 'px,0)';
        window.requestAnimationFrame(auraLoop);
      })();
      aura.style.opacity = '0.9';
    }

    $$('[data-magnetic]').forEach(function (el) {
      var strength = 7;
      on(el, 'pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = ((e.clientX - r.left) / r.width - 0.5) * strength * 2;
        var dy = ((e.clientY - r.top) / r.height - 0.5) * strength;
        el.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      });
      on(el, 'pointerleave', function () { el.style.transform = ''; });
    });

    $$('[data-tilt]').forEach(function (card) {
      var max = card.classList.contains('portrait') ? 6 : 4;
      on(card, 'pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        card.style.transform = 'perspective(1000px) rotateX(' + ((0.5 - py) * max).toFixed(2) + 'deg) rotateY(' + ((px - 0.5) * max).toFixed(2) + 'deg)';
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
      on(card, 'pointerleave', function () { card.style.transform = ''; });
    });

    $$('.btn').forEach(function (btn) {
      on(btn, 'pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        btn.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 100).toFixed(0) + '%');
        btn.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 100).toFixed(0) + '%');
      });
    });
  }

  /* ---------------- 7. 复制 / 快捷面板 ---------------- */
  function copyEmail() {
    var email = '1142638314@qq.com';
    copyText(email).then(function () {
      toast('邮箱已复制：' + email);
      var label = $('#copy-email span');
      if (label) {
        var old = label.textContent;
        label.textContent = '已复制';
        setTimeout(function () { label.textContent = old; }, 1800);
      }
    }).catch(function () { toast('复制失败，请手动选择：' + email); });
  }

  on($('#copy-email'), 'click', copyEmail);
  on($('.contact-mail'), 'click', function (e) { e.preventDefault(); copyEmail(); });

  var palette = $('#palette');
  var paletteInput = $('#palette-input');
  var paletteList = $('#palette-list');
  var paletteOpenBtn = $('#palette-open');
  var paletteItems = [];
  var paletteIndex = 0;
  var paletteReturnFocus = null;

  var commands = [
    { label: '回到顶部', hint: 'Home', run: function () { window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); } },
    { label: '关于我', hint: '01', run: function () { go('#about'); } },
    { label: '做过的项目', hint: '02', run: function () { go('#projects'); } },
    { label: '技术栈', hint: '03', run: function () { go('#skills'); } },
    { label: '经历', hint: '04', run: function () { go('#journey'); } },
    { label: '账号数据', hint: '05', run: function () { go('#numbers'); } },
    { label: '我的账号', hint: '06', run: function () { go('#platforms'); } },
    { label: '联系我', hint: '07', run: function () { go('#contact'); } },
    { label: '复制邮箱', hint: 'Email', run: copyEmail },
    { label: '切换深色 / 浅色', hint: 'Theme', run: toggleTheme },
    { label: '去留言板', hint: 'Guestbook', run: function () { go('#guestbook'); setTimeout(function () { var el = $('#gb-name'); if (el) el.focus(); }, 620); } }
  ];

  function go(hash) {
    var target = doc.querySelector(hash);
    if (target) target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  function renderPalette(query) {
    if (!paletteList) return;
    paletteList.textContent = '';
    paletteItems = [];
    paletteIndex = 0;
    var q = (query || '').trim().toLowerCase();
    var matches = commands.filter(function (c) {
      return !q || c.label.toLowerCase().indexOf(q) > -1 || c.hint.toLowerCase().indexOf(q) > -1;
    });

    if (!matches.length) {
      var empty = doc.createElement('li');
      empty.className = 'palette-empty';
      empty.textContent = '没有匹配的命令';
      paletteList.appendChild(empty);
      return;
    }

    matches.forEach(function (cmd, i) {
      var li = doc.createElement('li');
      li.className = 'palette-item';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === 0));
      li.tabIndex = -1;

      var idx = doc.createElement('span');
      idx.className = 'pi-idx';
      idx.textContent = String(i + 1).padStart(2, '0');

      var label = doc.createElement('span');
      label.textContent = cmd.label;

      var hint = doc.createElement('span');
      hint.className = 'pi-hint';
      hint.textContent = cmd.hint;

      li.appendChild(idx);
      li.appendChild(label);
      li.appendChild(hint);
      li.addEventListener('click', function () { executeCommand(cmd); });
      li.addEventListener('pointermove', function () { setPaletteIndex(i); });
      paletteList.appendChild(li);
      paletteItems.push(li);
    });
  }

  function setPaletteIndex(i) {
    if (!paletteItems.length) return;
    paletteIndex = clamp(i, 0, paletteItems.length - 1);
    paletteItems.forEach(function (el, idx) {
      el.setAttribute('aria-selected', String(idx === paletteIndex));
    });
  }

  function executeCommand(cmd) {
    closePalette();
    setTimeout(function () { cmd.run(); }, 60);
  }

  function openPalette() {
    if (!palette || typeof palette.showModal !== 'function') return;
    paletteReturnFocus = doc.activeElement;
    renderPalette('');
    if (paletteInput) paletteInput.value = '';
    palette.showModal();
    body.classList.add('palette-open');
    setTimeout(function () { if (paletteInput) paletteInput.focus(); }, 40);
  }

  function closePalette() {
    if (!palette || !palette.open) return;
    palette.close();
  }

  on(paletteOpenBtn, 'click', openPalette);
  on(palette, 'close', function () {
    body.classList.remove('palette-open');
    if (paletteReturnFocus && typeof paletteReturnFocus.focus === 'function') paletteReturnFocus.focus();
  });
  on(palette, 'click', function (e) { if (e.target === palette) closePalette(); });
  on(paletteInput, 'input', function () { renderPalette(paletteInput.value); });

  on(paletteInput, 'keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIndex(paletteIndex + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteIndex(paletteIndex - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      var cmd = commands.filter(function (c) {
        return paletteItems[paletteIndex] && paletteItems[paletteIndex].textContent.indexOf(c.label) > -1;
      })[0];
      if (cmd) executeCommand(cmd);
    }
  });

  on(doc, 'keydown', function (e) {
    var key = e.key ? e.key.toLowerCase() : '';
    if ((e.metaKey || e.ctrlKey) && key === 'k') {
      e.preventDefault();
      if (palette && palette.open) closePalette(); else openPalette();
    }
  });

  /* ---------------- 8. 后端交互 ---------------- */
  var contactForm = $('#contact-form');
  var contactSubmit = $('#contact-submit');

  function setFieldError(id, message) {
    var input = doc.getElementById(id);
    if (!input) return;
    var field = input.closest('.field');
    var err = doc.querySelector('[data-error-for="' + id + '"]');
    if (field) field.classList.toggle('has-error', Boolean(message));
    if (err) err.textContent = message || '';
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function clearErrors() {
    ['cf-name', 'cf-contact', 'cf-message'].forEach(function (id) { setFieldError(id, ''); });
  }

  function validateContact(data) {
    clearErrors();
    var ok = true;
    if (data.name.trim().length < 1) { setFieldError('cf-name', '请留一个称呼'); ok = false; }
    if (data.contact.trim().length < 2) { setFieldError('cf-contact', '请留一个能联系到你的方式'); ok = false; }
    if (data.message.trim().length < 5) { setFieldError('cf-message', '再多写几个字吧（至少 5 个字）'); ok = false; }
    return ok;
  }

  /* 静态托管（GitHub Pages）没有后端时，走 FormSubmit 把内容直接发到邮箱。
     第一次使用会收到一封确认邮件，点一下链接之后就能正常收信。 */
  function sendViaEmail(data) {
    var endpoint = 'https://formsubmit.co/ajax/1142638314@qq.com';
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);
    return fetch(endpoint, {
      method: 'POST',
      signal: ctrl ? ctrl.signal : undefined,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        contact: data.contact,
        message: data.message,
        _subject: '个人主页留言 · ' + data.name,
        _template: 'table',
        _captcha: 'false'
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('formsubmit ' + res.status);
      return 'email';
    }).finally(function () { clearTimeout(timer); });
  }

  /* 最后兜底：把内容写进邮件客户端 */
  function openMailDraft(data) {
    var subject = '个人主页留言 · ' + data.name;
    var body = '称呼：' + data.name + '\n联系方式：' + data.contact + '\n\n' + data.message;
    window.location.href = 'mailto:1142638314@qq.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    return Promise.resolve('mailto');
  }

  var counterEl = doc.querySelector('[data-counter-for="cf-message"]');
  var messageEl = $('#cf-message');

  function updateCounter() {
    if (!counterEl || !messageEl) return;
    counterEl.textContent = messageEl.value.length + ' / 1200';
  }
  on(messageEl, 'input', updateCounter);

  on(contactForm, 'submit', function (e) {
    e.preventDefault();
    if (contactSubmit && contactSubmit.classList.contains('is-loading')) return;

    var data = {
      name: ($('#cf-name') || {}).value || '',
      contact: ($('#cf-contact') || {}).value || '',
      message: ($('#cf-message') || {}).value || '',
      website: (contactForm.querySelector('input[name="website"]') || {}).value || ''
    };

    if (!validateContact(data)) {
      var firstError = contactForm.querySelector('.has-error input, .has-error textarea');
      if (firstError) firstError.focus();
      return;
    }

    if (contactSubmit) contactSubmit.classList.add('is-loading');

    apiFetch('/contact', { method: 'POST', body: JSON.stringify(data) })
      .then(function () { return 'server'; })
      .catch(function () { return sendViaEmail(data); })
      .catch(function () { return openMailDraft(data); })
      .then(function (via) {
        contactForm.reset();
        updateCounter();
        clearErrors();
        if (via === 'email') toast('已发到我的邮箱，会尽快回你');
        else if (via === 'mailto') toast('已帮你写好邮件，点发送就行');
        else toast('已收到，我会尽快回你');
      })
      .catch(function () {
        var text = '称呼：' + data.name + '\n联系方式：' + data.contact + '\n想聊的事：' + data.message;
        copyText(text).then(function () {
          toast('发送失败：内容已复制，发邮件给我即可');
        }).catch(function () {
          toast('发送失败，请直接发邮件：1142638314@qq.com');
        });
      })
      .finally(function () {
        setTimeout(function () {
          if (contactSubmit) contactSubmit.classList.remove('is-loading');
        }, 400);
      });
  });

  /* 8.1 留言板 */
  var gbForm = $('#guestbook-form');
  var gbList = $('#guestbook-list');
  var gbStatus = $('#guestbook-status');
  var LOCAL_KEY = 'syh-guestbook-local';
  var LOCAL_MESSAGES = 'syh-contact-drafts';

  function timeAgo(iso) {
    var t = new Date(iso).getTime();
    if (!t) return '';
    var diff = Math.max(0, Date.now() - t);
    var min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return min + ' 分钟前';
    var hour = Math.floor(min / 60);
    if (hour < 24) return hour + ' 小时前';
    var day = Math.floor(hour / 24);
    if (day < 30) return day + ' 天前';
    return new Date(t).toLocaleDateString('zh-CN');
  }

  function renderGuestItem(item, prepend) {
    if (!gbList) return;
    var empty = gbList.querySelector('.guestbook-empty');
    if (empty) empty.remove();

    var li = doc.createElement('li');
    li.className = 'guestbook-item';

    var name = doc.createElement('span');
    name.className = 'gb-name';
    name.textContent = item.name;

    var text = doc.createElement('p');
    text.className = 'gb-text';
    text.textContent = item.text;

    var time = doc.createElement('time');
    time.dateTime = item.createdAt || '';
    time.textContent = timeAgo(item.createdAt) || '刚刚';

    li.appendChild(name);
    li.appendChild(text);
    li.appendChild(time);

    if (prepend && gbList.firstChild) gbList.insertBefore(li, gbList.firstChild);
    else gbList.appendChild(li);
  }

  function renderGuestEmpty(text) {
    if (!gbList) return;
    gbList.textContent = '';
    var li = doc.createElement('li');
    li.className = 'guestbook-empty';
    li.textContent = text;
    gbList.appendChild(li);
  }

  function readLocal(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (err) { return []; }
  }
  function writeLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value.slice(0, 30))); } catch (err) { /* ignore */ }
  }

  function loadGuestbook() {
    apiFetch('/guestbook', null, 3000)
      .then(function (data) {
        apiOnline = true;
        var items = (data.items || []).slice(0, 12);
        if (!items.length) { renderGuestEmpty('还没有留言，来当第一个吧。'); }
        else { gbList.textContent = ''; items.forEach(function (item) { renderGuestItem(item, false); }); }
        if (gbStatus) { gbStatus.textContent = '已连接 · 留言会实时保存'; gbStatus.classList.remove('is-offline'); }
      })
      .catch(function () {
        var local = readLocal(LOCAL_KEY);
        if (local.length) { gbList.textContent = ''; local.slice(0, 8).forEach(function (item) { renderGuestItem(item, false); }); }
        else { renderGuestEmpty('后端未启动，留言会先暂存在这台电脑上。'); }
        if (gbStatus) { gbStatus.textContent = '本地模式 · 未连接服务器'; gbStatus.classList.add('is-offline'); }
      });
  }

  on(gbForm, 'submit', function (e) {
    e.preventDefault();
    var name = ($('#gb-name') || {}).value || '';
    var text = ($('#gb-text') || {}).value || '';
    if (name.trim().length < 1 || text.trim().length < 2) { toast('昵称和留言都要填一下'); return; }

    var payload = { name: name.trim().slice(0, 24), text: text.trim().slice(0, 120) };
    var submitBtn = gbForm.querySelector('button');

    if (submitBtn) submitBtn.disabled = true;

    apiFetch('/guestbook', { method: 'POST', body: JSON.stringify(payload) })
      .then(function (data) {
        var item = data.item || { name: payload.name, text: payload.text, createdAt: new Date().toISOString() };
        if (gbList && gbList.querySelector('.guestbook-empty')) gbList.textContent = '';
        renderGuestItem(item, true);
        gbForm.reset();
        toast('留言已发布');
      })
      .catch(function () {
        var item = { name: payload.name, text: payload.text, createdAt: new Date().toISOString() };
        var local = readLocal(LOCAL_KEY);
        local.unshift(item);
        writeLocal(LOCAL_KEY, local);
        if (gbList && gbList.querySelector('.guestbook-empty')) gbList.textContent = '';
        renderGuestItem(item, true);
        gbForm.reset();
        toast('已暂存在本地（后端未连接）');
      })
      .finally(function () { if (submitBtn) submitBtn.disabled = false; });
  });

  /* 8.2 访问统计 + 后端状态 */
  var visitEl = $('#visit-count');
  var statusDot = $('#status-dot');
  var statusText = $('#status-text');

  function markOnline(online) {
    apiOnline = online;
    if (statusDot) {
      statusDot.classList.toggle('is-online', online);
      statusDot.classList.toggle('is-offline', !online);
    }
    if (statusText) statusText.textContent = online ? 'API 在线' : '本地模式';
  }

  apiFetch('/health', null, 2500)
    .then(function (data) {
      markOnline(true);
      if (visitEl && data.visits) visitEl.textContent = Number(data.visits).toLocaleString('en-US');
      return apiFetch('/visits', { method: 'POST' }, 2500);
    })
    .then(function (data) {
      if (visitEl && data && data.count) visitEl.textContent = Number(data.count).toLocaleString('en-US');
    })
    .catch(function () {
      markOnline(false);
      if (visitEl) visitEl.textContent = '—';
    });

  /* ---------------- 9. 初始化 ---------------- */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  function boot() {
    body.classList.remove('is-loading');
    updateScrollState();
    revealInView();
    setTimeout(revealInView, 500);
    updateCounter();
    loadGuestbook();
  }

  if (doc.readyState === 'complete') {
    setTimeout(boot, 80);
  } else {
    on(window, 'load', function () { setTimeout(boot, 80); });
  }
})();
