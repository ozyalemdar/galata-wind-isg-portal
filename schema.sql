-- Galata Wind İSG Portalı — D1 şeması
CREATE TABLE IF NOT EXISTS docs (
  coll        TEXT    NOT NULL,
  id          TEXT    NOT NULL,
  data        TEXT    NOT NULL,          -- JSON
  deleted     INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,          -- epoch ms
  updated_by  TEXT,
  PRIMARY KEY (coll, id)
);
CREATE INDEX IF NOT EXISTS docs_updated ON docs (updated_at);
CREATE INDEX IF NOT EXISTS docs_user_email ON docs (lower(json_extract(data, '$.eposta'))) WHERE coll = 'kullanicilar';

-- Kayıt geçmişi (audit log) ve e-posta kuyruğu; yalnızca ekleme yapılır
CREATE TABLE IF NOT EXISTS logs (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  kind  TEXT NOT NULL,                   -- 'audit' | 'eposta'
  ts    TEXT NOT NULL,
  gun   TEXT NOT NULL,                   -- YYYY-MM-DD (Türkiye saati)
  data  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS logs_kind_gun ON logs (kind, gun);
