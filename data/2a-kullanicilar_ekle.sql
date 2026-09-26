INSERT INTO docs (coll, id, data, deleted, updated_at, updated_by) VALUES
('kullanicilar', 'u-akın.serbest', '{"username": "akın.serbest", "ad": "Akın Serbest", "rol": "yonetici", "ekip": "İş Geliştirme ve Proje Operasyonları", "saha": "Merkez Ofis", "eposta": "akins@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-alev.ercan', '{"username": "alev.ercan", "ad": "Alev Ercan", "rol": "yonetici", "ekip": "İnsan Kaynakları", "saha": "Merkez Ofis", "eposta": "aleve@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-avnimert.sayın', '{"username": "avnimert.sayın", "ad": "Avni Mert Sayın", "rol": "calisan", "ekip": "İş Geliştirme ve Proje Operasyonları", "saha": "Merkez Ofis", "eposta": "avnis@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-bayram.yavuz', '{"username": "bayram.yavuz", "ad": "Bayram Yavuz", "rol": "yonetici", "ekip": "İş Geliştirme ve Proje Operasyonları", "saha": "Merkez Ofis", "eposta": "bayramy@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-beyza.atambay', '{"username": "beyza.atambay", "ad": "Beyza Atambay", "rol": "yonetici", "ekip": "Finans ve Mali İşler", "saha": "Merkez Ofis", "eposta": "beyzaa@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-burak.kuyan', '{"username": "burak.kuyan", "ad": "Burak Kuyan", "rol": "yonetici", "ekip": "Genel Müdürlük", "saha": "Merkez Ofis", "eposta": "burakk@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-burcu.türe', '{"username": "burcu.türe", "ad": "Burcu Türe", "rol": "yonetici", "ekip": "Genel Müdürlük", "saha": "Merkez Ofis", "eposta": "burcut@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-duygu.köksal', '{"username": "duygu.köksal", "ad": "Duygu Köksal", "rol": "yonetici", "ekip": "Finans ve Mali İşler", "saha": "Merkez Ofis", "eposta": "duyguk@galatawind.com.tr"}', 0, 1790260318004, 'kurulum')
ON CONFLICT(coll, id) DO NOTHING;
