-- Ozan Alemdar (İSG, ozana@galatawind.com.tr) dışındaki tüm portal kullanıcılarını kaldırır.
-- Kayıtlar silinmez, "silindi" olarak işaretlenir (deleted = 1); geri almak için 7-kullanicilari_geri_al.sql.
-- Kaldırılan kullanıcılar portala giremez; bildirim, DÖF vb. kayıtları yerinde kalır.

-- Güvenlik: Ozan Alemdar kaydı yoksa hiçbir satır değişmez (yönetici kilitlenmesin)
UPDATE docs SET deleted = 1, updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000, updated_by = 'kurulum'
WHERE coll = 'kullanicilar' AND deleted = 0
  AND lower(json_extract(data, '$.eposta')) <> 'ozana@galatawind.com.tr'
  AND EXISTS (SELECT 1 FROM docs WHERE coll = 'kullanicilar' AND deleted = 0
              AND lower(json_extract(data, '$.eposta')) = 'ozana@galatawind.com.tr'
              AND json_extract(data, '$.rol') = 'isg');

-- Kontrol: yalnızca Ozan Alemdar kalmalı
SELECT id, json_extract(data, '$.ad') AS ad, json_extract(data, '$.rol') AS rol
FROM docs WHERE coll = 'kullanicilar' AND deleted = 0;
