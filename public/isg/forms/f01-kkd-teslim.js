ISG.register({
  id: 'f01-kkd-teslim',
  code: 'İSG.P1.F1',
  rev: 'R00 – 12.09.2022',
  title: 'Kişisel Koruyucu Donanım Teslim ve Kullanım Taahhüt Formu',
  short: 'KKD teslim',
  period: 'İşe girişte ve her yeni teslimde · ıslak imza zorunlu',
  intro: 'Teslim edilen donanımları girin, PDF’i yazdırıp personele imzalatın. İmzalı nüsha özlük dosyasına konur.',
  pdf: { orientation: 'portrait', blankRows: 12 },
  header: [
    { key: 'tesis', label: 'Tesis', type: 'text', required: true },
    { key: 'personel', label: 'Personel adı soyadı', type: 'text', required: true },
    { key: 'gorev', label: 'Görevi', type: 'text', required: true },
    { key: 'iseGiris', label: 'İşe giriş tarihi', type: 'date' }
  ],
  table: {
    title: 'Teslim edilen donanımlar',
    addLabel: 'Donanım ekle',
    identityKeys: ['kkd'],
    rowNote: false,
    columns: [
      { key: 'kkd', label: 'Kişisel koruyucu donanım', short: 'KKD', type: 'select', required: true, grow: true,
        options: ['Güvenlik ayakkabısı', 'Baret', 'Montaj eldiveni', 'Kaynakçı eldiveni', 'Paraşüt tipi kemer', 'Koruyucu gözlük', 'Yüz siperliği', 'Kaynakçı baş maskesi', 'Kaynakçı el maskesi', 'Kolluk', 'Tozluk', 'Kulak tıkacı', 'Kulaklık', 'Çizme', 'Yağmurluk', 'Toz maskesi', 'Gaz maskesi', 'Can yeleği', 'İş elbisesi', 'Diğer'] },
      { key: 'standart', label: 'Standart / model', type: 'text', placeholder: 'EN 397' },
      { key: 'miktar', label: 'Miktar', type: 'number' },
      { key: 'tarih', label: 'Teslim tarihi', type: 'date' }
    ]
  },
  statement: 'Görev yaparken kullanmak üzere tarafıma teslim edilen ve yukarıdaki listede belirtilen kişisel koruyucu donanımları teslim aldım. Bu donanımların nasıl kullanılacağı, kullanmadığım zaman karşılaşacağım riskler konusunda amir ve yetkililerden gerekli bilgileri ve yönlendirici uyarıları aldım. Bu konuda verilen eğitime katıldım. Bana verilen kişisel koruyucu donanımları çalışırken kullanacağımı, koruyucu donanımda hasar oluşması veya kaybolması durumunda ilgililere haber vereceğimi, kişisel koruyucu donanım olmadan çalışma yapmayacağımı beyan ve taahhüt ederim.',
  signatures: [{ role: 'Teslim alan personel' }, { role: 'Teslim eden' }]
});
