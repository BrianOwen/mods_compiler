/**
 * Mods → FabMo Bridge
 *
 * Bundled into every .fma produced by mods_compiler. Two jobs:
 *   1. Lay a simplified "shell" UI over the running Mods app — title,
 *      auto-discovered inputs panel, mirrored preview canvas, Submit button.
 *      A "Look under the hood" toggle reveals the full Mods graph.
 *   2. Intercept `<a download>` clicks from the Mods `save file` module
 *      and route the captured file to the FabMo job queue (in FabMo) or
 *      let the normal browser download proceed (outside FabMo).
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // FabMo intercept (same behavior as before)
  // ---------------------------------------------------------------------------
  var CNC_RE = /\.(sbp|nc|gcode|tap|cnc|nci|ngc|g)$/i;
  function inFabMo() { return typeof FabMoDashboard !== 'undefined'; }
  var fabmo = null;
  function ensureFabMo() {
    if (fabmo) return fabmo;
    if (inFabMo()) {
      try { fabmo = new FabMoDashboard(); }
      catch (e) { console.warn('[mods-fabmo] FabMoDashboard init failed:', e); }
    }
    return fabmo;
  }
  function decodeHref(href) {
    var i = href.indexOf(',');
    if (i < 0) return null;
    var meta = href.slice(0, i);
    var body = href.slice(i + 1);
    if (meta.indexOf(';base64') >= 0) {
      try { return atob(body); } catch (e) { return null; }
    }
    try { return decodeURIComponent(body); } catch (e) { return null; }
  }
  function toast(msg, ok) {
    var el = document.createElement('div');
    el.textContent = msg;
    el.className = 'fabmo-shell-toast';
    el.style.cssText =
      'position:fixed;top:12px;left:50%;transform:translateX(-50%);' +
      'background:' + (ok ? '#2a7a2a' : '#9a2a2a') + ';color:#fff;' +
      'padding:8px 16px;border-radius:6px;font-family:monospace;' +
      'font-size:13px;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3500);
  }
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    try {
      var dl = this.getAttribute('download');
      var href = this.getAttribute('href') || '';
      if (dl && CNC_RE.test(dl) && href.indexOf('data:') === 0 && inFabMo()) {
        var fm = ensureFabMo();
        if (fm) {
          var content = decodeHref(href);
          if (content !== null) {
            fm.submitJob(
              {
                file: content,
                filename: dl,
                name: dl.replace(/\.[^.]+$/, ''),
                description: 'Submitted from Mods app',
              },
              function () { toast('Submitted ' + dl + ' to FabMo', true); },
              function (err) {
                var m = (err && (err.message || err)) || 'unknown error';
                toast('Submit failed: ' + m, false);
              }
            );
            return; // suppress browser download
          }
        }
      }
    } catch (e) {
      console.warn('[mods-fabmo] intercept error:', e);
    }
    return origClick.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // Shell UI
  // ---------------------------------------------------------------------------
  var SHELL_CSS = [
    'body.fabmo-shell-active > *:not(.fabmo-shell):not(script):not(style):not(link) {',
    '  visibility: hidden !important;',
    '}',
    'body.fabmo-shell-active { overflow: hidden; }',
    '.fabmo-shell {',
    '  position: fixed; inset: 0; z-index: 100000;',
    '  display: flex; flex-direction: column;',
    '  background: #1c1c1c; color: #eee; font-family: system-ui, sans-serif;',
    '}',
    '.fabmo-shell.hidden { display: none; }',
    '.fabmo-shell-header {',
    '  display: flex; align-items: center; justify-content: space-between;',
    '  padding: 12px 18px; background: #262626; border-bottom: 1px solid #333;',
    '}',
    '.fabmo-shell-header h1 { margin: 0; font-size: 18px; font-weight: 600; }',
    '.fabmo-shell-header .sub { color: #aaa; font-size: 12px; margin-top: 2px; }',
    '.fabmo-shell-toggle {',
    '  background: none; border: 1px solid #555; color: #aaa;',
    '  padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;',
    '}',
    '.fabmo-shell-toggle:hover { color: #fff; border-color: #4af; }',
    '.fabmo-shell-body {',
    '  flex: 1; display: grid; grid-template-columns: 320px 1fr;',
    '  gap: 14px; padding: 14px; overflow: hidden;',
    '}',
    '.fabmo-shell-panel {',
    '  background: #262626; border: 1px solid #333; border-radius: 8px;',
    '  display: flex; flex-direction: column; overflow: hidden;',
    '}',
    '.fabmo-shell-panel-title {',
    '  padding: 10px 14px; font-size: 11px; text-transform: uppercase;',
    '  letter-spacing: 0.5px; color: #aaa; border-bottom: 1px solid #333;',
    '}',
    '.fabmo-shell-panel-body { flex: 1; overflow-y: auto; padding: 12px 14px; }',
    '.fabmo-shell-section { margin-bottom: 14px; }',
    '.fabmo-shell-section h3 {',
    '  margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #ccc;',
    '  text-transform: capitalize;',
    '}',
    '.fabmo-shell-row {',
    '  display: flex; align-items: center; gap: 8px;',
    '  padding: 4px 0; font-size: 13px;',
    '}',
    '.fabmo-shell-row label { flex: 1; color: #ddd; }',
    '.fabmo-shell-row input[type="text"], .fabmo-shell-row input[type="number"], .fabmo-shell-row select {',
    '  background: #1a1a1a; border: 1px solid #444; color: #eee;',
    '  padding: 4px 8px; border-radius: 4px; font: inherit; font-size: 13px;',
    '  width: 100px; text-align: right;',
    '}',
    '.fabmo-shell-row select { width: auto; text-align: left; }',
    '.fabmo-shell-browse {',
    '  background: #3a3a3a; border: 1px solid #555; color: #eee;',
    '  padding: 4px 12px; border-radius: 4px; font: inherit; font-size: 12px;',
    '  cursor: pointer;',
    '}',
    '.fabmo-shell-browse:hover { border-color: #4af; color: #fff; }',
    '.fabmo-shell-fname {',
    '  color: #999; font-size: 11px; font-family: monospace;',
    '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
    '  max-width: 140px;',
    '}',
    '.fabmo-shell-row .radio-group { display: flex; gap: 8px; }',
    '.fabmo-shell-row .radio-group label { flex: 0 0 auto; cursor: pointer; }',
    '.fabmo-shell-preview {',
    '  flex: 1; display: flex; align-items: center; justify-content: center;',
    '  background: #111; padding: 14px; min-height: 0;',
    '}',
    '.fabmo-shell-preview canvas {',
    '  max-width: 100%; max-height: 100%;',
    '  background: #fff; border: 1px solid #333;',
    '  image-rendering: pixelated;',
    '}',
    '.fabmo-shell-preview .empty { color: #666; font-size: 13px; }',
    '.fabmo-shell-footer {',
    '  padding: 12px 18px; border-top: 1px solid #333;',
    '  display: flex; gap: 10px; align-items: center;',
    '}',
    '.fabmo-shell-submit {',
    '  flex: 1; padding: 12px; background: #2a7a2a; color: #fff;',
    '  border: none; border-radius: 6px; font-size: 15px; font-weight: 600;',
    '  cursor: pointer;',
    '}',
    '.fabmo-shell-submit:disabled { opacity: 0.5; cursor: not-allowed; }',
    '.fabmo-shell-status { font-size: 12px; color: #888; margin-left: 4px; }',
  ].join('\n');

  function buildShell(progName) {
    var style = document.createElement('style');
    style.textContent = SHELL_CSS;
    document.head.appendChild(style);

    var shell = document.createElement('div');
    shell.className = 'fabmo-shell';
    shell.innerHTML = [
      '<div class="fabmo-shell-header">',
      '  <div>',
      '    <h1>' + escapeHtml(progName || 'Mods Workflow') + '</h1>',
      '    <div class="sub">' + (inFabMo() ? 'FabMo mode — outputs go to job queue' : 'Preview mode') + '</div>',
      '  </div>',
      '  <button class="fabmo-shell-toggle" type="button">Look under the hood ▾</button>',
      '</div>',
      '<div class="fabmo-shell-body">',
      '  <div class="fabmo-shell-panel">',
      '    <div class="fabmo-shell-panel-title">Inputs</div>',
      '    <div class="fabmo-shell-panel-body" data-role="inputs"><em style="color:#777;font-size:12px">Discovering…</em></div>',
      '  </div>',
      '  <div class="fabmo-shell-panel">',
      '    <div class="fabmo-shell-panel-title">Preview</div>',
      '    <div class="fabmo-shell-preview"><div class="empty">No preview canvas detected yet.</div></div>',
      '  </div>',
      '</div>',
      '<div class="fabmo-shell-footer">',
      '  <span class="fabmo-shell-status" data-role="status"></span>',
      '  <button class="fabmo-shell-submit" type="button" disabled>',
      (inFabMo() ? 'Submit to FabMo' : 'Save Output') +
      '  </button>',
      '</div>',
    ].join('\n');
    document.body.appendChild(shell);
    document.body.classList.add('fabmo-shell-active');

    var toggleBtn = shell.querySelector('.fabmo-shell-toggle');
    toggleBtn.addEventListener('click', function () {
      var active = document.body.classList.toggle('fabmo-shell-active');
      shell.classList.toggle('hidden', !active);
      toggleBtn.textContent = active ? 'Look under the hood ▾' : 'Back to simple view ▴';
      if (!active) ensureBackBtn(toggleBtn);
    });

    return shell;
  }

  function ensureBackBtn(toggleBtn) {
    if (document.querySelector('.fabmo-shell-back')) return;
    var back = document.createElement('button');
    back.textContent = 'Back to simple view ▴';
    back.className = 'fabmo-shell-back';
    back.style.cssText =
      'position:fixed;top:8px;right:8px;z-index:100001;' +
      'background:#2a7a2a;color:#fff;border:none;border-radius:4px;' +
      'padding:6px 12px;font-size:12px;font-family:system-ui,sans-serif;cursor:pointer;';
    back.onclick = function () {
      back.remove();
      toggleBtn.click();
    };
    document.body.appendChild(back);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------------------------------------------------------------------------
  // Module discovery & input mirroring
  // ---------------------------------------------------------------------------
  function getModuleInterfaceDiv(modContainer) {
    // Per Mods runtime: name div, controls div, then interface div
    // Interface div has id=JSON.stringify({id, type:'interface'})
    return modContainer.querySelector('[id*="\\"type\\":\\"interface\\""]')
      || modContainer.children[2];
  }

  function getModuleName(modContainer) {
    return modContainer.dataset.name || '(unnamed)';
  }

  // Skip these modules in the inputs panel — they're internal/processing.
  // Note: user-facing param modules (ShopBot, image threshold, etc.) typically
  // expose <input>s, while internal ones don't, so an empty section auto-skips.
  // This list is explicit safety against false positives.
  var HIDDEN_MODULE_NAMES = new Set([
    'save file', // controlled by our Submit button
  ]);

  function mirrorInputs(shell) {
    var panel = shell.querySelector('[data-role="inputs"]');
    panel.innerHTML = '';

    var modContainers = document.querySelectorAll('#modules > div[data-name]');
    if (!modContainers.length) {
      panel.innerHTML = '<em style="color:#777;font-size:12px">No modules found.</em>';
      return { saveFileBtn: null, fileInputs: [] };
    }

    var saveFileBtn = null;
    var anySection = false;

    modContainers.forEach(function (cont) {
      var name = getModuleName(cont);
      var iface = getModuleInterfaceDiv(cont);
      if (!iface) return;

      // Capture save-file button regardless of whether we render a section.
      if (name === 'save file') {
        var btn = iface.querySelector('button');
        if (btn) saveFileBtn = btn;
      }
      if (HIDDEN_MODULE_NAMES.has(name)) return;

      var origInputs = iface.querySelectorAll('input, select, textarea');
      if (!origInputs.length) return;

      var section = document.createElement('div');
      section.className = 'fabmo-shell-section';
      var h = document.createElement('h3');
      h.textContent = name;
      section.appendChild(h);

      // Group radios by name
      var radioGroups = {};
      var rendered = 0;
      origInputs.forEach(function (orig) {
        // Skip inputs that are visually hidden by Mods (likely internal)
        if (orig.type === 'hidden') return;

        if (orig.type === 'radio') {
          var key = orig.name || ('radio-' + Math.random());
          if (!radioGroups[key]) {
            radioGroups[key] = [];
            radioGroups[key]._first = orig;
          }
          radioGroups[key].push(orig);
          return;
        }

        var row = renderInputRow(orig, name);
        if (row) {
          section.appendChild(row);
          rendered++;
        }
      });

      Object.keys(radioGroups).forEach(function (key) {
        var row = renderRadioGroup(radioGroups[key]);
        if (row) { section.appendChild(row); rendered++; }
      });

      if (rendered) {
        panel.appendChild(section);
        anySection = true;
      }
    });

    if (!anySection) {
      panel.innerHTML = '<em style="color:#777;font-size:12px">No user inputs detected. Use “Look under the hood” to access the full Mods graph.</em>';
    }

    return { saveFileBtn: saveFileBtn };
  }

  function deriveLabel(orig) {
    // Mods modules generally use a TextNode immediately preceding the input.
    var prev = orig.previousSibling;
    while (prev && prev.nodeType !== 3 /* text */) {
      prev = prev.previousSibling;
    }
    var label = prev ? prev.nodeValue.trim().replace(/[:：]\s*$/, '') : '';
    if (!label) label = orig.name || orig.id || orig.placeholder || orig.type;
    return label;
  }

  function renderInputRow(orig, modName) {
    var row = document.createElement('div');
    row.className = 'fabmo-shell-row';

    // File inputs: render as a Browse button that delegates to the original.
    // Avoids DataTransfer cloning and the "drop zone canvas" UX that doesn't
    // survive the shell hiding the Mods graph.
    if (orig.type === 'file') {
      var label = document.createElement('label');
      label.textContent = modName + ' file';
      row.appendChild(label);
      var browse = document.createElement('button');
      browse.type = 'button';
      browse.className = 'fabmo-shell-browse';
      browse.textContent = 'Browse…';
      browse.addEventListener('click', function () { orig.click(); });
      var fname = document.createElement('span');
      fname.className = 'fabmo-shell-fname';
      fname.textContent = '(no file selected)';
      orig.addEventListener('change', function () {
        var f = orig.files && orig.files[0];
        fname.textContent = f ? f.name : '(no file selected)';
      });
      row.appendChild(browse);
      row.appendChild(fname);
      return row;
    }

    var label = document.createElement('label');
    label.textContent = deriveLabel(orig);
    row.appendChild(label);

    var mirror;
    if (orig.tagName === 'SELECT') {
      mirror = orig.cloneNode(true);
    } else if (orig.type === 'checkbox') {
      mirror = document.createElement('input');
      mirror.type = 'checkbox';
      mirror.checked = orig.checked;
    } else {
      // text / number / others
      mirror = document.createElement('input');
      mirror.type = orig.type === 'number' ? 'number' : 'text';
      mirror.value = orig.value || '';
      if (orig.size) mirror.size = orig.size;
    }
    row.appendChild(mirror);

    if (orig.type === 'checkbox') {
      mirror.addEventListener('change', function () {
        orig.checked = mirror.checked;
        orig.dispatchEvent(new Event('change', { bubbles: true }));
      });
      orig.addEventListener('change', function () { mirror.checked = orig.checked; });
    } else if (orig.tagName === 'SELECT') {
      mirror.addEventListener('change', function () {
        orig.value = mirror.value;
        orig.dispatchEvent(new Event('change', { bubbles: true }));
      });
      orig.addEventListener('change', function () { mirror.value = orig.value; });
    } else {
      mirror.addEventListener('input', function () {
        orig.value = mirror.value;
        orig.dispatchEvent(new Event('input', { bubbles: true }));
        orig.dispatchEvent(new Event('change', { bubbles: true }));
      });
      orig.addEventListener('change', function () { mirror.value = orig.value; });
    }
    return row;
  }

  function renderRadioGroup(group) {
    var row = document.createElement('div');
    row.className = 'fabmo-shell-row';
    var label = document.createElement('label');
    label.textContent = deriveLabel(group._first);
    row.appendChild(label);
    var rg = document.createElement('div');
    rg.className = 'radio-group';
    group.forEach(function (orig) {
      var lbl = document.createElement('label');
      var mirror = document.createElement('input');
      mirror.type = 'radio';
      mirror.name = 'fabmo-mirror-' + (orig.name || '');
      mirror.checked = orig.checked;
      mirror.addEventListener('change', function () {
        if (mirror.checked) {
          orig.checked = true;
          orig.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      orig.addEventListener('change', function () { mirror.checked = orig.checked; });
      lbl.appendChild(mirror);
      // text immediately after orig in DOM
      var textNode = orig.nextSibling;
      var labelTxt = '';
      while (textNode && textNode.nodeType !== 3) textNode = textNode.nextSibling;
      labelTxt = textNode ? textNode.nodeValue.trim() : (orig.value || '');
      lbl.appendChild(document.createTextNode(' ' + labelTxt));
      rg.appendChild(lbl);
    });
    row.appendChild(rg);
    return row;
  }

  // ---------------------------------------------------------------------------
  // Preview canvas mirroring
  // ---------------------------------------------------------------------------
  function findPreviewCanvas() {
    // Pick the largest canvas inside #modules — typically the final stage
    // (mill raster 2D / simulate toolpath) renders the largest visualization.
    var canvases = document.querySelectorAll('#modules canvas');
    var best = null, bestArea = 0;
    canvases.forEach(function (c) {
      var area = (c.width || 0) * (c.height || 0);
      if (area > bestArea) { bestArea = area; best = c; }
    });
    return best;
  }

  function startPreviewLoop(shell) {
    var slot = shell.querySelector('.fabmo-shell-preview');
    var mirror = document.createElement('canvas');
    var lastSrc = null;
    var ctx = null;

    function tick() {
      var src = findPreviewCanvas();
      if (src && src !== lastSrc) {
        slot.innerHTML = '';
        slot.appendChild(mirror);
        lastSrc = src;
      }
      if (src) {
        if (mirror.width !== src.width || mirror.height !== src.height) {
          mirror.width = src.width;
          mirror.height = src.height;
        }
        if (!ctx) ctx = mirror.getContext('2d');
        try { ctx.drawImage(src, 0, 0); } catch (e) { /* tainted, ignore */ }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------------------
  // Submit wiring
  // ---------------------------------------------------------------------------
  function wireSubmit(shell, getSaveFileBtn) {
    var btn = shell.querySelector('.fabmo-shell-submit');
    var status = shell.querySelector('[data-role="status"]');
    function isReady(sb) {
      // The save_file module flips its button text from "waiting for file"
      // to "save file" when the file event arrives.
      if (!sb) return false;
      var t = (sb.textContent || '').toLowerCase();
      return !t.includes('waiting');
    }
    function update() {
      var sb = getSaveFileBtn();
      var ready = isReady(sb);
      btn.disabled = !ready;
      status.textContent = ready ? '' : 'Waiting for toolpath…';
    }
    update();
    setInterval(update, 400); // cheap, robust to Mods' async pipeline
    btn.addEventListener('click', function () {
      var sb = getSaveFileBtn();
      if (sb && isReady(sb)) sb.click();
    });
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------
  function getProgName() {
    // Mods places the program name as document.title and on a span; either works.
    return (document.title || 'Mods Workflow').replace(/\s*-\s*ShopBot\s*$/i, '');
  }

  function start() {
    var shell = buildShell(getProgName());
    var refs = { saveFileBtn: null };

    function rediscover() {
      var r = mirrorInputs(shell);
      refs.saveFileBtn = r.saveFileBtn;
    }
    rediscover();

    // Re-discover only when module containers are added or removed —
    // NOT on every text/attribute change inside a module (which would
    // thrash the panel and steal focus from mirrored inputs).
    var debounceTimer = null;
    function scheduleRediscover() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(rediscover, 80);
    }
    var obs = new MutationObserver(scheduleRediscover);
    var modules = document.getElementById('modules');
    if (modules) {
      obs.observe(modules, { childList: true });
    } else {
      var bodyObs = new MutationObserver(function () {
        var m = document.getElementById('modules');
        if (m) {
          obs.observe(m, { childList: true });
          bodyObs.disconnect();
          scheduleRediscover();
        }
      });
      bodyObs.observe(document.body, { childList: true });
    }

    startPreviewLoop(shell);
    wireSubmit(shell, function () { return refs.saveFileBtn; });
  }

  function bootstrap() {
    // Mods initializes inside `window.load`, so we wait for that to give it
    // a chance to populate #modules. We can still build the shell first; it
    // will pick up modules as they arrive via the MutationObserver.
    if (document.readyState === 'complete') {
      start();
    } else {
      window.addEventListener('load', function () {
        // small delay so Mods finishes its synchronous module instantiation
        setTimeout(start, 50);
      });
    }
  }

  bootstrap();
})();
