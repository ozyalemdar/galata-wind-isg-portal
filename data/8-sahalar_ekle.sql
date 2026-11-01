-- Sahalara "Ankara Bala GES" ve "Gezici Ekip" (sahaya giden Genel Merkez çalışanları) eklenir.
-- Mevcut saha adlarına dokunulmaz (kayıtlardaki saha değerleri bozulmasın); zaten varsa tekrar eklenmez.
UPDATE docs SET
  data = json_set(data, '$.sahalar', json((
    SELECT json_group_array(v) FROM (
      SELECT value AS v FROM json_each(docs.data, '$.sahalar')
      UNION ALL SELECT 'Ankara Bala GES' WHERE 'Ankara Bala GES' NOT IN (SELECT value FROM json_each(docs.data, '$.sahalar'))
      UNION ALL SELECT 'Gezici Ekip' WHERE 'Gezici Ekip' NOT IN (SELECT value FROM json_each(docs.data, '$.sahalar'))
    )))),
  updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000, updated_by = 'kurulum'
WHERE coll = 'ayarlar' AND id = 'genel';

SELECT json_extract(data, '$.sahalar') AS sahalar FROM docs WHERE coll = 'ayarlar' AND id = 'genel';
