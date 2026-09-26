INSERT INTO docs (coll, id, data, deleted, updated_at, updated_by) VALUES
('kullanicilar', 'u-uğur.deniz', '{"username": "uğur.deniz", "ad": "Uğur Deniz", "rol": "calisan", "ekip": "Finans ve Mali İşler", "saha": "Merkez Ofis", "eposta": "ugurd@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-yavuz.uçan', '{"username": "yavuz.uçan", "ad": "Yavuz Uçan", "rol": "yonetici", "ekip": "İş Geliştirme ve Proje Operasyonları", "saha": "Merkez Ofis", "eposta": "yavuzu@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-yunusemre.soykan', '{"username": "yunusemre.soykan", "ad": "Yunus Emre Soykan", "rol": "calisan", "ekip": "Finans ve Mali İşler", "saha": "Merkez Ofis", "eposta": "yunuss@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-yüksel.denizoğlu', '{"username": "yüksel.denizoğlu", "ad": "Yüksel Denizoğlu", "rol": "yonetici", "ekip": "Genel Müdürlük", "saha": "Merkez Ofis", "eposta": "yukseld@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-zafer.özer', '{"username": "zafer.özer", "ad": "Zafer Özer", "rol": "yonetici", "ekip": "Finans ve Mali İşler", "saha": "Merkez Ofis", "eposta": "zafero@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-zekionur.aytekin', '{"username": "zekionur.aytekin", "ad": "Zeki Onur Aytekin", "rol": "yonetici", "ekip": "Finans ve Mali İşler", "saha": "Merkez Ofis", "eposta": "zekia@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-zeynep.karasakaloğlu', '{"username": "zeynep.karasakaloğlu", "ad": "Zeynep Karasakaloğlu", "rol": "yonetici", "ekip": "Genel Müdürlük", "saha": "Merkez Ofis", "eposta": "zeynepk@galatawind.com.tr"}', 0, 1790260318004, 'kurulum'),
('kullanicilar', 'u-zeynep.turan', '{"username": "zeynep.turan", "ad": "Zeynep Turan", "rol": "calisan", "ekip": "Hukuk", "saha": "Merkez Ofis", "eposta": "zeynept@galatawind.com.tr"}', 0, 1790260318004, 'kurulum')
ON CONFLICT(coll, id) DO NOTHING;
