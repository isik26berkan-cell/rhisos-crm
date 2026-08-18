# Hostinger MySQL — Production Bağlantısı & Doğrulama

## Durum
- Uygulama tamamen MySQL/MariaDB (SQLAlchemy async) ile çalışıyor.
- Bağlantı yalnızca env değişkenlerinden alınır: `DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD`.
- İlk açılışta tablolar otomatik oluşur; admin `ADMIN_EMAIL/ADMIN_PASSWORD` ile otomatik seed edilir.

## Production değerleri (`.env.production` içinde hazır)
```
DB_HOST=srv711.hstgr.io      # Hostinger içinden "localhost" da kullanılabilir
DB_PORT=3306
DB_NAME=u204439196_rhisos
DB_USER=u204439196_rhisos
DB_PASSWORD=Rhisos2026@@
FRONTEND_URL=https://rhisos.lofydigital.com
```
> Not: Şifredeki `@@` karakteri koddaki bağlantı URL'sinde otomatik olarak URL-encode edilir (quote_plus). Elle bir şey yapmanıza gerek yok.

## Neden preview'dan bağlanılamıyor?
Hostinger paylaşımlı hosting, MySQL 3306 portunu dış internete KAPATIR. Test:
- DNS çözülüyor: `srv711.hstgr.io -> 195.35.59.93`
- TCP 3306: `timed out` (firewall dışarıya kapalı)

Bu yüzden bu geliştirme/preview ortamından canlı DB'ye bağlanılamaz. Uygulama Hostinger'a
deploy edildiğinde MySQL'e YERELDEN eriştiği için sorunsuz bağlanır.

(İsterseniz Hostinger panelinde "Remote MySQL" bölümüne izinli host olarak `%` ekleyip
uzaktan erişimi açabilirsiniz; ancak birçok planda 3306 yine de dış ağa kapalıdır.)

## Deploy sonrası doğrulama
Backend Hostinger'da ayağa kalktıktan sonra sağlık kontrolü:
```
GET https://rhisos.lofydigital.com/api/health
```
Beklenen yanıt:
```json
{
  "status": "ok",
  "database": "connected",
  "dialect": "mysql",
  "tables": ["customers","login_attempts","payments","quote_items","quotes","settings","transactions","users"],
  "admin_exists": true
}
```
`database: "connected"` ve `admin_exists: true` görüyorsanız canlı MySQL bağlantısı doğrulanmış demektir.
Ardından `iskberkan@gmail.com / rhisos2026` ile giriş yapabilirsiniz.
