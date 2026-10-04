ISG.register({
  id: 'f09-yangin-sondurucu',
  code: 'İSG.P1.F9',
  rev: 'R00 – 12.09.2022',
  title: 'Yangın Söndürücü Kontrol Çizelgesi',
  short: 'Yangın söndürücü',
  period: 'Aylık kontrol (teknik personel) · 6 aylık yetkili firma kontrol/dolum',
  intro: 'Her söndürücü bir satırdır. Kod girerek QR etiketi üretebilir, sonraki ay listeyi tek tuşla taşıyabilirsiniz.',
  header: [
    { key: 'tesis', label: 'Tesis', type: 'text', required: true },
    { key: 'donem', label: 'Ay / yıl', type: 'month', required: true, default: 'thisMonth' }
  ],
  table: {
    title: 'Söndürücüler',
    addLabel: 'Söndürücü ekle',
    identityKeys: ['kod', 'lokasyon'],
    qr: { key: 'kod', subKeys: ['lokasyon', 'kat'] },
    columns: [
      { key: 'kod', label: 'Söndürücü kodu', short: 'Kod', type: 'text', required: true, carry: true, placeholder: 'YS-01' },
      { key: 'lokasyon', label: 'Lokasyon', type: 'text', required: true, carry: true },
      { key: 'kat', label: 'Kat', type: 'text', carry: true },
      { key: 'tip', label: 'Tip', type: 'select', options: ['KKT', 'CO2', 'Köpük', 'Su', 'Diğer'], carry: true },
      { key: 'net', label: 'Net ağırlık (kg)', short: 'Net kg', type: 'number', carry: true },
      { key: 'brut', label: 'Brüt ağırlık (kg)', short: 'Brüt kg', type: 'number' },
      { key: 'dolum', label: 'Dolum tarihi', short: 'Dolum', type: 'date', carry: true },
      { key: 'skt', label: 'Son kullanma tarihi', short: 'SKT', type: 'date', expiry: true, carry: true }
    ],
    checks: [
      { id: 'etiket', label: 'Üzerinde güncel kontrol etiketi var' },
      { id: 'yerinde', label: 'İşaretli yerinde' },
      { id: 'gorunur', label: 'Görünürlüğü engellenmemiş, önünde malzeme yok' },
      { id: 'talimat', label: 'Dışa bakan yüzeyde çalıştırma talimatı var ve okunabilir' },
      { id: 'conta', label: 'Conta, mühür ve doluluk göstergeleri sağlam' },
      { id: 'dolu', label: 'Tam dolu (tartarak veya kaldırarak)' },
      { id: 'hasar', label: 'Hasar, korozyon, sızdırma yok' },
      { id: 'gosterge', label: 'Gösterge uygun konumda' }
    ]
  },
  signatures: [{ role: 'Kontrol eden' }]
});
