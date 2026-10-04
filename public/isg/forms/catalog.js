/*
 * Form kataloğu ve dijital dönüşüm sıralaması.
 * Puanlar 1–5: sıklık (ne kadar sık dolduruluyor), yapı (işaretle-geç / sabit alanlar),
 * varlık (ekipman bazlı → QR), otomasyon (tarih/hesap/hatırlatma), imza (ıslak imza bağımlılığı düşükse yüksek puan).
 * file: alanı olan formlar bu pakette çalışır durumdadır; olmayanlar için öneri yazılıdır.
 */
window.ISG = window.ISG || {};
window.ISG.catalog = [
  { id: 'f09-yangin-sondurucu', file: 'f09-yangin-sondurucu.js', code: 'İSG.P1.F9', title: 'Yangın söndürücü kontrol formu',
    scores: { siklik: 5, yapi: 5, varlik: 5, otomasyon: 5, imza: 4 },
    advice: 'Aylık, ekipman başına 8 sabit kontrol. QR etiket + listeyi aydan aya taşıma + SKT uyarısı ile kâğıt tamamen kalkar.' },
  { id: 'f13-elektrikli-el-aletleri', file: 'f13-elektrikli-el-aletleri.js', code: 'İSG.P1.F13', title: 'Elektrikli el aletleri kontrol kaydı',
    scores: { siklik: 4, yapi: 5, varlik: 5, otomasyon: 5, imza: 4 },
    advice: 'T1 renk talimatı koda gömüldü: tarih seçilince dönem rengi otomatik gelir. Alet başına QR etiket.' },
  { id: 'f11-merdiven', file: 'f11-merdiven.js', code: 'İSG.P1.F11 + F12', title: 'Merdiven kontrol formu ve etiketi',
    scores: { siklik: 5, yapi: 5, varlik: 5, otomasyon: 3, imza: 4 },
    advice: '12 sabit kontrol. F12 kâğıt etiketin yerine merdivene yapıştırılan QR etiket; okutunca kontrol kaydı açılır.' },
  { id: 'f10-yangin-dedektoru', file: 'f10-yangin-dedektoru.js', code: 'İSG.P1.F10', title: 'Yangın dedektörü kontrol formu',
    scores: { siklik: 3, yapi: 5, varlik: 5, otomasyon: 4, imza: 4 },
    advice: 'F9 ile aynı kalıp; 6 aylık. Yangın paneli dışa aktarımı varsa ileride otomatik doldurulabilir.' },
  { id: 'f15-ecza-dolabi', file: 'f15-ecza-dolabi.js', code: 'İSG.P1.F15', title: 'Ecza dolabı ve ilk yardım çantası',
    scores: { siklik: 5, yapi: 4, varlik: 4, otomasyon: 5, imza: 4 },
    advice: '“SKT’ye 1 ay kala sipariş” kuralı otomatik uyarıya dönüştü; eksik/yok seçilen malzeme bulgulara düşer.' },
  { id: 'f07-kaldirma', code: 'İSG.P1.F7', title: 'Kaldırma ekipmanları listesi ve periyodik kontrol planı',
    scores: { siklik: 2, yapi: 5, varlik: 5, otomasyon: 5, imza: 3 },
    advice: 'Form değil, kayıt defteri: data/periyodik-muayene.json + GitHub Actions ile muayene tarihi yaklaşınca otomatik GitHub Issue.' },
  { id: 'f08-basincli-kaplar', code: 'İSG.P1.F8', title: 'Basınçlı kaplar listesi ve periyodik kontrol planı',
    scores: { siklik: 2, yapi: 5, varlik: 5, otomasyon: 5, imza: 3 },
    advice: 'F7 ile aynı kayıt dosyasında tutulur; “bir sonraki muayene tarihi” elle yazılmaz, hesaplanır.' },
  { id: 'f14-kimyasal', file: 'f14-kimyasal.js', code: 'İSG.P1.F14', title: 'Kimyasal kontrol listesi',
    scores: { siklik: 4, yapi: 4, varlik: 3, otomasyon: 4, imza: 3 },
    advice: 'GBF “yok” ve SKT geçmişi otomatik bulgu. Tehlike sınıfı alanı T2 talimatına bağlandı; onay imzası Tesis Yöneticisi.' },
  { id: 'f03-saha-uygunluk-nizamiye', file: 'f03-saha-uygunluk-nizamiye.js', code: 'İSG.P1.F3', title: 'Saha uygunluk kontrol formu',
    scores: { siklik: 4, yapi: 4, varlik: 2, otomasyon: 3, imza: 3 },
    advice: '7 sahanın her biri ayrı kontrol listesi. Örnek olarak Nizamiye hazır; 0/1 puanlı maddeler uygunsuzluk listesini üretir.' },
  { id: 'f02-saha-kontrol-plani', code: 'İSG.P1.F2', title: 'Saha kontrol planı',
    scores: { siklik: 1, yapi: 4, varlik: 2, otomasyon: 5, imza: 3 },
    advice: 'Yıllık plan bir JSON takvim olur; F3 kayıtları tamamlandıkça “uygunsuzluk sayısı” satırı kendiliğinden dolar.' },
  { id: 'f04-izleme-olcme', code: 'İSG.P1.F4', title: 'İzleme ve ölçme planı',
    scores: { siklik: 1, yapi: 4, varlik: 1, otomasyon: 5, imza: 3 },
    advice: 'Ocak sonuna kadar yayımlanan plan takvime (Google Calendar / ICS) dönüştürülür; her satır kayıt formuna bağlanır.' },
  { id: 'f05-performans', code: 'İSG.P1.F5', title: 'Performans izleme tablosu',
    scores: { siklik: 3, yapi: 4, varlik: 1, otomasyon: 4, imza: 3 },
    advice: 'Elle doldurulmaz; diğer formlardan ve sayaçlardan beslenen bir gösterge paneli olur. Puan dilimleri koda alınır.' },
  { id: 'f01-kkd-teslim', file: 'f01-kkd-teslim.js', code: 'İSG.P1.F1', title: 'KKD teslim ve taahhüt formu',
    scores: { siklik: 2, yapi: 3, varlik: 2, otomasyon: 2, imza: 1 },
    advice: 'Personel imzası şart: hibrit model. Dijitalde doldur, taahhüt metniyle PDF al, ıslak imzalat, taranmış nüshayı arşivle.' },
  { id: 'f06-kaza-arastirma', code: 'İSG.P1.F6', title: 'Ramak kala / kaza / olay araştırma formu',
    scores: { siklik: 1, yapi: 2, varlik: 1, otomasyon: 2, imza: 1 },
    advice: 'Serbest metin, kök neden analizi ve 5 imzalı onay akışı. Önce mobil “ramak kala bildir” ekranı, araştırma kısmı sonra.' }
];
window.ISG.catalog.forEach((c) => { c.total = Object.values(c.scores).reduce((a, b) => a + b, 0); });
window.ISG.catalog.sort((a, b) => b.total - a.total);
