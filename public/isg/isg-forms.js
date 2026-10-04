/*!
 * İSG Dijital Formlar — form motoru
 * Statik sitelerde (GitHub Pages vb.) çalışır. Bağımlılık: pdfmake (PDF üretimi için).
 * Form tanımları forms/*.js dosyalarında ISG.register({...}) ile kaydedilir.
 */
(function (global) {
  'use strict';

  const ISG = (global.ISG = global.ISG || {});
  ISG.forms = ISG.forms || {};
  ISG.config = Object.assign(
    { orgName: 'Kuruluş adı', storagePrefix: 'isg:', expiryWarnDays: 30, archiveLimit: 60 },
    ISG.config || {}
  );
  ISG.register = function (schema) { ISG.forms[schema.id] = schema; };

  /* ---------- sabitler ---------- */
  const CHECK_STATES = [
    { v: 'ok', label: 'Uygun', pdf: 'U' },
    { v: 'nok', label: 'Uygun değil', pdf: 'X' },
    { v: 'na', label: 'U/D', pdf: '–' }
  ];
  const DEFAULT_SCALE = [
    { v: '0', label: 'Acil önlem', pdf: '0', bad: true, level: 'acil' },
    { v: '1', label: 'Önlem gerekli', pdf: '1', bad: true, level: 'önlem' },
    { v: '2', label: 'Uygun', pdf: '2' },
    { v: 'na', label: 'U/D', pdf: 'U/D' }
  ];
  // İSG.P1.T1 Üç Aylık Renk Kodlaması Talimatı
  const QUARTER_COLORS = [
    { name: 'Sarı', months: 'Ocak–Mart', hex: '#F2C200', text: '#1E2A33' },
    { name: 'Mavi', months: 'Nisan–Haziran', hex: '#1E6FD9', text: '#FFFFFF' },
    { name: 'Kırmızı', months: 'Temmuz–Eylül', hex: '#D62828', text: '#FFFFFF' },
    { name: 'Yeşil', months: 'Ekim–Aralık', hex: '#2A9D4B', text: '#FFFFFF' }
  ];
  const PDF_COLORS = { ink: '#1E2A33', line: '#9AA5B1', soft: '#EEF1F4', bad: '#FBE3E1', warn: '#FFF4CC', muted: '#5B6873' };

  /* ---------- yardımcılar ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const isoMonth = () => isoToday().slice(0, 7);
  const fmtDate = (s) => {
    if (!s) return '';
    if (/^\d{4}-\d{2}$/.test(s)) { const [y, m] = s.split('-'); return `${m}/${y}`; }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; }
    return String(s);
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const rand = (n) => Math.random().toString(36).slice(2, 2 + n).toUpperCase();

  ISG.fmtDate = fmtDate;
  ISG.quarterColor = function (dateStr) {
    if (!dateStr) return null;
    const m = Number(String(dateStr).slice(5, 7));
    if (!m) return null;
    return QUARTER_COLORS[Math.floor((m - 1) / 3)];
  };
  ISG.expiryStatus = function (dateStr, warnDays) {
    if (!dateStr) return null;
    const ds = /^\d{4}-\d{2}$/.test(dateStr) ? dateStr + '-01' : dateStr;
    const target = new Date(ds + 'T00:00:00');
    if (isNaN(target)) return null;
    const diff = Math.round((target - new Date(isoToday() + 'T00:00:00')) / 86400000);
    const w = warnDays == null ? ISG.config.expiryWarnDays : warnDays;
    if (diff < 0) return { level: 'expired', text: 'Süresi geçmiş' };
    if (diff <= w) return { level: 'soon', text: `${diff} gün kaldı` };
    return { level: 'ok', text: 'Geçerli' };
  };

  /* ---------- veri modeli ---------- */
  function blankRow(schema) {
    const r = { checks: {}, note: '' };
    (schema.table.columns || []).forEach((c) => { r[c.key] = ''; });
    return r;
  }
  function headerDefault(f) {
    if (f.default === 'today') return isoToday();
    if (f.default === 'thisMonth') return isoMonth();
    if (f.default === 'org') return ISG.config.orgName;
    return f.default || '';
  }
  function blankData(schema, rowCount) {
    const kind = schema.kind || 'table';
    const header = {};
    (schema.header || []).forEach((f) => { if (!f.compute) header[f.key] = headerDefault(f); });
    const n = rowCount != null ? rowCount : (schema.table && schema.table.initialRows) || 1;
    return {
      meta: { formId: schema.id, schemaVersion: schema.version || 1, recordNo: null, createdAt: new Date().toISOString(), updatedAt: null, completedAt: null },
      header,
      rows: kind === 'table' ? Array.from({ length: n }, () => blankRow(schema)) : [],
      answers: {},
      notes: '',
      signers: (schema.signatures || []).map((s) => ({ role: s.role, name: '', title: s.title || '', date: '' }))
    };
  }
  function normalize(data, schema) {
    data.header = data.header || {};
    data.rows = data.rows || [];
    data.answers = data.answers || {};
    data.notes = data.notes || '';
    data.rows.forEach((r) => { r.checks = r.checks || {}; });
    const sigs = schema.signatures || [];
    data.signers = sigs.map((s, i) => Object.assign({ role: s.role, name: '', title: s.title || '', date: '' }, (data.signers || [])[i] || {}, { role: s.role }));
    return data;
  }
  ISG.blankData = blankData;

  function rowRef(schema, r, i) {
    const keys = schema.table.refKeys || (schema.table.identityKeys || []).slice(0, 2);
    const parts = keys.map((k) => r[k]).filter(Boolean);
    return `#${i + 1}${parts.length ? ' · ' + parts.join(' / ') : ''}`;
  }
  function computeHeader(f, data) {
    if (f.compute === 'quarterColor') return ISG.quarterColor(data.header[f.source]);
    return null;
  }

  /* ---------- bulgular & doğrulama ---------- */
  ISG.findings = function (schema, data) {
    const out = [];
    if ((schema.kind || 'table') === 'checklist') {
      const scale = schema.scale || DEFAULT_SCALE;
      schema.sections.forEach((sec) => sec.items.forEach((it) => {
        const a = data.answers[it.id];
        if (!a) return;
        const s = scale.find((x) => x.v === a.v);
        if (s && s.bad) out.push({ ref: `${sec.title} / ${it.no}`, text: it.text, level: s.level || 'uygunsuz', note: a.note || '' });
      }));
      return out;
    }
    const t = schema.table;
    data.rows.forEach((r, i) => {
      const ref = rowRef(schema, r, i);
      (t.checks || []).forEach((c) => {
        if (r.checks[c.id] === 'nok') out.push({ ref, text: c.label, level: 'uygunsuz', note: r.note || '' });
      });
      (t.columns || []).forEach((c) => {
        if (c.expiry && r[c.key]) {
          const st = ISG.expiryStatus(r[c.key]);
          if (st && st.level !== 'ok') out.push({ ref, text: `${c.label}: ${fmtDate(r[c.key])} (${st.text})`, level: st.level === 'expired' ? 'uygunsuz' : 'uyarı', note: '' });
        }
        if (c.badValues && c.badValues.includes(r[c.key])) out.push({ ref, text: `${c.label}: ${r[c.key]}`, level: 'uygunsuz', note: r.note || '' });
      });
    });
    (schema.header || []).forEach((f) => {
      if (f.badValues && f.badValues.includes(data.header[f.key])) out.unshift({ ref: 'Genel', text: `${f.label}: ${data.header[f.key]}`, level: 'uygunsuz', note: '' });
    });
    return out;
  };

  ISG.validate = function (schema, data) {
    const errors = [];
    const warnings = [];
    (schema.header || []).forEach((f) => { if (f.required && !f.compute && !data.header[f.key]) errors.push(`“${f.label}” alanı boş.`); });
    if ((schema.kind || 'table') === 'checklist') {
      let open = 0;
      schema.sections.forEach((s) => s.items.forEach((it) => { if (!data.answers[it.id] || !data.answers[it.id].v) open++; }));
      if (open) warnings.push(`${open} madde yanıtlanmadı.`);
    } else {
      const t = schema.table;
      const filled = data.rows.filter((r) => (t.columns || []).some((c) => r[c.key]) || Object.values(r.checks).some(Boolean));
      if (!filled.length) errors.push('En az bir satır doldurulmalı.');
      data.rows.forEach((r, i) => {
        (t.columns || []).forEach((c) => { if (c.required && !r[c.key] && filled.includes(r)) errors.push(`Satır ${i + 1}: “${c.label}” boş.`); });
        const open = (t.checks || []).filter((c) => !r.checks[c.id]).length;
        if (open && filled.includes(r)) warnings.push(`Satır ${i + 1}: ${open} kontrol maddesi işaretlenmedi.`);
      });
    }
    if (data.signers[0] && !data.signers[0].name) warnings.push(`“${data.signers[0].role}” adı girilmedi; PDF’te elle doldurulabilir.`);
    return { errors, warnings };
  };

  /* ---------- PDF (pdfmake docDefinition) ---------- */
  const gridLayout = {
    hLineWidth: () => 0.5, vLineWidth: () => 0.5,
    hLineColor: () => PDF_COLORS.line, vLineColor: () => PDF_COLORS.line,
    paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 3, paddingBottom: () => 3
  };

  function headerCell(f, data) {
    if (f.compute) {
      const c = computeHeader(f, data);
      return c ? { text: `${c.name} (${c.months})`, fillColor: c.hex, color: c.text, bold: true } : { text: '' };
    }
    const v = data.header[f.key];
    return { text: f.type === 'date' || f.type === 'month' ? fmtDate(v) : v || '' };
  }
  function bodyCell(c, r) {
    const v = r[c.key];
    const cell = { text: c.type === 'date' || c.type === 'month' ? fmtDate(v) : v == null ? '' : String(v) };
    if (c.expiry && v) {
      const st = ISG.expiryStatus(v);
      if (st && st.level === 'expired') cell.fillColor = PDF_COLORS.bad;
      else if (st && st.level === 'soon') cell.fillColor = PDF_COLORS.warn;
    }
    if (c.badValues && c.badValues.includes(v)) cell.fillColor = PDF_COLORS.bad;
    if (c.type === 'number') cell.alignment = 'right';
    return cell;
  }

  ISG.buildPdf = function (schema, data, opts) {
    opts = opts || {};
    const cfg = ISG.config;
    const kind = schema.kind || 'table';
    const blank = !!opts.blank;
    const pdfOpt = schema.pdf || {};
    const nCols = kind === 'table' ? (schema.table.columns || []).length + (schema.table.checks || []).length : 0;
    const landscape = pdfOpt.orientation ? pdfOpt.orientation === 'landscape' : nCols > 8;
    const pageW = landscape ? 841.89 : 595.28;
    const M = 28;
    const content = [];

    // Genel bilgiler
    const hf = schema.header || [];
    if (hf.length) {
      const body = [];
      for (let i = 0; i < hf.length; i += 2) {
        const a = hf[i];
        const b = hf[i + 1];
        body.push([
          { text: a.label, style: 'k' }, blank && !a.compute ? '' : headerCell(a, data),
          b ? { text: b.label, style: 'k' } : '', b ? (blank && !b.compute ? '' : headerCell(b, data)) : ''
        ]);
      }
      content.push({ table: { widths: ['auto', '*', 'auto', '*'], body }, layout: gridLayout, margin: [0, 0, 0, 10] });
    }

    if (kind === 'table') {
      const t = schema.table;
      const cols = t.columns || [];
      const checks = t.checks || [];
      const hasNote = t.rowNote !== false;
      const head = [{ text: 'No', style: 'th', alignment: 'center' }]
        .concat(cols.map((c) => ({ text: c.short || c.label, style: 'th' })))
        .concat(checks.map((c, i) => ({ text: 'K' + (i + 1), style: 'th', alignment: 'center' })))
        .concat(hasNote ? [{ text: 'Açıklama', style: 'th' }] : []);
      const rows = blank
        ? Array.from({ length: pdfOpt.blankRows || 15 }, () => blankRow(schema))
        : data.rows;
      const body = [head].concat(rows.map((r, i) => [{ text: String(i + 1), alignment: 'center' }]
        .concat(cols.map((c) => bodyCell(c, r)))
        .concat(checks.map((c) => {
          const v = r.checks[c.id] || '';
          const s = CHECK_STATES.find((x) => x.v === v);
          return { text: s ? s.pdf : '', alignment: 'center', bold: v === 'nok', fillColor: v === 'nok' ? PDF_COLORS.bad : undefined };
        }))
        .concat(hasNote ? [r.note || ''] : [])));
      const widths = ['auto']
        .concat(cols.map((c) => c.pdfWidth || (!hasNote && c.grow ? '*' : 'auto')))
        .concat(checks.map(() => 18))
        .concat(hasNote ? ['*'] : []);
      content.push({ text: t.title || 'Kayıtlar', style: 'h2' });
      content.push({ table: { headerRows: 1, dontBreakRows: true, widths, body }, layout: gridLayout, fontSize: 7.5 });
      if (checks.length) {
        const half = Math.ceil(checks.length / 2);
        const leg = (arr, off) => ({ stack: arr.map((c, i) => ({ text: [{ text: `K${i + off + 1}: `, bold: true }, c.label], margin: [0, 0, 0, 1.5] })) });
        content.push({ columns: [leg(checks.slice(0, half), 0), leg(checks.slice(half), half)], columnGap: 16, fontSize: 7, margin: [0, 6, 0, 2], color: PDF_COLORS.muted });
        content.push({ text: 'U: Uygun   X: Uygun değil   –: Uygulanamaz', fontSize: 7, color: PDF_COLORS.muted, margin: [0, 0, 0, 8] });
      }
    } else {
      const scale = schema.scale || DEFAULT_SCALE;
      schema.sections.forEach((sec) => {
        content.push({ text: sec.title, style: 'h2' });
        const head = [{ text: 'No', style: 'th' }, { text: 'Konu', style: 'th' }]
          .concat(scale.map((s) => ({ text: s.pdf, style: 'th', alignment: 'center' })))
          .concat([{ text: 'Not', style: 'th' }]);
        const body = [head].concat(sec.items.map((it) => {
          const a = blank ? null : data.answers[it.id];
          return [{ text: String(it.no) }, { text: [it.text].concat(it.sub ? ['\n' + it.sub.join('\n')] : []) }]
            .concat(scale.map((s) => ({ text: a && a.v === s.v ? 'X' : '', alignment: 'center', bold: true, fillColor: a && a.v === s.v && s.bad ? PDF_COLORS.bad : undefined })))
            .concat([{ text: (a && a.note) || '' }]);
        }));
        content.push({ table: { headerRows: 1, dontBreakRows: true, widths: [16, '*'].concat(scale.map(() => 26)).concat([110]), body }, layout: gridLayout, fontSize: 7.5, margin: [0, 0, 0, 6] });
      });
      content.push({ text: scale.map((s) => `${s.pdf}: ${s.label}`).join('   '), fontSize: 7, color: PDF_COLORS.muted, margin: [0, 0, 0, 8] });
    }

    // Bulgular
    if (!blank) {
      const f = ISG.findings(schema, data);
      content.push({ text: schema.findingsTitle || 'Önemli eksiklikler ve uygunsuzluklar', style: 'h2' });
      if (f.length) {
        content.push({
          table: { headerRows: 1, widths: ['auto', '*', 'auto'], body: [[{ text: 'Yer / kayıt', style: 'th' }, { text: 'Bulgu', style: 'th' }, { text: 'Düzey', style: 'th' }]]
            .concat(f.map((x) => [x.ref, x.note ? { text: [x.text, { text: `\nNot: ${x.note}`, color: PDF_COLORS.muted }] } : x.text, { text: x.level, fillColor: x.level === 'uyarı' ? PDF_COLORS.warn : PDF_COLORS.bad }])) },
          layout: gridLayout, fontSize: 7.5, margin: [0, 0, 0, 8]
        });
      } else {
        content.push({ text: 'Uygunsuzluk tespit edilmedi.', margin: [0, 0, 0, 8] });
      }
    }
    // Notlar
    if (blank || data.notes) {
      content.push({ text: 'Notlar', style: 'h2' });
      content.push({ table: { widths: ['*'], heights: blank ? [60] : undefined, body: [[blank ? '' : data.notes]] }, layout: gridLayout, margin: [0, 0, 0, 8] });
    }
    // Taahhüt metni
    const sigBlock = [];
    if (schema.statement) {
      sigBlock.push({ table: { widths: ['*'], body: [[{ text: schema.statement, fontSize: 8, alignment: 'justify' }]] }, layout: gridLayout, margin: [0, 4, 0, 8] });
    }
    // İmza alanları — ıslak imza için boş bırakılır
    const signers = blank ? (schema.signatures || []).map((s) => ({ role: s.role, name: '', title: s.title || '', date: '' })) : data.signers;
    if (signers.length) {
      const dots = '........./........./..............';
      const cells = signers.map((s) => ({
        stack: [
          { text: s.role, bold: true, margin: [0, 0, 0, 4] },
          { text: [{ text: 'Adı Soyadı: ', color: PDF_COLORS.muted }, s.name || ''] },
          { text: [{ text: 'Görevi: ', color: PDF_COLORS.muted }, s.title || ''], margin: [0, 2, 0, 0] },
          { text: [{ text: 'Tarih: ', color: PDF_COLORS.muted }, s.date ? fmtDate(s.date) : dots], margin: [0, 2, 0, 0] },
          { text: 'İmza:', color: PDF_COLORS.muted, margin: [0, 6, 0, 0] },
          { canvas: [{ type: 'line', x1: 0, y1: 30, x2: 140, y2: 30, lineWidth: 0.5, lineColor: PDF_COLORS.line }] }
        ]
      }));
      const recordNo = data.meta && data.meta.recordNo;
      const row = cells.slice();
      const widths = cells.map(() => '*');
      if (recordNo && !blank) {
        row.push({ stack: [{ qr: `${schema.code}|${recordNo}`, fit: 64, alignment: 'center' }, { text: recordNo, fontSize: 6, alignment: 'center', margin: [0, 3, 0, 0] }] });
        widths.push(78);
      }
      sigBlock.push({ table: { widths, body: [row] }, layout: gridLayout });
    }
    if (sigBlock.length) content.push({ stack: sigBlock, unbreakable: true, margin: [0, 6, 0, 0] });

    const dd = {
      pageSize: 'A4',
      pageOrientation: landscape ? 'landscape' : 'portrait',
      pageMargins: [M, 66, M, 40],
      info: { title: `${schema.code} ${schema.title}`, author: cfg.orgName, subject: (data.meta && data.meta.recordNo) || 'Taslak' },
      header: (page, count) => ({
        margin: [M, 18, M, 0],
        stack: [
          {
            columns: [
              { width: '*', stack: [{ text: cfg.orgName, fontSize: 8, color: PDF_COLORS.muted }, { text: schema.title, fontSize: 12, bold: true, margin: [0, 1, 0, 0] }, data.header && data.header.tesis && !blank ? { text: data.header.tesis, fontSize: 8 } : { text: '' }] },
              { width: 'auto', stack: [{ text: schema.code, bold: true, alignment: 'right', fontSize: 9 }, { text: schema.rev || '', alignment: 'right', fontSize: 7, color: PDF_COLORS.muted }, { text: `Sayfa ${page} / ${count}`, alignment: 'right', fontSize: 7, color: PDF_COLORS.muted }] }
            ]
          },
          { canvas: [{ type: 'line', x1: 0, y1: 4, x2: pageW - 2 * M, y2: 4, lineWidth: 1.2, lineColor: PDF_COLORS.ink }] }
        ]
      }),
      footer: () => ({
        margin: [M, 12, M, 0],
        columns: [
          { text: blank ? 'Boş form (elle doldurulacak)' : `Kayıt no: ${(data.meta && data.meta.recordNo) || 'TASLAK'}`, fontSize: 7, color: PDF_COLORS.muted },
          { text: 'Dijital kayıttan üretilmiştir. Islak imza ile geçerlidir.', alignment: 'center', fontSize: 7, color: PDF_COLORS.muted },
          { text: `Üretim: ${new Date().toLocaleString('tr-TR')}`, alignment: 'right', fontSize: 7, color: PDF_COLORS.muted }
        ]
      }),
      content,
      styles: {
        h2: { fontSize: 9.5, bold: true, margin: [0, 6, 0, 4], color: PDF_COLORS.ink },
        th: { bold: true, fillColor: PDF_COLORS.soft, fontSize: 7.5 },
        k: { bold: true, color: PDF_COLORS.muted }
      },
      defaultStyle: { fontSize: 8, color: PDF_COLORS.ink, lineHeight: 1.1 }
    };
    if (!blank && !(data.meta && data.meta.recordNo)) dd.watermark = { text: 'TASLAK', opacity: 0.07, bold: true };
    return dd;
  };

  // QR etiket sayfası (ekipman üzerine yapıştırmak için)
  ISG.buildLabelPdf = function (schema, data, baseUrl) {
    const q = schema.table.qr;
    const items = data.rows.filter((r) => r[q.key]);
    const cells = items.map((r) => ({
      stack: [
        { qr: ISG.config.qrUrl ? ISG.config.qrUrl(schema, r[q.key]) : `${baseUrl}?f=${encodeURIComponent(schema.id)}&kod=${encodeURIComponent(r[q.key])}`, fit: 92, alignment: 'center' },
        { text: r[q.key], bold: true, fontSize: 11, alignment: 'center', margin: [0, 4, 0, 0] },
        { text: (q.subKeys || []).map((k) => r[k]).filter(Boolean).join(' · '), fontSize: 7, alignment: 'center' },
        { text: `${schema.code} ${schema.short || schema.title}`, fontSize: 6, color: PDF_COLORS.muted, alignment: 'center', margin: [0, 2, 0, 0] }
      ],
      margin: [0, 8, 0, 8]
    }));
    const body = [];
    for (let i = 0; i < cells.length; i += 3) body.push([cells[i], cells[i + 1] || '', cells[i + 2] || '']);
    return {
      pageSize: 'A4', pageMargins: [28, 28, 28, 28],
      content: body.length ? [{ table: { widths: ['*', '*', '*'], dontBreakRows: true, body }, layout: { hLineWidth: () => 0.4, vLineWidth: () => 0.4, hLineColor: () => '#BBBBBB', vLineColor: () => '#BBBBBB', hLineStyle: () => ({ dash: { length: 3 } }), vLineStyle: () => ({ dash: { length: 3 } }) } }] : [{ text: 'Etiket için kod girilmiş satır yok.' }],
      defaultStyle: { color: PDF_COLORS.ink }
    };
  };

  /* ---------- depolama ---------- */
  const store = {
    key: (id, k) => `${ISG.config.storagePrefix}${id}:${k}`,
    get(id, k, fb) { try { const v = global.localStorage.getItem(this.key(id, k)); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
    set(id, k, v) { try { global.localStorage.setItem(this.key(id, k), JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(id, k) { try { global.localStorage.removeItem(this.key(id, k)); } catch (e) { /* yok */ } }
  };
  ISG.store = store;

  // Yeniden çizimde (rerender) kaybolmaması gereken durum
  const archMem = {};      // formId -> tamamlanmış kayıtlar (sunucu modunda)
  let pendingMsg = null;   // yeni çizimde gösterilecek ileti

  /* Kayıt arka ucu (isteğe bağlı). Portal burada sunucu API'sini tanımlar:
     ISG.backend = { list(formId) -> [veri], save(formId, veri) -> veri (kayıt no sunucuda atanır),
                     remove(formId, no), canRemove: bool }.
     Tanımlı değilse tamamlanan kayıtlar eskisi gibi bu cihazda (localStorage) tutulur. */

  /* ---------- DOM ---------- */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    let value;
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'value') value = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (let i = 2; i < arguments.length; i++) {
      [].concat(arguments[i]).forEach((c) => { if (c == null || c === false) return; el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    }
    if (value !== undefined) el.value = value;
    return el;
  }
  let fid = 0;
  function fieldInput(f, value, onChange) {
    const id = 'isgf' + ++fid;
    let input;
    if (f.type === 'select') {
      input = h('select', { id }, h('option', { value: '' }, 'Seçin'), (f.options || []).map((o) => h('option', { value: o }, o)));
      input.value = value || '';
    } else if (f.type === 'textarea') {
      input = h('textarea', { id, rows: 3 });
      input.value = value || '';
    } else {
      const type = { number: 'number', date: 'date', month: 'month' }[f.type] || 'text';
      input = h('input', { id, type, inputmode: f.type === 'number' ? 'decimal' : null, step: f.type === 'number' ? 'any' : null, placeholder: f.placeholder || null, autocomplete: 'off' });
      input.value = value || '';
    }
    if (f.required) input.required = true;
    const badge = h('span', { class: 'isg-badge' });
    const upd = () => {
      let st = null;
      if (f.expiry) st = ISG.expiryStatus(input.value);
      if (f.badValues && f.badValues.includes(input.value)) st = { level: 'expired', text: 'Uygunsuz' };
      badge.textContent = st && st.level !== 'ok' ? st.text : '';
      badge.dataset.level = st ? st.level : '';
    };
    const fire = () => { onChange(input.value); upd(); };
    input.addEventListener('input', fire);
    input.addEventListener('change', fire);
    upd();
    return h('div', { class: 'isg-field' + (f.wide ? ' is-wide' : '') },
      h('label', { for: id, class: 'isg-field-label' }, f.label, f.required ? h('span', { class: 'isg-req', title: 'Zorunlu' }, ' *') : null),
      input, badge);
  }
  function segmented(label, value, states, onChange) {
    const g = h('div', { class: 'isg-seg', role: 'radiogroup', 'aria-label': label });
    g.dataset.value = value || '';
    states.forEach((s) => {
      const b = h('button', { type: 'button', class: 'isg-seg-btn', role: 'radio', 'data-v': s.v, 'aria-checked': String(value === s.v) }, s.label);
      b.addEventListener('click', () => {
        const nv = g.dataset.value === s.v ? '' : s.v;
        g.dataset.value = nv;
        Array.from(g.children).forEach((c) => c.setAttribute('aria-checked', String(c.dataset.v === nv)));
        onChange(nv);
      });
      g.append(b);
    });
    return g;
  }
  function downloadBlob(blob, name) {
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function fileSafe(s) { return String(s).replace(/[^\w.\-çğıöşüÇĞİÖŞÜ]+/g, '_'); }

  /* ---------- ana arayüz ---------- */
  ISG.mount = function (root, formId) {
    const schema = ISG.forms[formId];
    if (!schema) { root.textContent = 'Form tanımı bulunamadı: ' + formId; return; }
    const kind = schema.kind || 'table';
    let data = normalize(store.get(formId, 'draft', null) || blankData(schema), schema);
    let saveTimer;
    const status = h('span', { class: 'isg-status', 'aria-live': 'polite' });
    const findingsBox = h('div', { class: 'isg-findings', 'aria-live': 'polite' });
    const computedEls = [];

    function save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        data.meta.updatedAt = new Date().toISOString();
        const ok = store.set(formId, 'draft', data);
        status.textContent = ok ? `Taslak kaydedildi ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : 'Taslak bu tarayıcıda saklanamıyor; JSON olarak dışa aktarın.';
        refreshFindings();
      }, 250);
    }
    function refreshComputed() {
      computedEls.forEach(({ f, el }) => {
        const c = computeHeader(f, data);
        el.textContent = c ? `${c.name} · ${c.months}` : 'Tarih seçilince belirlenir';
        el.style.background = c ? c.hex : '';
        el.style.color = c ? c.text : '';
        el.classList.toggle('is-empty', !c);
      });
    }
    function refreshFindings() {
      const f = ISG.findings(schema, data);
      findingsBox.replaceChildren(
        f.length
          ? h('ul', { class: 'isg-findings-list' }, f.map((x) => h('li', { 'data-level': x.level }, h('strong', null, x.ref), ' ', x.text, x.note ? h('span', { class: 'isg-muted' }, ` — ${x.note}`) : null)))
          : h('p', { class: 'isg-muted' }, 'Şu ana kadar uygunsuzluk işaretlenmedi.')
      );
    }

    /* plaka */
    const plate = h('header', { class: 'isg-plate' },
      h('div', { class: 'isg-plate-code' }, schema.code),
      h('h1', { class: 'isg-plate-title' }, schema.title),
      schema.period ? h('p', { class: 'isg-plate-meta' }, schema.period) : null,
      schema.rev ? h('p', { class: 'isg-plate-meta' }, 'Revizyon ' + schema.rev) : null,
      schema.intro ? h('p', { class: 'isg-plate-intro' }, schema.intro) : null);

    /* genel bilgiler */
    const headerGrid = h('div', { class: 'isg-grid' }, (schema.header || []).map((f) => {
      if (f.compute) {
        const chip = h('div', { class: 'isg-chip' });
        computedEls.push({ f, el: chip });
        return h('div', { class: 'isg-field' }, h('span', { class: 'isg-field-label' }, f.label), chip, f.help ? h('span', { class: 'isg-help' }, f.help) : null);
      }
      return fieldInput(f, data.header[f.key], (v) => { data.header[f.key] = v; refreshComputed(); save(); });
    }));

    /* gövde */
    let bodyEl;
    let rowsEl;
    function rowCard(r, i) {
      const t = schema.table;
      const ref = h('span', { class: 'isg-row-ref' }, rowRef(schema, r, i));
      const checksWrap = h('div', { class: 'isg-checks' });
      function drawChecks() {
        checksWrap.replaceChildren(...(t.checks || []).map((c, ci) => h('div', { class: 'isg-check' },
          h('span', { class: 'isg-check-label' }, h('span', { class: 'isg-check-no' }, 'K' + (ci + 1)), c.label),
          segmented(c.label, r.checks[c.id], CHECK_STATES, (v) => { r.checks[c.id] = v; save(); }))));
      }
      drawChecks();
      const card = h('article', { class: 'isg-row', 'data-index': i },
        h('div', { class: 'isg-row-head' },
          h('span', { class: 'isg-row-no' }, String(i + 1)), ref,
          h('div', { class: 'isg-row-actions' },
            (t.checks || []).length ? h('button', { type: 'button', class: 'isg-btn is-quiet', onclick: () => { t.checks.forEach((c) => { r.checks[c.id] = 'ok'; }); drawChecks(); save(); } }, 'Tümünü uygun işaretle') : null,
            h('button', { type: 'button', class: 'isg-btn is-quiet is-danger', onclick: () => {
              const has = (t.columns || []).some((c) => r[c.key]) || Object.values(r.checks).some(Boolean);
              if (has && !global.confirm(`Satır ${i + 1} silinsin mi?`)) return;
              data.rows.splice(i, 1); if (!data.rows.length) data.rows.push(blankRow(schema)); renderRows(); save();
            } }, 'Satırı sil'))),
        h('div', { class: 'isg-grid' }, (t.columns || []).map((c) => fieldInput(c, r[c.key], (v) => { r[c.key] = v; ref.textContent = rowRef(schema, r, i); save(); }))),
        checksWrap,
        t.rowNote !== false ? fieldInput({ label: 'Açıklama', type: 'text', wide: true }, r.note, (v) => { r.note = v; save(); }) : null);
      return card;
    }
    function renderRows() { rowsEl.replaceChildren(...data.rows.map(rowCard)); }

    if (kind === 'table') {
      rowsEl = h('div', { class: 'isg-rows' });
      renderRows();
      bodyEl = h('section', { class: 'isg-section' },
        h('h2', null, schema.table.title || 'Kayıtlar'),
        schema.table.help ? h('p', { class: 'isg-help' }, schema.table.help) : null,
        rowsEl,
        h('button', { type: 'button', class: 'isg-btn', onclick: () => {
          data.rows.push(blankRow(schema)); renderRows(); save();
          const last = rowsEl.lastElementChild; last.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const inp = last.querySelector('input,select'); if (inp) inp.focus({ preventScroll: true });
        } }, schema.table.addLabel || 'Satır ekle'));
    } else {
      const scale = schema.scale || DEFAULT_SCALE;
      bodyEl = h('div', null, schema.sections.map((sec) => h('section', { class: 'isg-section' },
        h('h2', null, sec.title),
        sec.items.map((it) => {
          const a = data.answers[it.id] || (data.answers[it.id] = { v: '', note: '' });
          return h('div', { class: 'isg-q' },
            h('div', { class: 'isg-q-text' }, h('span', { class: 'isg-check-no' }, String(it.no)), h('div', null, it.text, it.sub ? h('ul', { class: 'isg-sub' }, it.sub.map((s) => h('li', null, s))) : null)),
            segmented(it.text, a.v, scale, (v) => { a.v = v; save(); }),
            fieldInput({ label: 'Not', type: 'text', wide: true }, a.note, (v) => { a.note = v; save(); }));
        }))));
    }

    /* notlar, imzalar */
    const notesSec = h('section', { class: 'isg-section' },
      h('h2', null, 'Bulgular'),
      h('p', { class: 'isg-help' }, 'İşaretlediğiniz uygunsuzluklar ve süresi yaklaşan tarihler burada toplanır; PDF’e otomatik aktarılır.'),
      findingsBox,
      fieldInput({ label: 'Ek notlar', type: 'textarea', wide: true }, data.notes, (v) => { data.notes = v; save(); }));

    const sigSec = (schema.signatures || []).length ? h('section', { class: 'isg-section' },
      h('h2', null, 'İmza bilgileri'),
      h('p', { class: 'isg-help' }, 'İmzalar PDF çıktısında boş bırakılır; çıktı alınıp ıslak imza atılır.'),
      schema.statement ? h('blockquote', { class: 'isg-statement' }, schema.statement) : null,
      h('div', { class: 'isg-sigs' }, data.signers.map((s) => h('div', { class: 'isg-sig' },
        h('h3', null, s.role),
        fieldInput({ label: 'Adı soyadı', type: 'text' }, s.name, (v) => { s.name = v; save(); }),
        fieldInput({ label: 'Görevi', type: 'text' }, s.title, (v) => { s.title = v; save(); }),
        fieldInput({ label: 'Tarih (boş bırakılırsa elle yazılır)', type: 'date' }, s.date, (v) => { s.date = v; save(); }))))) : null;

    /* işlemler */
    const msg = h('div', { class: 'isg-msg', role: 'status' });
    function say(text, level) { msg.textContent = text; msg.dataset.level = level || ''; if (text) msg.scrollIntoView({ block: 'nearest' }); }
    function pdfReady() {
      if (!global.pdfMake) { say('PDF kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edip sayfayı yenileyin.', 'error'); return false; }
      return true;
    }
    function pdfName(d) { return fileSafe(`${schema.code}_${(d.meta && d.meta.recordNo) || 'taslak'}.pdf`); }
    function makePdf(d, mode, opts) {
      if (!pdfReady()) return;
      const doc = global.pdfMake.createPdf(ISG.buildPdf(schema, d, opts));
      if (mode === 'print') doc.print(); else doc.download(opts && opts.blank ? fileSafe(`${schema.code}_bos_form.pdf`) : pdfName(d));
    }
    // Tamamlanmış kayıtlar: sunucudan (backend) ya da bu cihazdan. Önbellek, en yeni başta.
    let archCache = backend() ? (archMem[formId] || []) : store.get(formId, 'archive', []);
    let archBusy = false;
    function backend() { return ISG.backend || null; }
    async function complete() {
      if (archBusy) return;
      const v = ISG.validate(schema, data);
      if (v.errors.length) { say('Tamamlanamadı: ' + v.errors.join(' '), 'error'); return; }
      if (v.warnings.length && !global.confirm('Uyarılar:\n• ' + v.warnings.join('\n• ') + '\n\nYine de tamamlansın mı?')) return;
      let rec;
      if (backend()) {
        // Kayıt numarasını sunucu verir; kayıt yazılamazsa taslak olduğu gibi kalır (veri kaybı yok).
        archBusy = true; say('Kayıt sunucuya yazılıyor…', '');
        try { rec = await backend().save(formId, data); }
        catch (e) { archBusy = false; say('Kayıt tamamlanamadı, taslağınız korundu: ' + (e.userMsg || e.message), 'error'); return; }
        archBusy = false;
        archCache.unshift(rec); archMem[formId] = archCache;
      } else {
        const d = new Date();
        data.meta.recordNo = `${schema.code.replace(/[^A-Z0-9]/gi, '')}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${rand(4)}`;
        data.meta.completedAt = d.toISOString();
        rec = clone(data);
        archCache.unshift(rec);
        store.set(formId, 'archive', archCache.slice(0, ISG.config.archiveLimit));
      }
      makePdf(rec, 'download');
      data = normalize(blankData(schema, 0), schema);
      carryFrom(archCache[0]);
      store.set(formId, 'draft', data);
      pendingMsg = { t: `Kayıt tamamlandı: ${rec.meta.recordNo}. PDF indirildi; yazdırıp imzalayın. Yeni dönem için form temizlendi.`, l: 'ok' };
      rerender();
    }
    function carryFrom(rec) {
      if (kind !== 'table' || !rec) { if (kind === 'table' && !data.rows.length) data.rows.push(blankRow(schema)); return false; }
      const carry = (schema.table.columns || []).filter((c) => c.carry).map((c) => c.key);
      if (!carry.length) { if (!data.rows.length) data.rows.push(blankRow(schema)); return false; }
      data.rows = rec.rows.map((r) => { const n = blankRow(schema); carry.forEach((k) => { n[k] = r[k]; }); return n; });
      if (!data.rows.length) data.rows.push(blankRow(schema));
      return true;
    }
    const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async () => {
      const f = fileIn.files[0]; if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        const d = obj.data || obj;
        if (d.meta && d.meta.formId && d.meta.formId !== formId) throw new Error(`Bu dosya başka bir forma ait (${d.meta.formId}).`);
        data = normalize(d, schema); store.set(formId, 'draft', data); rerender(); say('JSON içe aktarıldı.', 'ok');
      } catch (e) { say('İçe aktarılamadı: ' + e.message, 'error'); }
      fileIn.value = '';
    } });

    const hasQr = kind === 'table' && schema.table.qr;
    const bar = h('div', { class: 'isg-bar' },
      h('button', { type: 'button', class: 'isg-btn is-primary', onclick: complete }, 'Tamamla ve PDF indir'),
      h('button', { type: 'button', class: 'isg-btn', onclick: () => makePdf(data, 'download') }, 'Taslak PDF'),
      h('details', { class: 'isg-more' },
        h('summary', { class: 'isg-btn' }, 'Diğer işlemler'),
        h('div', { class: 'isg-more-menu' },
          h('button', { type: 'button', class: 'isg-btn is-quiet', onclick: () => makePdf(data, 'download', { blank: true }) }, 'Boş form PDF (sahada elle doldurmak için)'),
          hasQr ? h('button', { type: 'button', class: 'isg-btn is-quiet', onclick: () => {
            if (!pdfReady()) return;
            const base = global.location.origin + global.location.pathname;
            global.pdfMake.createPdf(ISG.buildLabelPdf(schema, data, base)).download(fileSafe(`${schema.code}_QR_etiketleri.pdf`));
          } }, 'QR etiketlerini indir') : null,
          kind === 'table' && (schema.table.columns || []).some((c) => c.carry) ? h('button', { type: 'button', class: 'isg-btn is-quiet', onclick: () => {
            const rec = archCache[0];
            if (!rec) { say('Arşivde önceki kayıt yok.', 'error'); return; }
            if (!global.confirm('Mevcut satırlar, son tamamlanan kaydın ekipman listesiyle değiştirilsin mi? (Kontrol işaretleri boş gelir.)')) return;
            carryFrom(rec); save(); rerender(); say('Ekipman listesi son kayıttan alındı.', 'ok');
          } }, 'Ekipman listesini son kayıttan al') : null,
          h('button', { type: 'button', class: 'isg-btn is-quiet', onclick: () => downloadBlob(new Blob([JSON.stringify({ format: 'isg-form@1', data }, null, 2)], { type: 'application/json' }), fileSafe(`${schema.code}_${data.meta.recordNo || 'taslak'}.json`)) }, 'JSON olarak dışa aktar'),
          h('button', { type: 'button', class: 'isg-btn is-quiet', onclick: () => fileIn.click() }, 'JSON içe aktar'),
          h('button', { type: 'button', class: 'isg-btn is-quiet is-danger', onclick: () => {
            if (!global.confirm('Taslak tamamen temizlensin mi?')) return;
            data = normalize(blankData(schema), schema); store.set(formId, 'draft', data); rerender(); say('Form temizlendi.', 'ok');
          } }, 'Taslağı temizle'),
          fileIn)),
      status);

    const archBox = h('div');
    function archiveSec() {
      const arch = archCache;
      if (!arch.length) return h('div');
      const be = backend();
      return h('section', { class: 'isg-section' },
        h('h2', null, be ? 'Tamamlanmış kayıtlar' : 'Bu cihazdaki tamamlanmış kayıtlar'),
        h('p', { class: 'isg-help' }, be ? 'Kayıtlar portalda tutulur; PDF’i yeniden indirebilir veya yazdırabilirsiniz. Resmi kayıt, imzalı PDF’tir.' : 'Kayıtlar yalnızca bu tarayıcıda tutulur. Kalıcı arşiv için PDF’i imzalayıp saklayın veya JSON’u ortak klasöre yükleyin.'),
        h('ul', { class: 'isg-archive' }, arch.map((rec, i) => h('li', null,
          h('span', null, h('strong', null, rec.meta.recordNo), ' ', h('span', { class: 'isg-muted' }, new Date(rec.meta.completedAt).toLocaleString('tr-TR'), rec.meta.by ? ' · ' + rec.meta.by : '')),
          h('span', { class: 'isg-archive-actions' },
            h('button', { type: 'button', class: 'isg-btn is-quiet', onclick: () => makePdf(rec, 'download') }, 'PDF'),
            h('button', { type: 'button', class: 'isg-btn is-quiet', onclick: () => makePdf(rec, 'print') }, 'Yazdır'),
            (!be || be.canRemove) ? h('button', { type: 'button', class: 'isg-btn is-quiet is-danger', onclick: async () => {
              if (!global.confirm(`${rec.meta.recordNo} ${be ? 'portaldan' : 'bu cihazdan'} silinsin mi?`)) return;
              if (be) {
                try { await be.remove(formId, rec.meta.recordNo); } catch (e) { say('Silinemedi: ' + (e.userMsg || e.message), 'error'); return; }
                archCache = archCache.filter((x) => x.meta.recordNo !== rec.meta.recordNo); archMem[formId] = archCache;
              } else {
                const a = store.get(formId, 'archive', []); a.splice(i, 1); store.set(formId, 'archive', a); archCache = a;
              }
              drawArchive();
            } }, 'Sil') : null)))));
    }
    function drawArchive() { archBox.replaceChildren(archiveSec()); }
    if (backend()) {
      backend().list(formId).then((list) => {
        if (!archBox.isConnected) return;   // bu arada başka forma geçildi
        archCache = list; archMem[formId] = list; drawArchive();
      }).catch((e) => { if (archBox.isConnected) say('Kayıtlar yüklenemedi: ' + (e.userMsg || e.message), 'error'); });
    }

    function rerender() {
      clearTimeout(saveTimer);
      store.set(formId, 'draft', data);
      fid = 0; computedEls.length = 0;
      ISG.mount(root, formId);
    }

    root.classList.add('isg-form');
    root.replaceChildren(...[plate,
      h('section', { class: 'isg-section' }, h('h2', null, 'Genel bilgiler'), headerGrid),
      bodyEl, notesSec, sigSec, msg, bar, archBox].filter(Boolean));
    drawArchive();
    if (pendingMsg) { say(pendingMsg.t, pendingMsg.l); pendingMsg = null; }
    refreshComputed();
    refreshFindings();

    // QR ile gelindiyse ilgili ekipmana git
    const kod = ISG.config.getKod ? ISG.config.getKod() : new URLSearchParams(global.location.search).get('kod');
    if (kod && hasQr) {
      const key = schema.table.qr.key;
      let idx = data.rows.findIndex((r) => r[key] === kod);
      if (idx < 0) {
        const empty = data.rows.findIndex((r) => !(schema.table.columns || []).some((c) => r[c.key]));
        if (empty >= 0) idx = empty; else { data.rows.push(blankRow(schema)); idx = data.rows.length - 1; }
        data.rows[idx][key] = kod; renderRows(); save();
        say(`${kod} listede yoktu; yeni satır olarak eklendi.`, 'ok');
      }
      const card = rowsEl.children[idx];
      if (card) { card.classList.add('is-target'); setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ISG;
})(typeof window !== 'undefined' ? window : globalThis);
