ISG.register({
  id: 'f14-kimyasal',
  code: 'İSG.P1.F14',
  rev: 'R00 – 12.09.2022',
  title: 'Kimyasal Kontrol Formu',
  short: 'Kimyasal',
  period: 'Aylık · stok listesi Tesis Yöneticisi onaylı',
  intro: 'Güvenlik bilgi formu bulunmayan ve son kullanma tarihi geçen kimyasallar bulgulara otomatik eklenir.',
  pdf: { orientation: 'landscape' },
  header: [
    { key: 'tesis', label: 'Tesis', type: 'text', required: true },
    { key: 'tarih', label: 'Kontrol tarihi', type: 'date', required: true, default: 'today' },
    { key: 'yer', label: 'Bulunduğu yer', type: 'text' }
  ],
  table: {
    title: 'Kimyasallar',
    addLabel: 'Kimyasal ekle',
    identityKeys: ['ad', 'lokasyon'],
    columns: [
      { key: 'ad', label: 'Kimyasal adı', type: 'text', required: true, carry: true },
      { key: 'marka', label: 'Marka', type: 'text', carry: true },
      { key: 'lokasyon', label: 'Lokasyon', type: 'text', carry: true },
      { key: 'sinif', label: 'Tehlike sınıfı (İSG.P1.T2)', short: 'Sınıf', type: 'select', carry: true,
        options: ['Aşındırıcı', 'Patlayıcı', 'Yakıcı (oksitleyici)', 'Yanıcı', 'Zehirli', 'Tahriş edici / sağlığa zararlı', 'Çevreye zararlı', 'Basınçlı gaz', 'Tehlikesiz'] },
      { key: 'ambalaj', label: 'Ambalaj miktarı', short: 'Ambalaj', type: 'number', carry: true },
      { key: 'birim', label: 'Birim', type: 'select', options: ['kg', 'lt', 'adet', 'koli'], carry: true },
      { key: 'mevcut', label: 'Mevcut miktar', short: 'Mevcut', type: 'number' },
      { key: 'gbf', label: 'Güvenlik bilgi formu', short: 'GBF', type: 'select', options: ['Var', 'Yok'], badValues: ['Yok'], carry: true },
      { key: 'skt', label: 'Son kullanma tarihi', short: 'SKT', type: 'date', expiry: true, carry: true }
    ]
  },
  signatures: [{ role: 'Kontrol eden' }, { role: 'Onaylayan', title: 'Tesis Yöneticisi' }]
});
