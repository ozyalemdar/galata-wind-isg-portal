ISG.register({
  id: 'f15-ecza-dolabi',
  code: 'İSG.P1.F15',
  rev: 'R00 – 12.09.2022',
  title: 'Ecza Dolabı ve İlk Yardım Çantası Kontrol Formu',
  short: 'Ecza dolabı',
  period: 'Aylık · son kullanma tarihine 30 gün kalan ürün otomatik işaretlenir',
  header: [
    { key: 'dolapNo', label: 'Dolap / çanta no', type: 'text', required: true },
    { key: 'yer', label: 'Bulunduğu yer', type: 'text', required: true },
    { key: 'donem', label: 'Ay / yıl', type: 'month', required: true, default: 'thisMonth' },
    { key: 'disAksam', label: 'Dış aksam durumu', type: 'select', options: ['Normal', 'Değişmeli', 'Yetersiz'], badValues: ['Değişmeli', 'Yetersiz'] }
  ],
  table: {
    title: 'İçindekiler',
    addLabel: 'Malzeme ekle',
    identityKeys: ['icerik'],
    rowNote: false,
    columns: [
      { key: 'icerik', label: 'Malzeme', type: 'text', required: true, carry: true, grow: true },
      { key: 'miktar', label: 'Bulunması gereken miktar', short: 'Gerekli miktar', type: 'text', carry: true },
      { key: 'skt', label: 'Son kullanma tarihi', short: 'SKT', type: 'date', expiry: true, carry: true },
      { key: 'durum', label: 'Durumu', type: 'select', options: ['Tam', 'Eksik', 'Yok', 'Yenisi sipariş edilmeli'], badValues: ['Eksik', 'Yok', 'Yenisi sipariş edilmeli'] }
    ]
  },
  signatures: [{ role: 'Kontrol eden' }]
});
