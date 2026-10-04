ISG.register({
  id: 'f10-yangin-dedektoru',
  code: 'İSG.P1.F10',
  rev: 'R00 – 12.09.2022',
  title: 'Yangın Dedektörü Kontrol Çizelgesi',
  short: 'Yangın dedektörü',
  period: '6 aylık kontrol (teknik personel)',
  header: [
    { key: 'tesis', label: 'Tesis', type: 'text', required: true },
    { key: 'donem', label: 'Ay / yıl', type: 'month', required: true, default: 'thisMonth' }
  ],
  table: {
    title: 'Dedektörler',
    addLabel: 'Dedektör ekle',
    identityKeys: ['kod', 'lokasyon'],
    qr: { key: 'kod', subKeys: ['ad', 'lokasyon'] },
    columns: [
      { key: 'kod', label: 'Kodu', type: 'text', required: true, carry: true, placeholder: 'YD-01' },
      { key: 'ad', label: 'Adı / tipi', type: 'select', options: ['Duman', 'Isı', 'Alev', 'Gaz', 'Kombine'], carry: true },
      { key: 'lokasyon', label: 'Lokasyon', type: 'text', required: true, carry: true }
    ],
    checks: [
      { id: 'konum', label: 'Belirlenen konumda' },
      { id: 'sinyal', label: 'Sinyali faal' },
      { id: 'hasar', label: 'Hasar yok' },
      { id: 'engel', label: 'Algılaması engellenmemiş' },
      { id: 'baglanti', label: 'Bağlantıları uygun' },
      { id: 'test', label: 'Test başarılı' }
    ]
  },
  signatures: [{ role: 'Kontrol eden' }]
});
