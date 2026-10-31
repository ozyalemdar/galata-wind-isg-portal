-- 6-kullanicilari_kaldir.sql ile kaldırılan kullanıcıları geri getirir.
-- Not: 2a-2e dosyaları "ON CONFLICT DO NOTHING" kullandığı için silindi işaretli kayıtları geri açmaz; bu dosyayı kullanın.
UPDATE docs SET deleted = 0, updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000, updated_by = 'kurulum'
WHERE coll = 'kullanicilar' AND deleted = 1;
