// Galata Wind İSG Portalı — Cloudflare Worker
// Görevleri: Cloudflare Access (Entra ID) oturumunu doğrulamak, kullanıcıyı
// portal listesiyle eşleştirmek, rol bazlı yetkiyi sunucuda uygulamak,
// D1 veritabanına okuma/yazma ve kayıt geçmişini (audit log) tutmak.
//
// Gerekli ayarlar (Worker > Settings):
//   Bağlantı (binding): DB  -> D1 veritabanı "isg-portal-pilot"
//   Değişkenler: TEAM_DOMAIN, POLICY_AUD, ADMIN_EMAILS

/* Panel kurulumunda portal arayüzü bu dosyanın içine gömülüdür.
   Proje (wrangler) kurulumunda arayüz public/index.html'den sunulur. */
const INDEX_HTML = /*__INDEX_HTML__*/null;

const DOC_COLLS = new Set(['bildirimler', 'dof', 'risk', 'egitimler', 'kkd', 'dokumanlar', 'iso45001',
  'duyurular', 'acil', 'yukleniciler', 'kullanicilar', 'ayarlar']);
const LOG_KINDS = new Set(['audit', 'eposta']);
const ROLES = ['calisan', 'yonetici', 'isg'];
const TUR_PREFIX = { ramak: 'RK', tehlike: 'TH', kaza: 'KZ' };
const NUMBERED = { dof: 'DOF', risk: 'RD' };           // bildirimler: türe göre
const BIL_DURUM = ['Yeni', 'İnceleniyor', 'DÖF Açıldı', 'Kapatıldı'];
const DOF_DURUM = ['Açık', 'Devam Ediyor', 'Doğrulama Bekliyor', 'Kapandı'];
const BIL_FIELDS = ['baslik', 'tarih', 'saat', 'saha', 'konum', 'aciklama', 'siddet', 'anlikOnlem', 'kazaTuru',
  'etkilenen', 'yaraliSayisi', 'kayipGun', 'yaraBolge', 'tanik', 'oneri', 'ekler', 'anonim'];
const DOF_PROGRESS = ['ilerleme', 'durum', 'guncellemeNotu', 'ekler'];
const MAX_DOC_BYTES = 1_900_000;   // D1 satır sınırı ~2 MB
const MAX_BODY_BYTES = 2_600_000;
const LOG_DAYS = 45;

const SEC_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://cdn.jsdelivr.net",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',
};

/* ---------------- yardımcılar ---------------- */
const enc = new TextEncoder();
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC_HEADERS },
});
const fail = (status, error, extra = {}) => json({ error, ...extra }, status);
const str = (v, n) => String(v ?? '').slice(0, n);
const pick = (o, keys) => Object.fromEntries(keys.filter(k => k in o).map(k => [k, o[k]]));
const trDate = (ms = Date.now()) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10); // Türkiye saati (UTC+3)
const parse = s => { try { return JSON.parse(s); } catch { return null; } };
const cleanDomain = d => String(d || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const deny = (msg = 'Bu işlem için yetkiniz yok.') => { throw new HttpError(403, msg); };

function isConfigured(env) {
  const t = cleanDomain(env.TEAM_DOMAIN), a = String(env.POLICY_AUD || '');
  return !!(t && a && !t.includes('TAKIM-ADI') && !a.includes('ACCESS_AUD'));
}
function isDev(env, url) {
  return !!env.DEV_EMAIL && ['localhost', '127.0.0.1'].includes(url.hostname);
}

/* ---------------- Cloudflare Access JWT doğrulama ---------------- */
let JWKS = { keys: null, at: 0 };
function b64u(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const b = atob(s), u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}
async function getKeys(team, force) {
  if (!force && JWKS.keys && Date.now() - JWKS.at < 3600e3) return JWKS.keys;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error('Access sertifikaları alınamadı');
  const j = await r.json(), keys = {};
  for (const k of j.keys || []) {
    if (k.kty !== 'RSA' || !k.kid) continue;
    keys[k.kid] = await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  }
  JWKS = { keys, at: Date.now() };
  return keys;
}
function cookie(req, name) {
  const c = req.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}
async function verifyAccess(req, env) {
  const token = req.headers.get('Cf-Access-Jwt-Assertion') || cookie(req, 'CF_Authorization');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const header = parse(new TextDecoder().decode(b64u(parts[0])));
  const payload = parse(new TextDecoder().decode(b64u(parts[1])));
  if (!header || !payload || header.alg !== 'RS256') return null;
  const team = cleanDomain(env.TEAM_DOMAIN);
  let keys = await getKeys(team);
  if (!keys[header.kid]) keys = await getKeys(team, true);
  const key = keys[header.kid];
  if (!key) return null;
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(parts[2]), enc.encode(parts[0] + '.' + parts[1]));
  if (!ok) return null;
  const now = Date.now() / 1000;
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(String(env.POLICY_AUD).trim())) return null;
  if (!payload.exp || payload.exp < now) return null;
  if (payload.nbf && payload.nbf > now + 60) return null;
  if (payload.iss !== `https://${team}`) return null;
  return String(payload.email || '').trim().toLowerCase() || null;
}
async function identify(req, env, url) {
  if (isDev(env, url)) return String(env.DEV_EMAIL).trim().toLowerCase();
  if (!isConfigured(env)) return null;
  return verifyAccess(req, env);
}

/* ---------------- kullanıcı ve görünürlük ---------------- */
async function loadUser(env, email) {
  const row = await env.DB.prepare(
    "SELECT id, data FROM docs WHERE coll = 'kullanicilar' AND deleted = 0 AND lower(json_extract(data, '$.eposta')) = ?1 LIMIT 1"
  ).bind(email).first();
  if (row) {
    const u = parse(row.data) || {};
    return { ...u, id: row.id, eposta: email, rol: ROLES.includes(u.rol) ? u.rol : 'calisan' };
  }
  const admins = String(env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (admins.includes(email)) {
    return { id: 'gecici', username: email.split('@')[0], ad: email, rol: 'isg', ekip: 'İSG', saha: '', eposta: email, gecici: true };
  }
  return null;
}
async function userIndex(env) {
  const { results } = await env.DB.prepare(
    "SELECT json_extract(data, '$.username') AS un, json_extract(data, '$.ekip') AS ek, lower(json_extract(data, '$.eposta')) AS ep FROM docs WHERE coll = 'kullanicilar' AND deleted = 0"
  ).all();
  const ekip = new Map(), mails = new Set();
  for (const r of results) { if (r.un) ekip.set(r.un, r.ek || ''); if (r.ep) mails.add(r.ep); }
  return { ekipOf: un => ekip.get(un) || '', mails };
}
function canSee(u, coll, d, ekipOf) {
  if (u.rol === 'isg') return true;
  const me = u.username, mgr = u.rol === 'yonetici';
  switch (coll) {
    case 'bildirimler': return d.bildiren === me || (mgr && !!u.ekip && d.ekip === u.ekip);
    case 'dof': return d.sorumlu === me || (mgr && !!u.ekip && d.ekip === u.ekip);
    case 'egitimler': return (d.katilimcilar || []).some(k => k && (k.u === me || (mgr && !!u.ekip && ekipOf(k.u) === u.ekip)));
    case 'kkd': return d.u === me || (mgr && !!u.ekip && ekipOf(d.u) === u.ekip);
    default: return true;
  }
}
const hidesReporter = (u, coll, d) => coll === 'bildirimler' && u.rol !== 'isg' && !!d.anonim && d.bildiren !== u.username;
const redact = (u, coll, d) => hidesReporter(u, coll, d) ? { ...d, bildiren: '', olusturan: '' } : d;

// Rol isg değilse: görebildiği kayıtlar (anahtar "coll/id") -> bildiren gizli mi?
async function visibleMap(env, u, ekipOf) {
  const { results } = await env.DB.prepare(
    "SELECT coll, id, json_extract(data,'$.bildiren') AS bildiren, json_extract(data,'$.ekip') AS ekip, json_extract(data,'$.sorumlu') AS sorumlu, json_extract(data,'$.u') AS uu, json_extract(data,'$.katilimcilar') AS kat, json_extract(data,'$.anonim') AS anonim FROM docs WHERE deleted = 0"
  ).all();
  const m = new Map();
  for (const r of results) {
    const d = { bildiren: r.bildiren, ekip: r.ekip, sorumlu: r.sorumlu, u: r.uu, katilimcilar: parse(r.kat) || [], anonim: !!r.anonim };
    if (canSee(u, r.coll, d, ekipOf)) m.set(r.coll + '/' + r.id, hidesReporter(u, r.coll, d));
  }
  return m;
}

/* ---------------- yazma yetkisi ---------------- */
function authorize(u, coll, old, data) {
  const me = u.username, mgr = u.rol === 'yonetici';
  if (u.rol === 'isg') {
    const rec = { ...data };
    if (coll === 'bildirimler') {
      if (!old) {
        if (!TUR_PREFIX[rec.tur]) throw new HttpError(400, 'Geçersiz bildirim türü.');
        rec.bildiren = rec.bildiren || me; rec.durum = rec.durum || 'Yeni'; rec.ekip = rec.ekip ?? (u.ekip || '');
      } else { rec.tur = old.tur; rec.bildiren = old.bildiren; }
    }
    return rec;
  }
  switch (coll) {
    case 'bildirimler': {
      if (!old) {
        if (!TUR_PREFIX[data.tur]) throw new HttpError(400, 'Geçersiz bildirim türü.');
        const rec = { ...pick(data, BIL_FIELDS), tur: data.tur, durum: 'Yeni', bildiren: me, ekip: u.ekip || '' };
        if (rec.tur === 'kaza') rec.anonim = false;
        return rec;
      }
      if (old.bildiren === me && old.durum === 'Yeni' && (!data.durum || data.durum === 'Yeni')) {
        const rec = { ...old, ...pick(data, BIL_FIELDS) };
        if (old.tur === 'kaza') rec.anonim = false;
        return rec;
      }
      if (mgr && u.ekip && old.ekip === u.ekip) {
        if (!BIL_DURUM.includes(data.durum)) throw new HttpError(400, 'Geçersiz durum.');
        return { ...old, durum: data.durum };
      }
      return deny();
    }
    case 'dof': {
      if (!old || !(old.sorumlu === me || (mgr && u.ekip && old.ekip === u.ekip))) return deny();
      if (old.durum === 'Kapandı') return deny('Kapanmış DÖF güncellenemez.');
      const p = pick(data, DOF_PROGRESS);
      if (p.durum !== undefined && !DOF_DURUM.includes(p.durum)) throw new HttpError(400, 'Geçersiz durum.');
      if (p.durum === 'Kapandı') return deny('Kapatma, İSG departmanının etkinlik doğrulamasıyla yapılır.');
      if (p.ilerleme !== undefined) p.ilerleme = Math.max(0, Math.min(100, Number(p.ilerleme) || 0));
      return { ...old, ...p };
    }
    case 'kkd': {
      if (old && old.u === me && old.durum === 'Teslim Bekliyor' && data.durum === 'Teslim Edildi') {
        return { ...old, durum: 'Teslim Edildi', onay: new Date().toISOString() };
      }
      return deny();
    }
    default: return deny();
  }
}

async function writeAudit(env, entry) {
  const ts = entry.ts || new Date().toISOString();
  await env.DB.prepare('INSERT INTO logs (kind, ts, gun, data) VALUES (?1, ?2, ?3, ?4)')
    .bind('audit', ts, trDate(), JSON.stringify({ ...entry, ts })).run();
}

/* ---------------- uç noktalar ---------------- */
async function getData(env, u, url) {
  const since = Math.max(0, Number(url.searchParams.get('since')) || 0);
  const logSince = Math.max(0, Number(url.searchParams.get('logSince')) || 0);
  const now = Date.now();
  const { ekipOf } = await userIndex(env);

  const rows = since
    ? (await env.DB.prepare('SELECT coll, id, data, deleted FROM docs WHERE updated_at > ?1').bind(since - 5000).all()).results
    : (await env.DB.prepare('SELECT coll, id, data, deleted FROM docs WHERE deleted = 0').all()).results;
  const docs = [];
  for (const r of rows) {
    if (!DOC_COLLS.has(r.coll)) continue;
    if (r.deleted) { docs.push({ coll: r.coll, id: r.id, deleted: 1 }); continue; }
    const d = parse(r.data);
    if (!d) continue;
    if (canSee(u, r.coll, d, ekipOf)) docs.push({ coll: r.coll, id: r.id, data: redact(u, r.coll, d) });
    else if (since) docs.push({ coll: r.coll, id: r.id, deleted: 1 });
  }

  const lr = (logSince
    ? await env.DB.prepare('SELECT id, kind, gun, data FROM logs WHERE id > ?1 ORDER BY id LIMIT 5000').bind(logSince).all()
    : await env.DB.prepare('SELECT id, kind, gun, data FROM logs WHERE gun >= ?1 ORDER BY id DESC LIMIT 20000').bind(trDate(now - LOG_DAYS * 864e5)).all()
  ).results;
  let lastLog = logSince, vis = null;
  const logs = [];
  for (const l of lr) {
    lastLog = Math.max(lastLog, l.id);
    if (!LOG_KINDS.has(l.kind)) continue;
    if (l.kind === 'eposta' && u.rol !== 'isg') continue;
    let e = parse(l.data);
    if (!e) continue;
    if (l.kind === 'audit' && u.rol !== 'isg') {
      if (!vis) vis = await visibleMap(env, u, ekipOf);
      const key = e.coll + '/' + e.kayit;
      if (!vis.has(key)) { if (e.u !== u.username) continue; }
      else if (vis.get(key) && e.u !== u.username) e = { ...e, u: '' };
    }
    logs.push({ kind: l.kind, gun: l.gun, entry: e });
  }
  if (!logSince) logs.reverse();
  return json({ docs, logs, now, lastLog });
}

async function putDoc(env, u, coll, id, body) {
  const data = body && body.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Geçersiz veri.');
  const cur = await env.DB.prepare('SELECT data, deleted FROM docs WHERE coll = ?1 AND id = ?2').bind(coll, id).first();
  if (cur && cur.deleted) throw new HttpError(409, 'Bu kayıt silinmiş.');
  const old = cur ? parse(cur.data) : null;
  if (old && !canSee(u, coll, old, (await userIndex(env)).ekipOf)) deny();

  const rec = authorize(u, coll, old, data);
  delete rec.id;
  const nowMs = Date.now(), nowIso = new Date(nowMs).toISOString();
  rec.olusturan = old ? (old.olusturan ?? rec.olusturan ?? '') : u.username;
  rec.olusturma = old ? (old.olusturma ?? rec.olusturma ?? nowIso) : nowIso;
  rec.guncelleme = nowIso;
  rec.guncelleyen = u.username;

  if (coll === 'kullanicilar') {
    rec.eposta = String(rec.eposta || '').trim().toLowerCase();
    rec.username = String(rec.username || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rec.eposta)) throw new HttpError(400, 'Geçerli bir e-posta girin.');
    if (!rec.username) throw new HttpError(400, 'Kullanıcı adı gerekli.');
    if (!ROLES.includes(rec.rol)) throw new HttpError(400, 'Geçersiz rol.');
    const dup = await env.DB.prepare(
      "SELECT id FROM docs WHERE coll = 'kullanicilar' AND deleted = 0 AND id <> ?2 AND (lower(json_extract(data, '$.eposta')) = ?1 OR json_extract(data, '$.username') = ?3) LIMIT 1"
    ).bind(rec.eposta, id, rec.username).first();
    if (dup) throw new HttpError(409, 'Bu e-posta ya da kullanıcı adı başka bir kullanıcıda tanımlı.');
  }

  const prefix = !old && (coll === 'bildirimler' ? TUR_PREFIX[rec.tur] : NUMBERED[coll]);
  if (old && old.no) rec.no = old.no;
  const payload = JSON.stringify(rec);
  if (enc.encode(payload).length > MAX_DOC_BYTES) throw new HttpError(413, 'Kayıt çok büyük. Ekleri küçültüp ya da azaltıp tekrar deneyin.');

  let row;
  if (prefix) {
    const pre = `${prefix}-${trDate().slice(0, 4)}-`;
    row = await env.DB.prepare(
      `INSERT INTO docs (coll, id, data, deleted, updated_at, updated_by)
       VALUES (?1, ?2, json_set(?3, '$.no', ?4 || printf('%04d', 1 + COALESCE((
         SELECT MAX(CAST(substr(json_extract(data, '$.no'), ?5) AS INTEGER)) FROM docs
         WHERE coll = ?1 AND json_extract(data, '$.no') LIKE ?4 || '%'), 0))), 0, ?6, ?7)
       RETURNING data`
    ).bind(coll, id, payload, pre, pre.length + 1, nowMs, u.eposta).first();
  } else {
    row = await env.DB.prepare(
      `INSERT INTO docs (coll, id, data, deleted, updated_at, updated_by) VALUES (?1, ?2, ?3, 0, ?4, ?5)
       ON CONFLICT (coll, id) DO UPDATE SET data = excluded.data, deleted = 0, updated_at = excluded.updated_at, updated_by = excluded.updated_by
       RETURNING data`
    ).bind(coll, id, payload, nowMs, u.eposta).first();
  }
  const saved = parse(row.data);
  const meta = (body && body.meta) || {};
  await writeAudit(env, {
    u: u.username, islem: str(meta.islem || (old ? 'Güncelleme' : 'Oluşturma'), 60), coll, kayit: id,
    detay: str(prefix ? saved.no : (meta.detay || saved.no || saved.baslik || saved.ad || ''), 160),
  });
  return json({ ok: true, data: redact(u, coll, saved) });
}

async function deleteDoc(env, u, coll, id, body) {
  if (u.rol !== 'isg') deny('Kayıt silme yetkisi yalnızca İSG departmanındadır.');
  const r = await env.DB.prepare('UPDATE docs SET deleted = 1, updated_at = ?1, updated_by = ?2 WHERE coll = ?3 AND id = ?4 AND deleted = 0')
    .bind(Date.now(), u.eposta, coll, id).run();
  if (!r.meta.changes) throw new HttpError(404, 'Kayıt bulunamadı.');
  const meta = (body && body.meta) || {};
  await writeAudit(env, { u: u.username, islem: 'Silme', coll, kayit: id, detay: str(meta.detay, 160) });
  return json({ ok: true });
}

async function postLog(env, u, kind, body) {
  const e = (body && body.entry) || {};
  const ts = new Date().toISOString();
  if (kind === 'audit') {
    // Kayıt işlemlerinin geçmişini sunucu kendisi yazar; istemciden gelen kopyası atlanır.
    if (DOC_COLLS.has(e.coll)) return json({ ok: true, skipped: true });
    await writeAudit(env, { ts, u: u.username, islem: str(e.islem, 60), coll: str(e.coll, 40), kayit: str(e.kayit, 120), detay: str(e.detay, 160) });
    return json({ ok: true });
  }
  // E-posta kuyruğu: yalnızca portalda tanımlı adreslere
  const { mails } = await userIndex(env);
  const alici = [...new Set(String(e.alici || '').split(',').map(s => s.trim().toLowerCase()).filter(a => mails.has(a)))];
  if (!alici.length) return json({ ok: true, skipped: true });
  // İsteğe bağlı kayıt bağlantısı: gönderimde e-posta içeriği bu kayıttan sunucuda üretilir.
  // Yalnızca gönderenin görebildiği kayıt bağlanır; aksi halde içerik e-postayla sızabilirdi.
  let ref = {};
  if (MAIL_COLLS.has(e.coll) && /^[\p{L}\p{N}_.:@-]{1,120}$/u.test(String(e.kayit || ''))) {
    const d = await env.DB.prepare('SELECT data FROM docs WHERE coll = ?1 AND id = ?2 AND deleted = 0').bind(e.coll, e.kayit).first();
    const doc = d && parse(d.data);
    if (doc && canSee(u, e.coll, doc, (await userIndex(env)).ekipOf)) ref = { coll: e.coll, kayit: e.kayit, ...(MAIL_OLAY[e.olay] ? { olay: e.olay } : {}) };
  }
  await queueMail(env, { ts, alici: alici.join(', '), konu: str(e.konu, 300), gonderen: u.username, ...ref });
  return json({ ok: true });
}

function queueMail(env, entry) {
  const ts = entry.ts || new Date().toISOString();
  return env.DB.prepare('INSERT INTO logs (kind, ts, gun, data) VALUES (?1, ?2, ?3, ?4)').bind('eposta', ts, trDate(),
    JSON.stringify({ ...entry, ts, durum: 'Kuyruğa alındı' })).run();
}

/* ---------------- e-posta gönderimi (Microsoft Graph) ---------------- */
// Zamanlanmış görev kuyruktaki e-postaları MAIL_FROM kutusundan gönderir.
// Gerekli secret'lar: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, MAIL_FROM
// Graph hazır değilse geçici yol: RESEND_API_KEY (+ isteğe bağlı RESEND_FROM). Kişisel/sağlık verisi
// üçüncü taraf servisten geçmesin diye Resend e-postaları yalnızca konu ve portal bağlantısı içerir.
const REMINDER_CRON = '0 6 * * 1-5';     // hafta içi 09:00 (Türkiye saati)
const MAIL_BATCH = 20, MAIL_MAX_TRY = 3, MAIL_MAX_AGE_MS = 2 * 864e5, REMINDER_DAYS = 3;
const graphReady = env => !!(env.GRAPH_TENANT_ID && env.GRAPH_CLIENT_ID && env.GRAPH_CLIENT_SECRET && env.MAIL_FROM);
const mailReady = env => graphReady(env) || !!env.RESEND_API_KEY;
const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const trD = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d.split('-').reverse().join('.') : (d || '—');
const MAIL_COLLS = new Set(['bildirimler', 'dof']);
const MAIL_TUR = { ramak: 'Ramak kala', tehlike: 'Tehlikeli durum', kaza: 'İş kazası' };
// İstemcinin seçebileceği e-posta olayları ve giriş cümleleri ({tur}: olay tipi)
const MAIL_OLAY = {
  'bildirim-yeni': 'Sorumluluk alanınızda yeni bir {tur} bildirimi yapıldı.',
  'bildirim-durum': 'Yaptığınız bildirimin durumu güncellendi.',
  'dof-yeni': 'Sorumluluğunuzda yeni bir düzeltici/önleyici faaliyet (DÖF) açıldı.',
  'dof-atama': 'Aşağıdaki DÖF size atandı.',
  'dof-dogrulama': 'Aşağıdaki DÖF tamamlandı olarak bildirildi ve İSG etkinlik doğrulamasını bekliyor.',
};

async function graphToken(env) {
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(env.GRAPH_TENANT_ID)}/oauth2/v2.0/token`, {
    method: 'POST',
    body: new URLSearchParams({ client_id: env.GRAPH_CLIENT_ID, client_secret: env.GRAPH_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Graph erişim anahtarı alınamadı: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}

// Olay ve DÖF e-postaları: giriş cümlesi + "Detaylar" tablosu + açıklama + kaydı açan bağlantı
function mailHtml(env, e, doc, nameOf, brief) {
  const url = String(env.PORTAL_URL || '').replace(/\/+$/, '');
  const row = (k, v) => v === undefined || v === null || v === '' ? '' :
    `<tr><td style="padding:6px 16px 6px 0;color:#6E6F72;vertical-align:top;white-space:nowrap">${escHtml(k)}</td><td style="padding:6px 0;vertical-align:top">${escHtml(v)}</td></tr>`;
  const block = (k, v) => v ? `<p style="margin:18px 0 4px;font-weight:600">${escHtml(k)}</p><p style="margin:0;white-space:pre-wrap">${escHtml(v)}</p>` : '';
  const ekler = d => Array.isArray(d.ekler) && d.ekler.length ? `${d.ekler.length} dosya (portalda görüntülenebilir)` : '';
  let intro = '', rows = '', text = '', page = '', btn = "İSG Portalı'nda aç";
  if (e.coll === 'bildirimler' && doc) {
    const tur = MAIL_TUR[doc.tur] || 'Olay';
    intro = (MAIL_OLAY[e.olay] || 'Bir olay bildirimi hakkında bilgilendirme:').replace('{tur}', tur.toLocaleLowerCase('tr-TR'));
    rows = row('Bildirim no', doc.no) + row('Olay tipi', tur) + row('Başlık', doc.baslik)
      + (doc.tur === 'kaza'
        ? row('Kaza türü', doc.kazaTuru) + row('Etkilenen kişi', doc.etkilenen) + row('Yaralı / kayıp iş günü', `${doc.yaraliSayisi ?? 0} / ${doc.kayipGun ?? 0}`) + row('Yaralanan bölge', doc.yaraBolge) + row('Tanıklar', doc.tanik)
        : row('Olası sonucun önemi', doc.siddet))
      + row('Tarih / saat', trD(doc.tarih) + (doc.saat ? ' – ' + doc.saat : '')) + row('Saha', doc.saha) + row('Konum', doc.konum)
      + row('Bildiren', doc.anonim ? 'Anonim' : nameOf(doc.bildiren)) + row('Ekip', doc.ekip) + row('Durum', doc.durum) + row('Ekler', ekler(doc));
    text = block('Rapor detayı', doc.aciklama) + block('Anlık alınan önlem', doc.anlikOnlem) + block('Önleme önerisi', doc.oneri);
    page = '#/' + (doc.tur === 'kaza' ? 'kaza' : 'ramak') + '/' + encodeURIComponent(e.kayit);
    btn = 'İlgili bildirimi görüntüle';
  } else if (e.coll === 'dof' && doc) {
    const gecikti = doc.termin && doc.durum !== 'Kapandı' && doc.termin < trDate();
    intro = MAIL_OLAY[e.olay] || 'Bir DÖF hakkında bilgilendirme:';
    rows = row('DÖF no', doc.no) + row('Başlık', doc.baslik) + row('Tip', doc.tip) + row('Kaynak', doc.kaynak)
      + row('Sorumlu', nameOf(doc.sorumlu)) + row('Saha', doc.saha) + row('Açılış', trD(doc.acilis))
      + row('Termin', trD(doc.termin) + (gecikti ? ' (termin geçti)' : '')) + row('Durum', doc.durum)
      + row('İlerleme', doc.ilerleme === undefined ? '' : '%' + doc.ilerleme) + row('Ekler', ekler(doc));
    text = block('Kök neden', doc.kokNeden) + block('Planlanan faaliyet', doc.faaliyet)
      + (e.olay === 'dof-dogrulama' ? block('Yapılanlar (son güncelleme)', doc.guncellemeNotu) : '');
    page = '#/dof/' + encodeURIComponent(e.kayit);
    btn = "İlgili DÖF'ü görüntüle";
  } else if (Array.isArray(e.ozet)) {
    intro = 'Sorumluluğunuzdaki aşağıdaki DÖF\'lerin termini geçti ya da yaklaşıyor:';
    rows = `<tr><th align="left" style="padding:6px 16px 6px 0">DÖF</th><th align="left" style="padding:6px 16px 6px 0">Başlık</th><th align="left" style="padding:6px 0">Termin</th></tr>${
      e.ozet.map(d => `<tr><td style="padding:6px 16px 6px 0;white-space:nowrap">${escHtml(d.no)}</td><td style="padding:6px 16px 6px 0">${escHtml(d.baslik)}</td><td style="padding:6px 0;white-space:nowrap${d.gecikti ? ';color:#C23B00;font-weight:600' : ''}">${trD(d.termin)}${d.gecikti ? ' (termin geçti)' : ''}</td></tr>`).join('')}`;
    page = '#/dof';
    btn = 'DÖF Takibi\'ni aç';
  }
  if (brief) { intro = "Ayrıntılar için kaydı İSG Portalı'nda görüntüleyin."; rows = ''; text = ''; }
  const link = url ? `<p style="margin:24px 0 0"><a href="${escHtml(url + '/' + page)}" style="display:inline-block;background:#002F87;color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;font-weight:600">${escHtml(btn)}</a></p>` : '';
  const details = rows ? `<p style="margin:20px 0 6px;font-size:16px;font-weight:600;color:#002F87">Detaylar</p><table role="presentation" style="border-collapse:collapse;width:100%">${rows}</table>` : '';
  return `<div style="background:#F4F5F5;padding:24px 12px;font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#242628">
<table role="presentation" style="border-collapse:collapse;width:100%;max-width:640px;margin:0 auto;background:#fff;border:1px solid #E0E1E2">
<tr><td style="background:#002F87;color:#fff;padding:14px 24px;font-size:15px;font-weight:600">Galata Wind · İSG Portalı</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 4px;font-size:17px;font-weight:600">${escHtml(e.konu)}</p>
${intro ? `<p style="margin:16px 0 0">Merhaba,</p><p style="margin:8px 0 0">${escHtml(intro)}</p>` : ''}${details}${text}${link}
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #E0E1E2;color:#6E6F72;font-size:12px">Bu e-posta Galata Wind İSG Portalı tarafından otomatik gönderilmiştir. Lütfen yanıtlamayın; işlemleri portal üzerinden yapın.</td></tr>
</table></div>`;
}

async function resendSend(env, e, doc, nameOf, rowId) {
  const to = String(e.alici || '').split(',').map(s => s.trim()).filter(Boolean);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'isg-eposta-' + rowId },
    body: JSON.stringify({ from: env.RESEND_FROM || 'İSG Portalı <onboarding@resend.dev>', to, subject: e.konu, html: mailHtml(env, e, doc, nameOf, true) }),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(`Resend ${r.status}: ${j.message || ''}`); }
}

async function graphSend(env, token, e, doc, nameOf) {
  const to = String(e.alici || '').split(',').map(s => s.trim()).filter(Boolean);
  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env.MAIL_FROM)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ saveToSentItems: false, message: { subject: e.konu,
      body: { contentType: 'HTML', content: mailHtml(env, e, doc, nameOf) },
      toRecipients: to.map(address => ({ emailAddress: { address } })) } }),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(`Graph ${r.status}: ${j.error?.message || ''}`); }
}

async function sendMailQueue(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, data FROM logs WHERE kind = 'eposta' AND json_extract(data, '$.durum') = 'Kuyruğa alındı' ORDER BY id LIMIT ?1"
  ).bind(MAIL_BATCH).all();
  if (!results.length) return;
  let token = null;
  const names = new Map((await env.DB.prepare(
    "SELECT json_extract(data, '$.username') AS un, json_extract(data, '$.ad') AS ad FROM docs WHERE coll = 'kullanicilar' AND deleted = 0"
  ).all()).results.map(r => [r.un, r.ad]));
  const nameOf = un => names.get(un) || un || '';
  for (const row of results) {
    const e = parse(row.data) || {};
    let upd;
    if (Date.now() - Date.parse(e.ts) > MAIL_MAX_AGE_MS) upd = { durum: 'Atlandı (süresi geçti)' };
    else try {
      const d = e.coll && e.kayit ? await env.DB.prepare('SELECT data FROM docs WHERE coll = ?1 AND id = ?2 AND deleted = 0').bind(e.coll, e.kayit).first() : null;
      if (graphReady(env)) { token = token || await graphToken(env); await graphSend(env, token, e, d && parse(d.data), nameOf); }
      else await resendSend(env, e, d && parse(d.data), nameOf, row.id);
      upd = { durum: 'Gönderildi', gonderim: new Date().toISOString() };
    } catch (err) {
      const deneme = (e.deneme || 0) + 1;
      upd = { deneme, hata: str(err && err.message, 300), ...(deneme >= MAIL_MAX_TRY ? { durum: 'Hata' } : {}) };
      console.error('E-posta gönderilemedi', row.id, upd.hata);
    }
    await env.DB.prepare('UPDATE logs SET data = ?2 WHERE id = ?1').bind(row.id, JSON.stringify({ ...e, ...upd })).run();
  }
}

// Termini geçen ya da REMINDER_DAYS gün içinde dolacak açık DÖF'ler için sorumluya günlük tek özet
async function queueDofReminders(env) {
  const today = trDate(), limit = trDate(Date.now() + REMINDER_DAYS * 864e5);
  const done = await env.DB.prepare(
    "SELECT 1 FROM logs WHERE kind = 'eposta' AND gun = ?1 AND json_extract(data, '$.tur') = 'dof-hatirlatma' LIMIT 1"
  ).bind(today).first();
  if (done) return;
  const { results } = await env.DB.prepare(
    "SELECT data FROM docs WHERE coll = 'dof' AND deleted = 0 AND json_extract(data, '$.durum') <> 'Kapandı' AND json_extract(data, '$.termin') <= ?1"
  ).bind(limit).all();
  const users = (await env.DB.prepare(
    "SELECT json_extract(data, '$.username') AS un, lower(json_extract(data, '$.eposta')) AS ep FROM docs WHERE coll = 'kullanicilar' AND deleted = 0"
  ).all()).results;
  const mailOf = new Map(users.map(r => [r.un, r.ep]));
  const bySor = new Map();
  for (const r of results) {
    const d = parse(r.data);
    if (!d || !d.termin || !mailOf.get(d.sorumlu)) continue;
    if (!bySor.has(d.sorumlu)) bySor.set(d.sorumlu, []);
    bySor.get(d.sorumlu).push({ no: d.no, baslik: d.baslik, termin: d.termin, gecikti: d.termin < today });
  }
  for (const [sor, list] of bySor) {
    list.sort((a, b) => a.termin.localeCompare(b.termin));
    const g = list.filter(x => x.gecikti).length, y = list.length - g;
    const konu = 'DÖF hatırlatma: ' + [g && `${g} DÖF'ün termini geçti`, y && `${y} DÖF'ün termini ${REMINDER_DAYS} gün içinde`].filter(Boolean).join(', ');
    await queueMail(env, { alici: mailOf.get(sor), konu, gonderen: 'sistem', tur: 'dof-hatirlatma', ozet: list });
  }
}

async function readBody(req) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_BODY_BYTES) throw new HttpError(413, 'Kayıt çok büyük. Ekleri küçültüp tekrar deneyin.');
  const t = await req.text();
  if (enc.encode(t).length > MAX_BODY_BYTES) throw new HttpError(413, 'Kayıt çok büyük. Ekleri küçültüp tekrar deneyin.');
  return t ? parse(t) : {};
}

async function handleApi(req, env, url) {
  if (!env.DB) return fail(503, 'Veritabanı bağlantısı (DB) tanımlı değil.');
  if (!isDev(env, url) && !isConfigured(env)) return fail(503, 'Sunucu yapılandırması eksik: TEAM_DOMAIN ve POLICY_AUD değişkenlerini girin.');
  if (req.method !== 'GET') {
    const origin = req.headers.get('Origin');
    if (origin && origin !== url.origin) return fail(403, 'Geçersiz istek kaynağı.');
  }
  const email = await identify(req, env, url);
  if (!email) return fail(401, 'Oturum doğrulanamadı. Sayfayı yenileyin.');
  const u = await loadUser(env, email);
  if (!u) return fail(403, 'Hesabınız portal kullanıcı listesinde yok. Erişim için İSG departmanına başvurun.', { email });

  const p = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); // ['api', ...]
  if (p[1] === 'me' && req.method === 'GET') return json({ user: u });
  if (p[1] === 'data' && req.method === 'GET') return getData(env, u, url);
  if (p[1] === 'doc' && p.length === 4) {
    const [, , coll, id] = p;
    if (!DOC_COLLS.has(coll)) return fail(404, 'Bilinmeyen modül.');
    if (!/^[\p{L}\p{N}_.:@-]{1,120}$/u.test(id)) return fail(400, 'Geçersiz kayıt kimliği.');
    if (req.method === 'PUT') return putDoc(env, u, coll, id, await readBody(req));
    if (req.method === 'DELETE') return deleteDoc(env, u, coll, id, await readBody(req));
  }
  if (p[1] === 'log' && p.length === 3 && req.method === 'POST') {
    if (!LOG_KINDS.has(p[2])) return fail(404, 'Bilinmeyen kayıt türü.');
    return postLog(env, u, p[2], await readBody(req));
  }
  return fail(404, 'Bulunamadı.');
}

function infoPage(status, title, text) {
  const html = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:18vh auto;padding:0 20px;color:#1d1d1f"><h2>${title}</h2><p>${text}</p></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...SEC_HEADERS } });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(req, env, url);
      if (env.ASSETS) return env.ASSETS.fetch(req);          // proje kurulumu
      if (!INDEX_HTML) return infoPage(500, 'Arayüz bulunamadı', 'Worker kodunda portal arayüzü yok.');
      if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });
      if (url.pathname === '/favicon.ico') return new Response(null, { status: 204 });
      if (!isDev(env, url)) {
        if (!isConfigured(env)) return infoPage(503, 'Kurulum tamamlanmadı', 'Worker ayarlarında TEAM_DOMAIN ve POLICY_AUD değişkenlerini girin.');
        if (!(await identify(req, env, url))) return infoPage(401, 'Oturum doğrulanamadı', 'Portala yalnızca kurumsal Microsoft hesabıyla, Cloudflare Access üzerinden girilebilir. Sayfayı yenileyin.');
      }
      return new Response(req.method === 'HEAD' ? null : INDEX_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ...SEC_HEADERS },
      });
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      console.error(e && e.stack || e);
      return fail(500, 'Sunucu hatası. Birkaç dakika sonra tekrar deneyin.');
    }
  },

  // Zamanlanmış görev (wrangler.jsonc > triggers.crons): e-posta kuyruğu ve DÖF hatırlatmaları
  async scheduled(event, env) {
    if (!env.DB) return;
    if (!mailReady(env)) { console.warn('E-posta gönderimi kapalı: Graph (GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, MAIL_FROM) ya da RESEND_API_KEY tanımlı değil.'); return; }
    // Hatırlatma görevi yalnızca kuyruğa yazar; aynı dakikada çalışan gönderim göreviyle çift gönderim olmasın
    if (event.cron === REMINDER_CRON) return queueDofReminders(env);
    await sendMailQueue(env);
  },
};
