ISG.register({
  id: 'f13-elektrikli-el-aletleri',
  code: 'İSG.P1.F13',
  rev: 'R00 – 12.09.2022',
  title: 'Elektrikli El Aletleri Listesi ve Kontrol Kaydı',
  short: 'El aleti',
  period: '3 aylık görsel kontrol · renk kodu İSG.P1.T1’e göre otomatik',
  intro: 'Kontrol tarihini seçtiğinizde dönemin renk kodu otomatik belirlenir. Kontrolden geçen alete bu renk yapıştırılır.',
  header: [
    { key: 'tesis', label: 'Tesis', type: 'text', required: true },
    { key: 'tarih', label: 'Kontrol tarihi', type: 'date', required: true, default: 'today' },
    { key: 'renk', label: 'Kontrol rengi', compute: 'quarterColor', source: 'tarih', help: 'Bu rengin dışında etiket taşıyan aletler kontrol edilene kadar kullanılmaz.' }
  ],
  table: {
    title: 'El aletleri',
    addLabel: 'El aleti ekle',
    identityKeys: ['kod', 'ad'],
    qr: { key: 'kod', subKeys: ['ad', 'yer'] },
    columns: [
      { key: 'kod', label: 'Kodu', type: 'text', required: true, carry: true, placeholder: 'EA-01' },
      { key: 'ad', label: 'Adı', type: 'text', required: true, carry: true, placeholder: 'Avuç taşlama' },
      { key: 'yer', label: 'Bulunduğu yer', type: 'text', carry: true }
    ],
    checks: [
      { id: 'fis', label: 'Fiş ve kablo hasarsız' },
      { id: 'bant', label: 'Kablo izolasyon bandı ile onarılmamış' },
      { id: 'govde', label: 'Dış yüzeyde tehlikeli hasar yok (kırık muhafaza, keskin kenar vb.)' },
      { id: 'sigorta', label: 'Sigorta koruma değeri uygun' },
      { id: 'duzen', label: 'Muhafaza yerinde derli toplu (dağınık kablo yok)' }
    ]
  },
  signatures: [{ role: 'Kontrol eden' }]
});
