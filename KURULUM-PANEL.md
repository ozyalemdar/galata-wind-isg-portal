# Galata Wind İSG Portalı — Cloudflare panosundan kurulum

Bu rehber portalı **komut satırı kullanmadan**, yalnızca tarayıcıdan Cloudflare ve Microsoft Entra panolarıyla kurar. Toplam süre yaklaşık 45–60 dakikadır.

Panodan kurulumda tek bir dosya yeterlidir: **`panel/worker.js`**. Portal arayüzü (`index.html`), API, kimlik doğrulama ve güvenlik başlıkları bu dosyanın içindedir. `public/`, `src/`, `package.json` ve `wrangler.jsonc` yalnızca komut satırıyla kurulum (README.md) içindir; bu yolda kullanılmaz.

Kullanacağınız dosyalar:

| Dosya | Nerede kullanılır |
|---|---|
| `schema.sql` | Adım 1, D1 konsolu |
| `seed.sql` | Adım 1, D1 konsolu |
| `panel/worker.js` | Adım 4, Worker kod düzenleyicisi |

Adımları bu sırayla uygulayın. Sıra önemlidir: alan adı, Access koruması kurulmadan yayına açılmaz.

---

## Ön koşullar

- Cloudflare hesabı ve Cloudflare'de yönetilen bir alan adı (ör. `galatawind.com.tr`)
- Microsoft Entra ID'de uygulama kaydı oluşturabilecek bir yönetici
- Portal adresine karar verin. Bu rehberde örnek: **`isg.galatawind.com.tr`**

---

## Adım 1 — Veritabanını (D1) oluşturun

1. Cloudflare panosu → **Storage & Databases → D1 SQL Database → Create Database**.
2. Ad: `isg-portal-pilot`. **Location**: *Western Europe (WEUR)*. **Create**.
3. Açılan veritabanında **Console** sekmesine geçin.
4. `schema.sql` dosyasının tüm içeriğini kutuya yapıştırıp **Execute**'a basın.
5. Kutuyu temizleyin, `seed.sql` dosyasının içeriğini yapıştırıp **Execute**'a basın.
6. Kontrol: `SELECT coll, id FROM docs;` çalıştırın. `ayarlar | genel` satırı görünmelidir.

> Konsol birden çok komutu birlikte çalıştırmazsa `schema.sql` içindeki her `CREATE` satırını tek tek çalıştırın.

## Adım 2 — Entra ID'yi Cloudflare Zero Trust'a bağlayın

1. Cloudflare panosu → **Zero Trust**. İlk girişte takım adı istenir (ör. `galatawind`). Takım alan adınız `galatawind.cloudflareaccess.com` olur. Ücretsiz planı seçin (50 kullanıcıya kadar).
2. **Entra yönetim merkezi** → **Applications → App registrations → New registration**
   - Ad: `Cloudflare Access`
   - Redirect URI (Web): `https://galatawind.cloudflareaccess.com/cdn-cgi/access/callback`
3. **Certificates & secrets → New client secret** oluşturun, **Value** değerini hemen kopyalayın.
4. **API permissions → Add → Microsoft Graph → Delegated**: `email`, `openid`, `profile`, `offline_access`, `User.Read`, `Directory.Read.All`, `GroupMember.Read.All` → **Grant admin consent**.
5. Zero Trust → **Settings → Authentication → Login methods → Add new → Azure AD**
   - Application (client) ID, Client secret, Directory (tenant) ID alanlarını doldurun.
   - **Support groups** seçeneğini açın, kaydedin.
   - Listede **Test**'e basın; Microsoft ile girip başarılı mesajını görün.

> Kullanıcıların UPN'i e-posta adresinden farklıysa **Email claim** alanına `email` ya da `preferred_username` yazın. Portal kullanıcıyı bu adresle eşleştirir.

## Adım 3 — Access uygulamasını oluşturun (koruma kalkanı)

Zero Trust → **Access → Applications → Add an application → Self-hosted**

| Ayar | Değer |
|---|---|
| Application name | Galata Wind İSG Portalı |
| Session duration | 24 hours |
| Public hostname | Subdomain `isg`, Domain `galatawind.com.tr`, Path boş |
| Identity providers | Yalnızca **Azure AD** (tek seçenek olunca giriş ekranı atlanır, doğrudan Microsoft açılır) |

**Policy** ekleyin:

- Action: **Allow**, ad: `Pilot kullanıcıları`
- Include: **Azure Groups** → `ISG-Portal-Pilot` (grup yoksa: **Emails ending in** → `@galatawind.com.tr`)

Kaydedin. Uygulamayı açıp **Overview** (ya da **Basic information**) bölümündeki **Application Audience (AUD) Tag** değerini kopyalayın. Adım 5'te lazım olacak.

## Adım 4 — Worker'ı oluşturun ve kodu yapıştırın

1. Cloudflare panosu → **Workers & Pages → Create → Create Worker** (ya da *Start with Hello World*).
2. Ad: `galata-wind-isg-pilot` → **Deploy**.
3. **Edit code**'a basın. Düzenleyicideki tüm kodu silin.
4. `panel/worker.js` dosyasını bir metin düzenleyicide açın (Not Defteri, VS Code), **tamamını** kopyalayıp yapıştırın. Dosya yaklaşık 200 KB'tır; yapıştırma birkaç saniye sürebilir.
5. Sağ üstten **Deploy**.

> Bu aşamada adresi açarsanız "Kurulum tamamlanmadı" yazar. Bu beklenen durumdur.

## Adım 5 — Veritabanı bağlantısı ve değişkenler

Worker sayfası → **Settings**

**Bindings → Add binding → D1 database**

| Alan | Değer |
|---|---|
| Variable name | `DB` (büyük harf, birebir) |
| D1 database | `isg-portal-pilot` |

**Variables and Secrets → Add** (her biri *Type: Text*)

| Ad | Değer |
|---|---|
| `TEAM_DOMAIN` | `galatawind.cloudflareaccess.com` (başında `https://` olmadan) |
| `POLICY_AUD` | Adım 3'te kopyaladığınız AUD değeri |
| `ADMIN_EMAILS` | İlk İSG yöneticisinin Entra e-postası, ör. `ad.soyad@galatawind.com.tr` |

Her eklemeden sonra **Deploy** ya da **Save and deploy** onayını verin.

**E-posta gönderimi (isteğe bağlı):** `README.md` → *E-posta gönderimi* bölümündeki Entra ve secret adımlarını uygulayın. Panoda ayrıca **Settings → Trigger events → Add → Cron Triggers** ile `*/5 * * * *` ve `0 6 * * MON-FRI` zamanlamalarını, *Text* değişkeni olarak da `PORTAL_URL` (portal adresi) ekleyin.

## Adım 6 — Alan adını bağlayın, diğer adresleri kapatın

Worker → **Settings → Domains & Routes**

1. **Add → Custom domain** → `isg.galatawind.com.tr` → **Add domain**. DNS kaydı ve sertifika otomatik oluşur (birkaç dakika sürebilir).
2. Aynı bölümde **workers.dev** satırını **Disable** yapın.
3. **Preview URLs** satırını **Disable** yapın.

Böylece portala yalnızca Access korumalı adresten erişilebilir.

## Adım 7 — Günlükleri açın

Worker → **Settings → Observability → Workers Logs**: **Enable**. Hatalar **Logs** sekmesinde görünür.

## Adım 8 — İlk giriş ve kullanıcılar

1. `https://isg.galatawind.com.tr` adresine `ADMIN_EMAILS` içindeki hesapla girin. Microsoft girişinden sonra portal geçici İSG yetkisiyle açılır.
2. **Yönetim Paneli → Kullanıcılar → Kullanıcı ekle**: önce **kendinizi** (rol: İSG Departmanı), sonra pilot kullanıcıları ekleyin.
   - **E-posta alanı Entra'daki adresle birebir aynı olmalıdır.**
   - Rol, ekip ve sahayı doğru seçin. Yönetici, yalnızca aynı **ekip** adındaki kayıtları görür.
3. Kendinizi ekledikten sonra Worker → **Settings → Variables** → `ADMIN_EMAILS` değerini silin (ya da boş bırakın) → **Deploy**.

## Adım 9 — Hız sınırı (önerilen)

Alan adınızın panosu → **Security → WAF → Rate limiting rules → Create rule**

- Eşleşme: *URI Path* **starts with** `/api/`
- Özellik: IP
- Sınır: **120 istek / 1 dakika**, işlem **Block**, süre **1 dakika**

## Adım 10 — Kabul testleri

| # | Test | Beklenen |
|---|---|---|
| 1 | Gizli pencerede adresi aç | Microsoft giriş ekranı |
| 2 | Listede olmayan kurum hesabıyla gir | "Erişiminiz henüz tanımlı değil" |
| 3 | Çalışan hesabıyla ramak kala bildir | Numara sunucuda atanır (RK-2026-0001), yalnızca kendi kaydını görür |
| 4 | Aynı bildirimi aynı ekipteki yönetici hesabıyla aç | Kayıt görünür; anonimse bildiren "Gizli" |
| 5 | Çalışan hesabıyla DÖF menüsü | Menüde yok; API de reddeder |
| 6 | İSG hesabıyla bir kaydı sil | Diğer oturumlarda en geç 60 sn içinde kaybolur |
| 7 | Yönetim Paneli → Kayıt geçmişi | Tüm işlemler gerçek kullanıcı adıyla |
| 8 | Raporlar → Excel ve PDF | Dosyalar iner, Türkçe karakterler doğru |
| 9 | Telefondan giriş | Menü çekmeceye dönüşür, formlar tam ekran açılır |

---

## Sorun giderme

| Ekranda görülen | Nedeni ve çözümü |
|---|---|
| "Kurulum tamamlanmadı" | `TEAM_DOMAIN` ya da `POLICY_AUD` girilmemiş veya örnek değer kalmış (Adım 5). |
| "Oturum doğrulanamadı" | AUD değeri yanlış, `TEAM_DOMAIN` hatalı ya da Access uygulaması bu alan adını kapsamıyor (Adım 3). Değeri yeniden kopyalayın. |
| "Veritabanı bağlantısı (DB) tanımlı değil" | Binding adı `DB` değil ya da bağlanmamış (Adım 5). |
| "Erişiminiz henüz tanımlı değil" | Kullanıcı portal listesinde yok ya da e-posta Entra'dakinden farklı (Adım 8). |
| Microsoft girişi yerine Cloudflare seçim ekranı | Access uygulamasında birden fazla kimlik sağlayıcı seçili; yalnızca Azure AD bırakın. |
| Kayıt kaydedilemiyor, "Kayıt çok büyük" | Ekler 2 MB'lık satır sınırını aşıyor; daha az ya da daha küçük dosya ekleyin. |

## Arayüz güncellendiğinde

Portal ekranlarında değişiklik yapıldığında yeni bir `panel/worker.js` üretilir. Worker → **Edit code** → tüm kodu silip yenisini yapıştırın → **Deploy**. Veritabanı, değişkenler ve alan adı etkilenmez.

## Yedek ve KVKK

- **Yedek:** D1 veritabanı → **Time Travel** ile son 30 güne geri dönülebilir. Dosya olarak haftalık dışa aktarma komut satırı gerektirir (README.md, `npm run db:backup`); çıktıyı şirket içi güvenli alanda saklayın.
- **KVKK:** İş kazası kayıtları sağlık verisi içerebilir. Veritabanı Batı Avrupa'da tutulur; bu yurt dışına aktarım anlamına gelir. Pilot başlamadan önce hukuk/KVKK birimiyle aydınlatma metni ve aktarım dayanağını netleştirin.
