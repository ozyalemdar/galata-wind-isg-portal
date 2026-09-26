-- Başlangıç tanımları: sahalar ve ekipler
INSERT INTO docs (coll, id, data, deleted, updated_at, updated_by)
VALUES ('ayarlar', 'genel', '{"sahalar": ["Erzurum GES", "Merkez Ofis", "Mersin Mut RES", "Taşpınar Hybrid Santral", "Çorum GES", "ŞAH RES"], "ekipler": ["Saha Bakım", "Elektrik ve Trafo", "İSG", "İdari İşler"]}', 0, 1789714112556, 'kurulum')
ON CONFLICT(coll, id) DO NOTHING;

-- İsteğe bağlı: ilk İSG yöneticisini doğrudan ekleyin (e-posta Entra ID'deki ile aynı olmalı)
-- INSERT INTO docs (coll, id, data, deleted, updated_at, updated_by) VALUES
-- ('kullanicilar', 'u-ad.soyad', '{"username":"ad.soyad","ad":"Ad Soyad","rol":"isg","ekip":"İSG","saha":"Merkez Ofis","eposta":"ad.soyad@galatawind.com.tr"}', 0, 1789714112556, 'kurulum');
