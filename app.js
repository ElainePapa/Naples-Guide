'use strict';
// ===== Naples Guest Guide =====
// Guests: public, read-only (no login). Owner (Elaine): taps 🔑, signs in by email,
// edits text/codes/videos and uploads photo grids — saved live for guests.
const SUPABASE_URL = 'https://dcvkcmxckustyujzqkgs.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjdmtjbXhja3VzdHl1anpxa2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NzExMDcsImV4cCI6MjA5NjM0NzEwN30.Y-ocqiO7JcJQO4H0uz19Ifl8TUQgLhpF2qvCnfkuYcI';
const GUIDE_ID = 'naples';
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON) : null;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nl2br = s => esc(s).replace(/\n/g, '<br>');

let isOwner = false, editMode = false;

const STARTER = {
  title: 'Our Naples Place', tagline: 'Everything you need for a great stay 🌴',
  welcome: "Welcome! We're so happy to have you. This guide has the Wi-Fi, door codes, how-tos, and where to find everything. Reach out anytime.",
  checkout: 'Checkout is at 10am — leave used towels in the tub and lock up. Thank you!',
  wifi: { ssid: '', password: '' },
  codes: [], videos: [],
  collections: [
    { id: 'pantry', icon: '🧂', title: 'Pantry & Kitchen', intro: "What's stocked — spices, oils, vinegars, condiments.", items: [] },
    { id: 'bath', icon: '🧴', title: 'Bath & Toiletries', intro: 'Shampoos, conditioners, and toiletries.', items: [] },
    { id: 'beach', icon: '🏖️', title: 'Beach & Pool', intro: 'How to get there and what we provide.', items: [] },
    { id: 'find', icon: '🧺', title: 'Where to Find Things', intro: 'Towels, umbrellas, beach gear, storage closet downstairs.', items: [] },
    { id: 'games', icon: '🎲', title: 'Games & Puzzles', intro: 'For a rainy afternoon.', items: [] },
  ],
  contact: { name: '', phone: '', note: '' },
};
let guide = JSON.parse(JSON.stringify(STARTER));

// ---------- load / save ----------
async function loadGuide() {
  if (!sb) return;
  try {
    const { data } = await sb.from('guide').select('data').eq('id', GUIDE_ID).maybeSingle();
    if (data && data.data) guide = Object.assign(JSON.parse(JSON.stringify(STARTER)), data.data);
  } catch { /* keep starter */ }
}
async function saveGuide() {
  if (!sb) return;
  const { error } = await sb.from('guide').upsert({ id: GUIDE_ID, data: guide, updated_at: new Date().toISOString() });
  if (error) alert('Couldn’t save — ' + error.message + '\n(Are you signed in as the owner? Has the guide SQL been run?)');
}

// ---------- QR (via free QR service) ----------
const qr = (text, size = 220) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(text)}`;
const wifiPayload = w => `WIFI:T:WPA;S:${(w.ssid || '').replace(/([\\;,:"])/g, '\\$1')};P:${(w.password || '').replace(/([\\;,:"])/g, '\\$1')};;`;

// ---------- built-in section photos (live in code, so owner edits can't wipe them;
// keyed by section title — the app falls back to these when the DB has none) ----------
const SECTION_EXTRAS = {
  'Pantry & Kitchen': { rename: 'Pantry', photos: ['photos/pantry-oils.jpg', 'photos/pantry-oils2.jpg', 'photos/pantry-shelf.jpg'], items: [{ name: 'Sesame oil', note: 'Sprouts virgin, organic unrefined' }, { name: 'Coconut aminos', note: 'Big Tree Farms, organic — soy-free' }] },
  'Spices & Seasonings': { photos: ['photos/spices-1.jpg', 'photos/spices-2.jpg'] },
  'Games & Puzzles': { photos: ['photos/games-cards.jpg', 'photos/games-board.jpg'], location: { text: 'In the whitewashed cabinet in the living room.', photo: 'photos/furniture-white.jpg' } },
  'Fitness & Wellness': { photos: ['photos/dumbbells.jpg', 'photos/massager.jpg'], location: { text: 'In the whitewashed cabinet in the living room.', photo: 'photos/furniture-white.jpg' } },
  'Beach & Pool': { photos: ['photos/towels.jpg', 'photos/towels-bags.jpg'], location: { text: 'In the blue console by the entry — beach towels and the 3 beach bags.', photo: 'photos/furniture-blue.jpg' }, items: [{ name: 'Pool entry', note: 'Use the key fob to get in and out of the pool gate' }, { name: 'Pool Wi-Fi', note: 'Network: Fision Wi-Fi by Hotwire · Password: bakercarrollwifi' }, { name: 'Beach towels' }, { name: 'Beach bags (3)' }] },
  'Where to Find Things': { intro: '🖨️ To print (AirPrint from an iPhone, iPad or Mac):\n1. Connect your device to the house Wi-Fi.\n2. Open the photo or document → tap Share → Print.\n3. Tap “Printer” and choose “HP DeskJet 4200 series”.\n4. Tap Print. Paper & spare ink are in the same cabinet.', photos: ['photos/printer.jpg', 'photos/placemats.jpg'], location: { text: 'Tall whitewashed cabinet with the octopus & starfish on top, by the aqua artwork.', photo: 'photos/office-cabinet.jpg' }, items: [{ name: 'Printer', note: 'HP DeskJet 4258e — paper & spare ink cartridges are in the same cabinet' }, { name: 'Placemats & table linens', note: 'Homewear placemats + cloth napkins, lower shelf' }] },
};

// code-only sections (rendered after their `after` DB section; not owner-editable)
const VIRTUAL_SECTIONS = [
  { id: 'pickleball', after: 'Beach & Pool', icon: '🏓', title: 'Pickleball', intro: 'Baker Carroll Point Pickle Ball courts.', items: [
    { name: 'Gate', note: 'VSC1 — entry code: 1157' },
  ] },
  { id: 'kitchen-tools', after: 'Pantry & Kitchen', icon: '🍳', title: 'Kitchen Tools', items: [
    { name: 'Electric kettle', note: 'For hot water — upper kitchen cabinet', photo: 'photos/kettle-crockpot.jpg' },
    { name: 'Crock pot / slow cooker', note: 'Upper cabinet — use a lid from the cookware set', photo: 'photos/kitchen-appliances.jpg' },
    { name: 'Hand mixer', note: 'Cuisinart 9-speed', photo: 'photos/hand-mixer.jpg' },
    { name: 'Food chopper & grinder', note: 'Cuisinart — chop & grind', photo: 'photos/chopper.jpg' },
    { name: 'Blender', note: 'Oster glass-jar blender', photo: 'photos/blender.jpg' },
    { name: 'Toaster', note: 'Zwilling 2-slice', photo: 'photos/toaster.jpg' },
    { name: 'Coffee percolator', note: 'Presto stainless', photo: 'photos/percolator.jpg' },
    { name: 'Cookware & lids', note: 'Pots, pans and glass lids in the lower cabinets' },
  ] },
];
// code-defined videos (always shown, survive owner edits)
const BUILTIN_VIDEOS = [
  { title: 'How to find the hidden pantry', url: 'videos/hidden-pantry.mp4', note: 'A quick walkthrough' },
];

// ---------- render ----------
function ownerBtn(fn, label) { return isOwner ? `<button class="edit-btn" data-edit="${fn}">✏️ ${label || 'Edit'}</button>` : ''; }
function sectionBody(photos, items, rawLoc, intro) {
  const loc = rawLoc && (rawLoc.text || rawLoc.photo) ? rawLoc : null;
  const titleAttr = loc && loc.text ? ` title="📍 ${esc(loc.text)}"` : '';
  const photoStrip = photos.length ? `<div class="sec-photos">${photos.map(p => `<img src="${esc(p)}" loading="lazy" data-zoom="${esc(p)}">`).join('')}</div>` : '';
  const locHtml = loc ? `<div class="loc-callout"${loc.photo ? ` data-zoom="${esc(loc.photo)}"` : ''}>
      ${loc.photo ? `<img src="${esc(loc.photo)}" loading="lazy" alt="where to find these">` : '<span class="loc-pin">📍</span>'}
      <div class="loc-txt"><b>Where to find these</b><span>${esc(loc.text || '')}</span></div></div>` : '';
  const withPics = items.filter(it => it.photo), noPics = items.filter(it => !it.photo);
  const grid = withPics.length ? `<div class="photo-grid">${withPics.map(it => `<figure class="pg-item"${titleAttr}><img src="${esc(it.photo)}" alt="${esc(it.name)}" loading="lazy" data-zoom="${esc(it.photo)}"><figcaption>${esc(it.name)}${it.note ? `<small>${esc(it.note)}</small>` : ''}</figcaption></figure>`).join('')}</div>` : '';
  const list = noPics.length ? `<ul class="item-list"${titleAttr}>${noPics.map(it => `<li><b>${esc(it.name)}</b>${it.note ? `<span>${esc(it.note)}</span>` : ''}</li>`).join('')}</ul>` : '';
  return `${intro ? `<p class="intro">${nl2br(intro)}</p>` : ''}${locHtml}${photoStrip}${grid + list || '<p class="muted">Nothing added yet.</p>'}`;
}
function render() {
  $('#hero-title').textContent = guide.title || 'Welcome';
  $('#hero-tag').textContent = guide.tagline || '';
  const secs = [];

  secs.push(card('welcome', '👋', 'Welcome', `
    <p>${nl2br(guide.welcome)}</p>
    ${guide.checkout ? `<div class="callout">🕙 ${nl2br(guide.checkout)}</div>` : ''}
    ${ownerBtn('welcome')}`));

  secs.push(card('wifi', '📶', 'Wi-Fi', guide.wifi && guide.wifi.ssid ? `
    <div class="kv"><span>Network</span><b>${esc(guide.wifi.ssid)}</b></div>
    <div class="kv"><span>Password</span><b class="mono">${esc(guide.wifi.password)}</b>
      <button class="mini-btn" data-copy="${esc(guide.wifi.password)}">Copy</button></div>
    <div class="qr-wrap"><img class="qr" src="${qr(wifiPayload(guide.wifi))}" alt="Wi-Fi QR" loading="lazy">
      <div class="qr-cap">📷 Scan to join automatically</div></div>
    ${ownerBtn('wifi')}` : `<p class="muted">Wi-Fi not set yet.</p>${ownerBtn('wifi', 'Add Wi-Fi')}`));

  const codeRows = arr => (arr || []).map(c => `<div class="code-row"><div><b>${esc(c.label)}</b>${c.note ? `<small>${esc(c.note)}</small>` : ''}</div><span class="code-val mono">${esc(c.value)}</span></div>`).join('') || '<p class="muted">No codes added yet.</p>';
  let codesBody;
  if (!codesLocked()) {
    codesBody = codeRows(guide.codes) + ownerBtn('codes');
  } else if (unlockedCodes) {
    codesBody = `<p class="codes-note">🔓 Unlocked on this device.</p>${codeRows(unlockedCodes)}${ownerBtn('codes')}`;
  } else {
    codesBody = `<div class="codes-lock"><p class="muted">🔒 Access codes are protected. Enter the password your host gave you.</p>
      <div class="codes-lock-row"><input id="codes-pass" type="password" placeholder="Password" autocomplete="off">
      <button class="mini-btn" id="codes-unlock">Unlock</button></div>
      <p class="codes-status" id="codes-status"></p></div>`;
  }
  secs.push(card('codes', '🔑', 'Access & Codes', codesBody));

  const allVideos = [...(guide.videos || []), ...BUILTIN_VIDEOS];
  secs.push(card('videos', '🎥', 'How-To Videos', `
    ${allVideos.map(v => videoHtml(v)).join('') || '<p class="muted">No videos yet.</p>'}
    ${ownerBtn('videos')}`));

  (guide.collections || []).forEach(col => {
    const extra = SECTION_EXTRAS[col.title] || {};
    const photos = (col.photos && col.photos.length) ? col.photos : (extra.photos || []);
    const extraItems = (extra.items || []).filter(ei => !(col.items || []).some(ci => (ci.name || '').toLowerCase() === (ei.name || '').toLowerCase()));
    const items = [...(col.items || []), ...extraItems];
    const rawLoc = (col.location && (col.location.text || col.location.photo)) ? col.location : extra.location;
    const title = extra.rename || col.title;
    secs.push(card('c-' + col.id, col.icon || '📦', title,
      sectionBody(photos, items, rawLoc, col.intro || extra.intro) +
      (isOwner ? `<button class="edit-btn" data-edit="col:${col.id}">✏️ Edit ${esc(title)}</button>` : '')));
    VIRTUAL_SECTIONS.filter(v => v.after === col.title).forEach(v =>
      secs.push(card(v.id, v.icon, v.title, sectionBody(v.photos || [], v.items || [], v.location, v.intro))));
  });

  if (isOwner) secs.push(`<div class="add-col-wrap"><button class="add-col" data-edit="addcol">＋ Add a section</button></div>`);
  $('#guide').innerHTML = secs.join('');

  // jump nav (includes virtual sections in order)
  const jump = [['welcome', '👋'], ['wifi', '📶'], ['codes', '🔑'], ['videos', '🎥']];
  (guide.collections || []).forEach(c => { jump.push(['c-' + c.id, c.icon || '📦']); VIRTUAL_SECTIONS.filter(v => v.after === c.title).forEach(v => jump.push([v.id, v.icon])); });
  $('#jump').innerHTML = jump.map(([id, ic]) => `<a href="#${id}">${ic}</a>`).join('');

  // footer contact
  const c = guide.contact || {};
  $('#foot-contact').innerHTML = (c.name || c.phone || c.note) ? `
    <div class="foot-contact">☎️ <b>${esc(c.name || 'Host')}</b>${c.phone ? ` · <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : ''}${c.note ? `<div class="muted">${nl2br(c.note)}</div>` : ''} ${ownerBtn('contact')}</div>`
    : (isOwner ? `<button class="edit-btn" data-edit="contact">✏️ Add contact</button>` : '');

  $('#owner-btn').textContent = isOwner ? (editMode ? '✅' : '🔓') : '🔑';
}
function card(id, icon, title, body) {
  return `<section class="card" id="${id}"><div class="card-head"><span class="card-ic">${icon}</span><h2>${esc(title)}</h2></div>${body}</section>`;
}
function videoHtml(v) {
  const yt = ytId(v.url);
  const media = yt ? `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${yt}" allowfullscreen loading="lazy"></iframe></div>`
    : (v.url ? `<video class="video-file" controls playsinline preload="metadata" src="${esc(v.url)}"></video>` : '');
  return `<div class="video-row"><div class="video-t">🎬 ${esc(v.title)}</div>${v.note ? `<div class="muted">${esc(v.note)}</div>` : ''}${media || (v.url ? `<a class="mini-btn" href="${esc(v.url)}" target="_blank" rel="noopener">Watch ↗</a>` : '')}</div>`;
}
function ytId(u) { const m = String(u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : ''; }

// ---------- images ----------
function compressImage(file, max = 1200, q = 0.75) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h && w > max) { h = Math.round(h * max / w); w = max; } else if (h > max) { w = Math.round(w * max / h); h = max; }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob(b => b ? res(b) : rej(new Error('compress failed')), 'image/jpeg', q);
    };
    img.onerror = rej; img.src = url;
  });
}
async function uploadPhoto(file) {
  const blob = await compressImage(file);
  const path = `naples/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from('guide').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return `${SUPABASE_URL}/storage/v1/object/public/guide/${path}`;
}
async function uploadVideo(file) {
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const path = `naples/vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from('guide').upload(path, file, { contentType: file.type || 'video/mp4', upsert: false });
  if (error) throw error;
  return `${SUPABASE_URL}/storage/v1/object/public/guide/${path}`;
}

// ---------- modal ----------
function openModal(html) { $('#modal-card').innerHTML = html; $('#modal').style.display = 'flex'; document.body.style.overflow = 'hidden'; const c = $('#m-close'); if (c) c.onclick = closeModal; }
function closeModal() { $('#modal').style.display = 'none'; document.body.style.overflow = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'codes-pass') unlockCodesFromInput(); });
const field = (label, id, val, ph, ta) => `<label class="fld">${label}${ta ? `<textarea id="${id}" rows="3" placeholder="${esc(ph || '')}">${esc(val || '')}</textarea>` : `<input id="${id}" value="${esc(val || '')}" placeholder="${esc(ph || '')}">`}</label>`;

// ---------- editors ----------
async function editWelcome() {
  openModal(`<button class="m-close" id="m-close">✕</button><h3>Welcome section</h3>
    ${field('Place name', 'e-title', guide.title, 'Our Naples Place')}
    ${field('Tagline', 'e-tag', guide.tagline)}
    ${field('Welcome message', 'e-welcome', guide.welcome, '', true)}
    ${field('Checkout note', 'e-checkout', guide.checkout, '', true)}
    ${field('Access-code password', 'e-pass', '', codesLocked() ? '•••••• set — type to change' : 'optional — locks your door/pool codes')}
    <p class="hint">Set a password and your <b>access codes are encrypted</b> — guests must enter it to reveal them. Everything else stays open. ${codesLocked() ? '<button class="link-btn" id="e-passclear">Remove password</button>' : ''}</p>
    <button class="save" id="e-save">Save</button>`);
  $('#e-save').onclick = async () => {
    guide.title = $('#e-title').value.trim(); guide.tagline = $('#e-tag').value.trim();
    guide.welcome = $('#e-welcome').value.trim(); guide.checkout = $('#e-checkout').value.trim();
    const pw = $('#e-pass').value.trim();
    if (pw) {
      const cur = unlockedCodes || guide.codes || [];
      guide.passHash = await sha(pw);
      guide.codesEnc = await encCodes(cur, pw);
      delete guide.codes;
      guestPass = pw; unlockedCodes = cur; localStorage.setItem('naples_gp', pw);
    }
    await saveGuide(); closeModal(); render();
  };
  const pc = document.getElementById('e-passclear');
  if (pc) pc.onclick = async () => {
    const cur = unlockedCodes || (!guide.codesEnc ? (guide.codes || []) : null);
    if (cur === null) { alert('Unlock the codes first: enter the password in the Access & Codes section, then remove it here.'); return; }
    guide.codes = cur; delete guide.passHash; delete guide.codesEnc;
    guestPass = ''; unlockedCodes = null; localStorage.removeItem('naples_gp');
    await saveGuide(); closeModal(); render();
  };
}
async function editWifi() {
  openModal(`<button class="m-close" id="m-close">✕</button><h3>Wi-Fi</h3>
    ${field('Network name (SSID)', 'w-ssid', guide.wifi.ssid, 'exact, case-sensitive')}
    ${field('Password', 'w-pass', guide.wifi.password)}
    <p class="hint">A scannable auto-connect QR is generated for guests.</p>
    <button class="save" id="w-save">Save</button>`);
  $('#w-save').onclick = async () => { guide.wifi = { ssid: $('#w-ssid').value.trim(), password: $('#w-pass').value }; await saveGuide(); closeModal(); render(); };
}
function listEditor(title, arr, fields, onDone) {
  const rows = () => arr.map((it, i) => `<div class="le-row" data-i="${i}">${fields.map(f => `<div><b>${esc(f.label)}:</b> ${esc(it[f.key] || '—')}</div>`).join('')}<button class="le-del" data-i="${i}">🗑</button></div>`).join('') || '<p class="muted">None yet.</p>';
  const form = () => fields.map(f => field(f.label, 'le-' + f.key, '', f.ph, f.ta)).join('');
  openModal(`<button class="m-close" id="m-close">✕</button><h3>${esc(title)}</h3>
    <div id="le-list">${rows()}</div>
    <div class="le-form"><div class="le-form-h">Add new</div>${form()}<button class="add" id="le-add">＋ Add</button></div>
    <button class="save" id="le-done">Done</button>`);
  const redraw = () => { $('#le-list').innerHTML = rows(); bind(); };
  const bind = () => $('#le-list').querySelectorAll('.le-del').forEach(b => b.onclick = () => { arr.splice(+b.dataset.i, 1); redraw(); });
  bind();
  $('#le-add').onclick = () => { const it = {}; fields.forEach(f => it[f.key] = $('#le-' + f.key).value.trim()); if (fields.every(f => !it[f.key])) return; arr.push(it); fields.forEach(f => $('#le-' + f.key).value = ''); redraw(); };
  $('#le-done').onclick = async () => { await onDone(); closeModal(); render(); };
}
const editCodes = () => {
  if (codesLocked() && !unlockedCodes) { alert('Enter the access-code password in the Access & Codes section to unlock, then edit.'); return; }
  const arr = codesLocked() ? unlockedCodes : (guide.codes = guide.codes || []);
  listEditor('Access & Codes', arr, [{ key: 'label', label: 'What', ph: 'Front door' }, { key: 'value', label: 'Code', ph: '1234' }, { key: 'note', label: 'Note', ph: 'optional' }], async () => {
    if (codesLocked()) { guide.codesEnc = await encCodes(arr, guestPass); delete guide.codes; unlockedCodes = arr; }
    await saveGuide();
  });
};
function editVideos() {
  guide.videos = guide.videos || [];
  const list = () => guide.videos.map((v, i) => `<div class="ci-row" data-i="${i}"><div class="ci-info"><b>🎬 ${esc(v.title || '(untitled)')}</b>${v.note ? `<small>${esc(v.note)}</small>` : ''}${v.url ? `<small class="mono" style="word-break:break-all;opacity:.7">${esc(v.url)}</small>` : ''}</div><button class="le-del" data-i="${i}">🗑</button></div>`).join('') || '<p class="muted">No videos yet.</p>';
  openModal(`<button class="m-close" id="m-close">✕</button><h3>How-To Videos</h3>
    <div id="vid-list">${list()}</div>
    <div class="le-form"><div class="le-form-h">Add a video</div>
      ${field('Title', 'vid-title', '', 'e.g. Turn on the water heater')}
      ${field('Note', 'vid-note', '', 'optional', true)}
      ${field('YouTube / web link', 'vid-url', '', 'paste a link — OR upload a file below')}
      <label class="photo-btn">📹 Upload a video file<input type="file" id="vid-file" accept="video/*" hidden></label>
      <span class="ci-photo-status" id="vid-status"></span>
      <p class="hint">Best for short clips (under ~50 MB). For long walkthroughs, an Unlisted YouTube link is smoother.</p>
      <button class="add" id="vid-add">＋ Add video</button></div>
    <button class="save" id="vid-done">Done</button>`);
  let uploadedUrl = '';
  const redraw = () => { $('#vid-list').innerHTML = list(); $('#vid-list').querySelectorAll('.le-del').forEach(b => b.onclick = async () => { guide.videos.splice(+b.dataset.i, 1); await saveGuide(); redraw(); }); };
  redraw();
  $('#vid-file').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 50 * 1024 * 1024) { $('#vid-status').textContent = `That clip is ${(f.size / 1048576).toFixed(0)} MB — over the 50 MB limit. Try a shorter clip or a YouTube link.`; e.target.value = ''; return; }
    $('#vid-status').textContent = 'Uploading… (may take a minute — keep this open)';
    try { uploadedUrl = await uploadVideo(f); $('#vid-status').textContent = '✓ video uploaded — now tap “Add video”'; }
    catch (err) { uploadedUrl = ''; $('#vid-status').textContent = 'Upload failed — ' + (err.message || err); }
  };
  $('#vid-add').onclick = async () => {
    const title = $('#vid-title').value.trim(), url = uploadedUrl || $('#vid-url').value.trim();
    if (!title && !url) { $('#vid-status').textContent = 'Add a title and a link or file first.'; return; }
    guide.videos.push({ title, url, note: $('#vid-note').value.trim() });
    uploadedUrl = ''; $('#vid-title').value = ''; $('#vid-note').value = ''; $('#vid-url').value = ''; $('#vid-status').textContent = '';
    await saveGuide(); redraw();
  };
  $('#vid-done').onclick = async () => { await saveGuide(); closeModal(); render(); };
}
const editContact = () => { openModal(`<button class="m-close" id="m-close">✕</button><h3>Contact</h3>${field('Name', 'ct-name', guide.contact.name)}${field('Phone', 'ct-phone', guide.contact.phone)}${field('Note', 'ct-note', guide.contact.note, 'e.g. text is fastest', true)}<button class="save" id="ct-save">Save</button>`); $('#ct-save').onclick = async () => { guide.contact = { name: $('#ct-name').value.trim(), phone: $('#ct-phone').value.trim(), note: $('#ct-note').value.trim() }; await saveGuide(); closeModal(); render(); }; };

async function editCollection(colId) {
  const col = guide.collections.find(c => c.id === colId); if (!col) return;
  const itemsHtml = () => (col.items || []).map((it, i) => `<div class="ci-row" data-i="${i}">${it.photo ? `<img src="${esc(it.photo)}">` : ''}<div class="ci-info"><b>${esc(it.name || '(unnamed)')}</b>${it.note ? `<small>${esc(it.note)}</small>` : ''}</div><button class="le-del" data-i="${i}">🗑</button></div>`).join('') || '<p class="muted">No items yet.</p>';
  openModal(`<button class="m-close" id="m-close">✕</button><h3>${esc(col.icon)} ${esc(col.title)}</h3>
    ${field('Section title', 'col-title', col.title)}
    ${field('Emoji', 'col-icon', col.icon)}
    ${field('Intro', 'col-intro', col.intro, '', true)}
    <div class="ci-list" id="ci-list">${itemsHtml()}</div>
    <div class="le-form"><div class="le-form-h">Add item</div>
      ${field('Name', 'ci-name', '', 'e.g. Olive oil, Cinnamon, Beach towels')}
      ${field('Note', 'ci-note', '', 'optional — brand, where it is')}
      <label class="photo-btn">📷 Add photo<input type="file" id="ci-photo" accept="image/*" hidden></label>
      <span class="ci-photo-status" id="ci-photo-status"></span>
      <button class="add" id="ci-add">＋ Add item</button></div>
    <button class="save" id="col-done">Done</button>
    <button class="danger" id="col-del">Delete this section</button>`);
  let pendingPhoto = '';
  const redraw = () => { $('#ci-list').innerHTML = itemsHtml(); $('#ci-list').querySelectorAll('.le-del').forEach(b => b.onclick = () => { col.items.splice(+b.dataset.i, 1); redraw(); }); };
  redraw();
  $('#ci-photo').onchange = async e => { const f = e.target.files[0]; if (!f) return; $('#ci-photo-status').textContent = 'Uploading…'; try { pendingPhoto = await uploadPhoto(f); $('#ci-photo-status').textContent = '✓ photo ready'; } catch (err) { $('#ci-photo-status').textContent = 'Upload failed'; } };
  $('#ci-add').onclick = () => { const name = $('#ci-name').value.trim(); if (!name && !pendingPhoto) return; col.items = col.items || []; col.items.push({ name, note: $('#ci-note').value.trim(), photo: pendingPhoto }); pendingPhoto = ''; $('#ci-name').value = ''; $('#ci-note').value = ''; $('#ci-photo-status').textContent = ''; redraw(); };
  $('#col-done').onclick = async () => { col.title = $('#col-title').value.trim() || col.title; col.icon = $('#col-icon').value.trim() || col.icon; col.intro = $('#col-intro').value.trim(); await saveGuide(); closeModal(); render(); };
  $('#col-del').onclick = async () => { if (!confirm(`Delete “${col.title}” and its items?`)) return; guide.collections = guide.collections.filter(c => c.id !== colId); await saveGuide(); closeModal(); render(); };
}
async function addCollection() {
  const title = prompt('New section name (e.g. "Beach Rules", "Local Favorites"):'); if (!title) return;
  const icon = prompt('An emoji for it:', '📌') || '📌';
  guide.collections.push({ id: 'x' + Date.now().toString(36), icon, title: title.trim(), intro: '', items: [] });
  await saveGuide(); render();
}

// ---------- owner auth ----------
function openLogin() {
  openModal(`<button class="m-close" id="m-close">✕</button><h3>Owner sign-in</h3>
    <p class="hint">Guests don't need this. Owner only — to edit the guide.</p>
    <div id="lg1">${field('Your email', 'lg-email', '', 'espector@harrityllp.com')}<button class="save" id="lg-send">Send me a code</button></div>
    <div id="lg2" style="display:none">${field('8-digit code from email', 'lg-code', '')}<button class="save" id="lg-verify">Sign in</button></div>
    <p class="status" id="lg-status"></p>`);
  $('#lg-send').onclick = async () => { const email = $('#lg-email').value.trim(); if (!email) return; $('#lg-status').textContent = 'Sending…'; const { error } = await sb.auth.signInWithOtp({ email }); if (error) { $('#lg-status').textContent = error.message; return; } $('#lg1').style.display = 'none'; $('#lg2').style.display = ''; $('#lg-status').textContent = 'Check your email for the code.'; };
  $('#lg-verify').onclick = async () => { const email = $('#lg-email').value.trim(), token = $('#lg-code').value.trim(); $('#lg-status').textContent = 'Verifying…'; const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' }); if (error) { $('#lg-status').textContent = error.message; return; } isOwner = true; editMode = true; closeModal(); render(); };
}
$('#owner-btn').onclick = () => {
  if (!isOwner) { openLogin(); return; }
  editMode = !editMode; render();  // toggle edit affordances
};

// ---------- delegated clicks ----------
document.addEventListener('click', e => {
  if (e.target.id === 'codes-unlock') { unlockCodesFromInput(); return; }
  const cp = e.target.closest('[data-copy]'); if (cp) { navigator.clipboard && navigator.clipboard.writeText(cp.dataset.copy); cp.textContent = '✓'; setTimeout(() => cp.textContent = 'Copy', 1200); return; }
  const ed = e.target.closest('[data-edit]'); if (ed && isOwner) {
    const v = ed.dataset.edit;
    if (v === 'welcome') editWelcome(); else if (v === 'wifi') editWifi(); else if (v === 'codes') editCodes();
    else if (v === 'videos') editVideos(); else if (v === 'contact') editContact(); else if (v === 'addcol') addCollection();
    else if (v.startsWith('col:')) editCollection(v.slice(4));
    return;
  }
  const z = e.target.closest('[data-zoom]'); if (z) { openModal(`<button class="m-close" id="m-close">✕</button><img class="zoom-img" src="${esc(z.dataset.zoom)}">`); return; }
});
$('#share-guide').onclick = () => openModal(`<button class="m-close" id="m-close">✕</button><h3>Share this guide</h3><p class="hint">Print this QR for the house, or send guests the link.</p><div class="qr-wrap"><img class="qr" src="${qr(location.href.split('#')[0], 260)}"></div><div class="kv"><span>Link</span><b class="mono" style="font-size:.8rem;word-break:break-all">${esc(location.href.split('#')[0])}</b><button class="mini-btn" data-copy="${esc(location.href.split('#')[0])}">Copy</button></div>`);

// ---------- access-code encryption (codes are stored encrypted; the guest ----------
// password is the key. Nobody can read the codes from the database or the repo
// without it — it's real AES-GCM encryption, derived from the password.
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function deriveKey(pass, salt) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encCodes(codes, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(codes)));
  return { s: b64(salt), iv: b64(iv), ct: b64(ct) };
}
async function decCodes(enc, pass) {
  const key = await deriveKey(pass, unb64(enc.s));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(enc.iv) }, key, unb64(enc.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
let guestPass = '';         // the code password, once entered (kept for this device)
let unlockedCodes = null;   // decrypted codes array, once unlocked
const codesLocked = () => !!(guide.passHash || guide.codesEnc);   // a password is set
async function tryUnlock(pass) {
  if (guide.passHash) { if (await sha(pass) !== guide.passHash) return false; }
  else if (!guide.codesEnc) return false;
  if (guide.codesEnc) { try { unlockedCodes = await decCodes(guide.codesEnc, pass); } catch { return false; } }
  else unlockedCodes = [];
  guestPass = pass; localStorage.setItem('naples_gp', pass); return true;
}
async function unlockCodesFromInput() {
  const el = document.getElementById('codes-pass'); if (!el) return;
  if (await tryUnlock(el.value.trim())) render();
  else { const s = document.getElementById('codes-status'); if (s) s.textContent = 'Wrong password — check with your host.'; }
}

// ---------- init ----------
(async () => {
  if (sb) { try { const { data } = await sb.auth.getSession(); if (data && data.session) isOwner = true; } catch {} }
  await loadGuide();
  const saved = localStorage.getItem('naples_gp') || '';
  if (codesLocked() && saved) await tryUnlock(saved);
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
