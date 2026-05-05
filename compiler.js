/**
 * Mods → FabMo Compiler (client-side)
 *
 * Reads a Mods HTML export, injects FabMo deps + bridge before </body>,
 * and packages everything as a .fma (ZIP) using JSZip.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const dropZone = $('dropZone');
  const fileInput = $('fileInput');
  const fileInfo = $('fileInfo');
  const fileName = $('fileName');
  const clearBtn = $('clearFile');
  const appName = $('appName');
  const appDesc = $('appDesc');
  const appColor = $('appColor');
  const appId = $('appId');
  const buildBtn = $('buildBtn');
  const logEl = $('log');
  const randomBtn = $('randomColor');
  const iconPreview = $('iconPreview');

  // Palette pulled from labs' FOLDER_COLORS / appInfo curated colors so
  // generated disks fit visually with the rest of the labs collection.
  const PALETTE = [
    '#e85d3a', '#4a8fd4', '#6bb548', '#c47edb', '#d4a03c',
    '#88bbff', '#4a9e4a', '#e04080', '#2d6b35', '#3070b0',
    '#d47030', '#7b5ea7', '#c9873a', '#3aa8a8', '#a85ca0',
    '#5a8fce', '#e060a0', '#40b0b0', '#9a60d0', '#e88040',
  ];
  const pickRandomColor = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];

  let modsHtml = null;
  let modsFilename = null;

  // -- Logging --------------------------------------------------------------
  function log(msg, cls) {
    logEl.hidden = false;
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function clearLog() { logEl.innerHTML = ''; logEl.hidden = true; }

  // -- File handling --------------------------------------------------------
  function slugify(s) {
    return (s || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'mods-app';
  }

  function handleFile(file) {
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) {
      log('File must be .html or .htm', 'err');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      modsHtml = e.target.result;
      modsFilename = file.name;
      fileName.textContent = `${file.name}  (${(file.size / 1024).toFixed(0)} KB)`;
      fileInfo.hidden = false;
      dropZone.style.display = 'none';
      // Auto-fill name from filename if blank
      if (!appName.value.trim()) {
        appName.value = file.name.replace(/\.html?$/i, '').trim();
      }
      updateAppId();
      updateBuildBtn();
    };
    reader.onerror = () => log('Failed to read file', 'err');
    reader.readAsText(file);
  }

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

  ['dragenter', 'dragover'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });
  dropZone.addEventListener('drop', (e) => {
    handleFile(e.dataTransfer.files[0]);
  });

  clearBtn.addEventListener('click', () => {
    modsHtml = null;
    modsFilename = null;
    fileInfo.hidden = true;
    dropZone.style.display = '';
    fileInput.value = '';
    updateBuildBtn();
  });

  function updateAppId() {
    appId.value = slugify(appName.value);
  }
  appName.addEventListener('input', () => { updateAppId(); updateBuildBtn(); refreshPreview(); });

  function updateBuildBtn() {
    buildBtn.disabled = !(modsHtml && appName.value.trim());
  }

  function refreshPreview() {
    if (!iconPreview) return;
    iconPreview.innerHTML = buildIconSvg(appName.value || '?', appColor.value);
  }

  // Initialize random color + preview on load
  appColor.value = pickRandomColor();
  refreshPreview();
  appColor.addEventListener('input', refreshPreview);
  if (randomBtn) {
    randomBtn.addEventListener('click', () => {
      appColor.value = pickRandomColor();
      refreshPreview();
    });
  }

  // -- HTML injection -------------------------------------------------------
  function injectDeps(html) {
    const tags =
      '<!-- FabMo bridge (added by mods_compiler) -->\n' +
      '<script src="./lib/jquery.min.js"></script>\n' +
      '<script src="./lib/fabmo.js"></script>\n' +
      '<script src="./lib/mods-fabmo-bridge.js"></script>\n';

    // Mods exports contain a literal "</body>" inside the export-self JS
    // string, so replacing the first match would inject into dead code.
    // Find the LAST </body> (case-insensitive) — that's the real closer.
    const lower = html.toLowerCase();
    const idx = lower.lastIndexOf('</body>');
    if (idx >= 0) {
      return html.slice(0, idx) + tags + html.slice(idx);
    }
    return html + '\n' + tags;
  }

  // -- Manifest + icon ------------------------------------------------------
  function buildPackageJson(id, name, desc, color) {
    return JSON.stringify({
      name: name,
      description: desc || `Mods workflow packaged for FabMo: ${name}`,
      version: '1.0.0',
      id: 'mods-' + id,
      main: './index.html',
      icon: 'icon.png',
      icon_color: color,
      author: 'ShopBot Tools (compiled from Mods)',
      website: 'https://labs.shopbottools.com',
      license: 'MIT',
    }, null, 2) + '\n';
  }

  // Floppy-disk icon (matches labs landing-page disk style). 72x76 → scaled
  // to 128x128 viewBox so FabMo's icon slot is filled with a small margin.
  function buildIconSvg(name, color) {
    const initial = (name || '?').trim().charAt(0).toUpperCase();
    return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="-4 -4 80 84">
  <path d="M 4,2 L 64,2 L 70,8 L 70,72 Q 70,74 68,74 L 4,74 Q 2,74 2,72 L 2,4 Q 2,2 4,2 Z"
        fill="${color}" stroke="#000" stroke-width="2" stroke-linejoin="round"/>
  <path d="M 18,2 L 54,2 L 54,20 L 18,20 Z" fill="#d0d0d0" stroke="#000" stroke-width="1.5"/>
  <rect x="39" y="4" width="12" height="14" fill="#999" stroke="#000" stroke-width="1"/>
  <rect x="10" y="34" width="52" height="34" rx="1" ry="1" fill="#fff" stroke="#000" stroke-width="1"/>
  <text x="36" y="56" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#222">${initial}</text>
  <path d="M 5,3 L 63.5,3 L 69,8.5 L 69,71.5 Q 69,73 67.5,73 L 4.5,73 Q 3,73 3,71.5 L 3,4.5 Q 3,3 5,3 Z"
        fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
</svg>`;
  }

  // -- Build pipeline -------------------------------------------------------
  async function fetchText(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Fetch ${url} → ${r.status}`);
    return r.text();
  }

  async function build() {
    if (buildBtn.disabled) return;
    buildBtn.disabled = true;
    clearLog();
    const id = slugify(appName.value);
    const name = appName.value.trim();
    const desc = appDesc.value.trim();
    const color = appColor.value;

    try {
      log(`Building ${id}.fma…`);

      log('Fetching FabMo deps…');
      const [jq, fabmoJs, bridge] = await Promise.all([
        fetchText('./lib/jquery.min.js'),
        fetchText('./lib/fabmo.js'),
        fetchText('./lib/mods-fabmo-bridge.js'),
      ]);

      log('Injecting bridge into Mods HTML…');
      const wrapped = injectDeps(modsHtml);

      log('Assembling ZIP…');
      const zip = new JSZip();
      zip.file('index.html', wrapped);
      zip.file('package.json', buildPackageJson(id, name, desc, color));
      zip.file('icon.png', buildIconSvg(name, color));
      const lib = zip.folder('lib');
      lib.file('jquery.min.js', jq);
      lib.file('fabmo.js', fabmoJs);
      lib.file('mods-fabmo-bridge.js', bridge);

      const blob = await zip.generateAsync({ type: 'blob' });
      log(`ZIP ready (${(blob.size / 1024).toFixed(0)} KB) — downloading…`, 'ok');

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${id}.fma`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);

      log(`Done: ${id}.fma`, 'ok');
    } catch (err) {
      log(`Build failed: ${err.message || err}`, 'err');
      console.error(err);
    } finally {
      buildBtn.disabled = false;
    }
  }

  buildBtn.addEventListener('click', build);
})();
