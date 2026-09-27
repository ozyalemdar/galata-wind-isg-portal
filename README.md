# Galata Wind İSG Portalı — Cloudflare pilot kurulumu

> **Komut satırı kullanmadan, yalnızca Cloudflare panosundan kurmak için `KURULUM-PANEL.md` dosyasını izleyin.** Bu README, `wrangler` ile proje olarak kurulum içindir.

Bu paket portalı Cloudflare üzerinde, kurumsal Microsoft hesabıyla (Entra ID) girişli ve ortak veritabanlı olarak çalıştırır.

| Bileşen | Cloudflare ürünü | Görevi |
|---|---|---|
| Arayüz | Workers Static Assets (`public/index.html`) | Portal ekranları |
| API | Worker (`src/index.js`) | Kimlik doğrulama, rol bazlı yetki, veri |
| Veritabanı | D1 (`isg-portal-pilot`) | Kayıtlar, kayıt geçmişi, e-posta kuyruğu |
| Giriş | Zero Trust Access + Entra ID | Tek oturum açma (SSO), MFA |

Yetkiler sunucuda uygulanır: çalışan yalnızca kendi kayıtlarını görür ve yalnızca bildirim açabilir; yönetici kendi ekibinin kayıtlarını görür ve DÖF ilerlemesini günceller; yönetim işlemleri yalnızca İSG rolündedir. Kayıt geçmişi (audit log) sunucuda, kullanıcının gerçek kimliğiyle yazılır.

---

## 0. Ön koşullar

- Cloudflare hesabı ve Cloudflare'de yönetilen bir alan adı (ör. `galatawind.com.tr` ya da pilot için ayrı bir alan adı)
- Microsoft Entra ID'de uygulama kaydı oluşturma yetkisi olan bir yönetici
- Bilgisayarda Node.js 20 veya üzeri

```bash
cd galata-wind-isg-pilot
npm install
npx wrangler login
```

## 1. Veritabanını oluşturun

```bash
npx wrangler d1 create isg-portal-pilot --location=weur
```

Çıktıdaki `database_id` değerini `wrangler.jsonc` içindeki `D1_DATABASE_ID` yerine yazın. Ardından şemayı ve başlangıç tanımlarını (6 saha, ekipler) yükleyin:

```bash
npm run db:schema
npm run db:seed
```

## 2. Entra ID'yi Cloudflare Zero Trust'a bağlayın

1. Zero Trust panosunda takım adınızı belirleyin (ör. `galatawind` → `galatawind.cloudflareaccess.com`).
2. Entra yönetim merkezinde **Applications → App registrations → New registration**: ad "Cloudflare Access", yönlendirme adresi (Web): `https://<takım-adı>.cloudflareaccess.com/cdn-cgi/access/callback`
3. **Certificates & secrets** altında bir istemci sırrı (client secret) oluşturun.
4. **API permissions**: `email`, `openid`, `profile`, `offline_access`, `User.Read`, `Directory.Read.All`, `GroupMember.Read.All` → **Grant admin consent**.
5. Zero Trust → **Settings → Authentication → Login methods → Add new → Azure AD**: Application (client) ID, Client secret, Directory (tenant) ID girin, **Support groups**'u açın, **Test** ile doğrulayın.

> UPN ile e-posta adresi farklıysa, Cloudflare'deki **Email claim** alanına `email` ya da `preferred_username` girin. Portal, kullanıcıyı bu e-posta ile eşleştirir.

## 3. Access uygulamasını oluşturun

Zero Trust → **Access → Applications → Add an application → Self-hosted**

| Ayar | Pilot değeri |
|---|---|
| Uygulama adı | Galata Wind İSG Portalı |
| Alan adı | `isg.<alan-adınız>` (tüm yollar) |
| Oturum süresi | 24 saat |
| Kimlik sağlayıcı | Yalnızca Azure AD (tek seçenek olduğunda giriş ekranı otomatik atlanır) |
| Politika | **Allow**: Entra grubu `ISG-Portal-Pilot` üyeleri (grup yoksa: e-postası `@<alan-adınız>` ile bitenler) |
| Ek kural (önerilen) | Entra koşullu erişimde MFA zorunlu |

Kaydettikten sonra uygulamanın **Overview** sekmesindeki **Application Audience (AUD) Tag** değerini kopyalayın.

## 4. Yapılandırmayı doldurun ve yayınlayın

`wrangler.jsonc` içinde:

| Alan | Değer |
|---|---|
| `routes[0].pattern` | `isg.<alan-adınız>` |
| `database_id` | 1. adımdaki değer |
| `TEAM_DOMAIN` | `<takım-adı>.cloudflareaccess.com` |
| `POLICY_AUD` | 3. adımdaki AUD değeri |
| `ADMIN_EMAILS` | İlk İSG yöneticisinin Entra e-postası (birden fazlaysa virgülle) |

```bash
npm run deploy
```

Özel alan adı bağlandığında `workers_dev`'i `false` yapıp `routes` bloğunu açın; böylece portala yalnızca Access korumalı alan adından erişilir. Pilot aşamasında (henüz özel alan adı yokken) `workers_dev: true` kalır ve adrese `*.workers.dev` üzerinden erişilir — bu durumda Access koruması yine geçerlidir, yalnızca alan adı geçicidir.

### Otomatik deploy (GitHub Actions)

`main` dalına push edildiğinde `.github/workflows/deploy.yml` otomatik olarak `python build.py` çalıştırıp `wrangler deploy` ile canlıya alır. Bunun çalışması için GitHub deposunun **Settings → Secrets and variables → Actions** bölümüne şu secret'lar eklenmelidir:

| Secret | Değer |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare panosu → My Profile → API Tokens; en az bu Worker'ı ve D1'i düzenleme izni olan bir token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare panosu → sağ altta görünen hesap kimliği |

`wrangler.jsonc` içindeki `vars` ve `d1_databases.database_id` alanları gerçek değerlerle doldurulmadan bu workflow'u tetiklemeyin; yanlış/boş değerlerle deploy, canlı Worker'ın ayarlarını (bağlantılar, değişkenler) mevcut panodan girilmiş değerlerin üzerine yazabilir.

## 5. İlk giriş ve kullanıcılar

1. `ADMIN_EMAILS` içindeki hesapla `https://isg.<alan-adınız>` adresine girin. Bu hesap geçici İSG yetkisiyle açılır.
2. **Yönetim Paneli → Kullanıcılar → Kullanıcı ekle** ile önce kendinizi, sonra pilot kullanıcıları ekleyin. **E-posta alanı Entra'daki adresle birebir aynı olmalı.**
3. Rolü, ekibi ve sahayı doğru seçin. Listede olmayan biri Access'ten geçse bile portalda "Erişiminiz henüz tanımlı değil" ekranını görür.
4. Kendinizi ekledikten sonra `ADMIN_EMAILS` değerini boşaltıp yeniden yayınlamanız önerilir.

## 6. Pilot kabul testleri

| # | Test | Beklenen |
|---|---|---|
| 1 | Access dışından (gizli pencere) adrese git | Microsoft giriş ekranı |
| 2 | Listede olmayan kurum hesabıyla gir | "Erişiminiz henüz tanımlı değil" |
| 3 | Çalışan hesabıyla ramak kala bildir | Numara sunucuda atanır (RK-2026-000X), yalnızca kendi kaydını görür |
| 4 | Aynı bildirimi yönetici hesabında aç | Ekip kaydı görünür, anonimse bildiren "Gizli" |
| 5 | Çalışan hesabıyla DÖF menüsü | Menüde yok; API de reddeder |
| 6 | İSG hesabıyla kaydı sil | Diğer oturumlarda en geç 60 sn içinde kaybolur |
| 7 | Yönetim Paneli → Kayıt geçmişi | Tüm işlemler gerçek kullanıcı adıyla |
| 8 | Raporlar → Excel ve PDF | Dosyalar indirilir, Türkçe karakterler doğru |
| 9 | Telefondan giriş | Menü çekmeceye dönüşür, formlar tam ekran açılır |

## 7. Güvenlik ve işletim ayarları

- **Hız sınırı:** Security → WAF → Rate limiting: `/api/*` için IP başına dakikada 120 istek, aşımda 1 dk engel.
- **Yedek:** D1 Time Travel ile geçmiş bir ana geri dönülebilir. Ek olarak haftalık dışa aktarma: `npm run db:backup` (çıktıyı şirket içi güvenli alanda saklayın).
- **Günlükler:** `observability` açık; Workers → galata-wind-isg-pilot → Logs.
- **Güvenlik başlıkları:** `public/_headers` içinde CSP, çerçeve engeli ve diğer başlıklar tanımlı.
- **KVKK:** İş kazası kayıtları sağlık verisi (özel nitelikli kişisel veri) içerebilir. Veritabanı Batı Avrupa'da (`weur`) tutulur; bu yurt dışına aktarım anlamına gelir. Pilot başlamadan önce hukuk/KVKK birimiyle aydınlatma metni ve aktarım dayanağını netleştirin. Pilotta gerçek kişi adları yerine baş harf kullanmak da bir seçenektir.

## 8. Maliyet (pilot ölçeği)

- Zero Trust Access: 50 kullanıcıya kadar ücretsiz plan.
- Workers ve D1: ücretsiz katman çoğu pilot için yeterli. Portal verileri 60 saniyede bir ve yalnızca değişen kayıtları çeker. 50'den fazla aktif kullanıcı ya da uzun saklama süresi gerekirse Workers Paid planına geçin.

## 9. Intranet (Galata Power) ile uyum

- **Logo:** Galata Wind logosu portal dosyasına gömülüdür (üst çubuk, giriş ekranı ve PDF raporlar). Ayrı bir dosya yüklemeye gerek yoktur; koyu temada logo beyaz bir zemin üzerinde gösterilir.
- **Intranetten bağlantı:** Galata Power → Bilgi Bankası'na "İSG Portalı" adlı bir *Harici Link* ekleyin (`https://isg.<alan-adınız>`). İstenirse üst menüye de bir öğe olarak eklenebilir; iki sistem aynı Microsoft hesabıyla açıldığı için kullanıcı ikinci kez şifre girmez.
- **Intranet içine gömme (iframe):** Varsayılan olarak kapalıdır (`frame-ancestors 'none'`). Gerekirse `public/_headers` içindeki değeri `frame-ancestors https://galatapower.galatawind.com.tr` yapın ve `X-Frame-Options` satırını kaldırın. Access oturum çerezi üçüncü taraf bağlamında bazı tarayıcılarda engellenebildiği için yeni sekmede açmak daha sorunsuzdur.

## 10. Pilotta bilinen sınırlar

- **E-posta:** Kuyruktaki e-postalar 5 dakikada bir Microsoft Graph ile gönderilir (bkz. *E-posta gönderimi*). Secret'lar girilmezse bildirimler yalnızca kuyruğa yazılır. Yönetim Paneli'ndeki durum sütunu sayfa yenilenince güncellenir.
- **Dosya ekleri:** Kayıt içinde saklanır; fotoğraflar otomatik küçültülür, diğer dosyalar en fazla 140 KB. Sonraki adım: R2 depolama ya da SharePoint.
- **Eş zamanlılık:** Aynı kaydı iki kişi aynı anda düzenlerse son kaydeden geçerli olur.
- **Kayıt geçmişi:** Ekranda son 45 gün gösterilir; tamamı veritabanında (`logs` tablosu) kalır.

## E-posta gönderimi (Microsoft Graph)

Portal e-postaları önce `logs` tablosuna (`kind = 'eposta'`) yazar. Worker'ın zamanlanmış görevi bu kuyruğu ortak bir posta kutusundan gönderir:

| Zamanlama (UTC) | Görev |
|---|---|
| `*/5 * * * *` | Kuyruktaki e-postaları gönderir, durumunu `Gönderildi` / `Hata` yapar. 3 başarısız denemeden sonra `Hata`; 2 günden eski bekleyen kayıtlar `Atlandı` olur. |
| `0 6 * * 1-5` | Hafta içi 09:00 (TR): termini geçen ya da 3 gün içinde dolacak açık DÖF'ler için her sorumluya tek özet e-posta kuyruğa yazar. |

Gönderilen durumlar: yeni DÖF (sorumlu + ekip yöneticisi), DÖF sorumlusu değişince, DÖF "Doğrulama Bekliyor"a geçince (İSG), termin hatırlatmaları ve portalın kuyruğa aldığı diğer bildirimler. DÖF e-postaları DÖF no, başlık, termin, durum, planlanan faaliyet ve portal bağlantısı içerir.

**1. Gönderen posta kutusu:** Exchange'de ortak (shared) bir kutu açın, ör. `isg-portal@galatawind.com.tr` (lisans gerekmez).

**2. Entra uygulama kaydı:** Entra → **App registrations → New registration** ("İSG Portalı E-posta"). **API permissions → Microsoft Graph → Application permissions → `Mail.Send`** → **Grant admin consent**. **Certificates & secrets** altında istemci sırrı oluşturun (bitiş tarihini takvime not edin).

**3. İzni tek kutuyla sınırlayın (zorunlu):** `Mail.Send` uygulama izni varsayılan olarak kiracıdaki *tüm* kutulardan gönderime izin verir. Exchange Online PowerShell'de:

```powershell
New-DistributionGroup -Name "ISG Portal Mail" -Type Security -Members isg-portal@galatawind.com.tr
New-ApplicationAccessPolicy -AppId <CLIENT_ID> -PolicyScopeGroupId "ISG Portal Mail" -AccessRight RestrictAccess -Description "İSG portalı yalnızca kendi kutusundan gönderir"
Test-ApplicationAccessPolicy -AppId <CLIENT_ID> -Identity isg-portal@galatawind.com.tr   # AccessCheckResult: Granted
```

**4. Worker secret'ları:** Cloudflare → Workers → `galata-wind-isg-pilot` → **Settings → Variables and Secrets** → tür **Secret**:

| Secret | Değer |
|---|---|
| `GRAPH_TENANT_ID` | Directory (tenant) ID |
| `GRAPH_CLIENT_ID` | Application (client) ID |
| `GRAPH_CLIENT_SECRET` | İstemci sırrının *Value* alanı |
| `MAIL_FROM` | `isg-portal@galatawind.com.tr` |

Secret'lar `wrangler deploy` ile silinmez. Zamanlamalar ve `PORTAL_URL` `wrangler.jsonc` içindedir; deploy ile gelir.

**5. Kontrol:** Workers → **Logs** içinde "E-posta gönderimi kapalı" uyarısı görünmemeli. Bir DÖF açıp 5 dakika içinde Yönetim Paneli → E-posta bildirimleri'nde durumun `Gönderildi` olduğunu (sayfayı yenileyerek) kontrol edin. `Hata` görünürse hata metni kayıtta (`hata` alanı) ve Worker günlüklerindedir.

## Yerel geliştirme (isteğe bağlı)

```bash
cp .dev.vars.example .dev.vars   # DEV_EMAIL'i ADMIN_EMAILS ile aynı yapın
npm run db:schema:local && npm run db:seed:local
npm run dev                      # http://localhost:8787
```

`.dev.vars` yalnızca yerelde kullanılır ve canlıya yüklenmez.

## Dosyalar

```
wrangler.jsonc       Worker, D1, alan adı ve Access ayarları
src/index.js         API: kimlik doğrulama, yetki, veri
public/index.html    Portal arayüzü
public/_headers      Güvenlik başlıkları
schema.sql           D1 tabloları
seed.sql             Başlangıç tanımları (sahalar, ekipler)
.dev.vars.example    Yerel geliştirme örneği
panel/worker.js      Panodan kurulum için tek dosya (arayüz gömülü)
KURULUM-PANEL.md     Panodan adım adım kurulum
worker.template.js   Worker kaynağı (build.py ile src/ ve panel/ üretilir)
build.py             Arayüz değişince: python3 build.py
```
