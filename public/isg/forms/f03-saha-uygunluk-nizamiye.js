ISG.register({
  id: 'f03-saha-uygunluk-nizamiye',
  kind: 'checklist',
  code: 'İSG.P1.F3',
  rev: 'R00 – 12.09.2022',
  title: 'Saha Uygunluk Kontrol Formu — Nizamiye',
  short: 'Saha uygunluk',
  period: 'Saha Kontrol Planı’na (F2) göre',
  intro: '0 ve 1 olarak işaretlenen maddeler bulgulara düşer ve Uygunsuzluk Takip Listesi’ne (KY.P9.F2) aktarılacak listeyi oluşturur.',
  pdf: { orientation: 'portrait' },
  header: [
    { key: 'tesis', label: 'Tesis', type: 'text', required: true },
    { key: 'tarih', label: 'Kontrol tarihi', type: 'date', required: true, default: 'today' }
  ],
  sections: [{
    title: 'Kontrol noktası: Nizamiye',
    items: [
      { id: 'n1', no: 1, text: 'Güvenlik personeli kimlik kartı kullanıyor mu?' },
      { id: 'n2', no: 2, text: 'Giriş ve çıkış kontrol altında mı?', sub: ['a. Giriş ve çıkış kayıtları tutuluyor mu?'] },
      { id: 'n3', no: 3, text: 'Ziyaretçilere kimlik kartı veriliyor mu?', sub: ['a. Gerekli güvenlik uyarıları yapılıyor mu?', 'b. Kendi başlarına sahaya çıkabiliyorlar mı?'] },
      { id: 'n4', no: 4, text: 'Acil durum toplanma yeri var mı?' },
      { id: 'n5', no: 5, text: 'Nizamiye bina ve telfenslerin topraklaması yapılmış mı?' },
      { id: 'n6', no: 6, text: 'Nizamiye temiz mi?', sub: ['a. Temizlik kontrol çizelgesi var mı?'] },
      { id: 'n7', no: 7, text: 'Nizamiyede uygun yangın söndürücüler mevcut mu?', sub: ['a. Numara verilmiş mi?', 'b. Yerleşim planında gözüküyor mu?', 'c. Kullanım tarihi geçerli mi?', 'd. Periyodik kontrol yapılmış mı?'] },
      { id: 'n8', no: 8, text: 'Ecza dolabı mevcut mu?', sub: ['a. İlaç ve malzemeler tam mı?', 'b. Son kullanım tarihleri kontrol ediliyor mu?'] },
      { id: 'n9', no: 9, text: 'Acil durum tahliye planı asılmış mı?' },
      { id: 'n10', no: 10, text: 'Acil durumda aranacak telefonlar var mı?' },
      { id: 'n11', no: 11, text: 'Acil durum ekipleri listesi asılı mı?' },
      { id: 'n12', no: 12, text: 'Bilgilendirme panosu var mı?', sub: ['a. Politikalar asılı mı?'] },
      { id: 'n13', no: 13, text: 'Arşiv var mı?', sub: ['a. Yangına karşı tedbir alınmış mı?', 'b. Su baskınına karşı tedbir alınmış mı?'] },
      { id: 'n14', no: 14, text: 'WC temizliği rutin olarak yapılıyor mu?' },
      { id: 'n15', no: 15, text: 'Nizamiye bina ve telfenslerin topraklamaları sağlam mı?' },
      { id: 'n16', no: 16, text: 'Elektrik tesisatı normal mi? Kaçak, kopma, sıyrık, kavrulma var mı?' },
      { id: 'n17', no: 17, text: 'Priz topraklamaları normal mi? Prizler sağlam ve içlerinde yabancı cisim yok mu?' },
      { id: 'n18', no: 18, text: 'Alçak gerilim elektrik panolarında:', sub: ['a) Kapaklar sağlam ve kilitli mi?', 'b) Gerekli uyarı levhaları var mı?', 'c) Pano içinde ilgisiz araç/eşya var mı?', 'd) Panoyu olumsuz etkileyen durum var mı? (su, nem vb.)'] },
      { id: 'n19', no: 19, text: 'Bina ve sahada yanmayan aydınlatma lambası var mı?' },
      { id: 'n20', no: 20, text: 'Tavan, duvar ve raflarda düşmeye meyilli malzeme var mı?' },
      { id: 'n21', no: 21, text: 'Dolaplar farklı amaçlarla kullanılıyor mu?' }
    ]
  }],
  signatures: [{ role: 'Kontrol eden' }, { role: 'Onaylayan' }]
});
