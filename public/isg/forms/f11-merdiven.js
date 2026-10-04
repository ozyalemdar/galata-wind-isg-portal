ISG.register({
  id: 'f11-merdiven',
  code: 'İSG.P1.F11',
  rev: 'R00 – 12.09.2022',
  title: 'Merdiven Kontrol Formu',
  short: 'Merdiven',
  period: 'Aylık kontrol · F12 kâğıt etiketin yerine QR etiket',
  intro: 'QR etiketi merdivene yapıştırıldığında, okutan kişi doğrudan bu formda o merdivenin satırına gelir.',
  header: [
    { key: 'tesis', label: 'Tesis', type: 'text', required: true },
    { key: 'tarih', label: 'Kontrol tarihi', type: 'date', required: true, default: 'today' }
  ],
  table: {
    title: 'Merdivenler',
    addLabel: 'Merdiven ekle',
    identityKeys: ['kod', 'yer'],
    qr: { key: 'kod', subKeys: ['yer', 'kapasite'] },
    columns: [
      { key: 'kod', label: 'Merdiven kodu', type: 'text', required: true, carry: true, placeholder: 'MR-01' },
      { key: 'yer', label: 'Bulunduğu yer', type: 'text', required: true, carry: true },
      { key: 'kapasite', label: 'Taşıma kapasitesi (kg)', short: 'Kap. kg', type: 'number', carry: true }
    ],
    checks: [
      { id: 'basamak', label: 'Gevşek basamak yok' },
      { id: 'baglanti', label: 'Basamak–yan ayak bağlantısı sağlam' },
      { id: 'curume', label: 'Ayaklarda zayıflama ve çürüme yok' },
      { id: 'vida', label: 'Vida, somun ve metal parçalarda gevşeme yok' },
      { id: 'catlak', label: 'Yan ayak, kuşak, basamaklarda çatlak/oyuk/kırık yok' },
      { id: 'kiymik', label: 'Basamak ve yan ayaklarda kıymık yok' },
      { id: 'taban', label: 'Kaymaz tabanlar eksiksiz ve eskimemiş' },
      { id: 'korozyon', label: 'Korozyon yok' },
      { id: 'yalpa', label: 'Yalpalama, sallanma yok' },
      { id: 'mentese', label: 'Menteşe gevşek, eğik veya kırık değil' },
      { id: 'kilit', label: 'Uzatma kilitleri eksiksiz ve sağlam' },
      { id: 'oturma', label: 'Kilitler yerine tam oturuyor' }
    ]
  },
  signatures: [{ role: 'Kontrol eden' }]
});
