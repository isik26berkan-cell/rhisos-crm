# Hostinger Deploy (Paylaşımlı Hosting + Setup Python App + GitHub)

Frontend (React build) ana domainde: **https://rhisos.lofydigital.com**
Backend (FastAPI) ayrı subdomain'de: **https://api.rhisos.lofydigital.com**

Bu ayrım Hostinger paylaşımlı hostingde en güvenilir yöntemdir (alt-yol/prefix karmaşası olmaz).

---

## 1) Backend subdomain + Python App
1. hPanel -> Domains -> **Subdomains** -> `api` oluştur (api.rhisos.lofydigital.com).
2. hPanel -> Advanced -> **Setup Python App** (Python Selector):
   - Python sürümü: 3.11+
   - **Application root**: repo'daki `backend/` klasörü
   - **Application URL**: `api.rhisos.lofydigital.com` (kök — alt yol YOK)
   - **Application startup file**: `passenger_wsgi.py`
   - **Application Entry point**: `application`
3. Uygulamanın sanal ortamında bağımlılıkları kur:
   `pip install -r requirements.txt`  (a2wsgi dahildir)
4. **Environment variables** (Python App -> Environment variables) — bunları girin:
   ```
   DB_HOST=srv711.hstgr.io       (Hostinger içinden "localhost" da olabilir)
   DB_PORT=3306
   DB_NAME=u204439196_rhisos
   DB_USER=u204439196_rhisos
   DB_PASSWORD=Rhisos2026@@
   JWT_SECRET=8f3c1a9d7e2b4f6a8c0d5e7f1a3b9c2d4e6f8a0b1c3d5e7f9a1b3c5d7e9f0a2b
   ADMIN_EMAIL=iskberkan@gmail.com
   ADMIN_PASSWORD=rhisos2026
   FRONTEND_URL=https://rhisos.lofydigital.com
   EMERGENT_EMAIL_KEY=ek_43c3f062f4a930a5291cdf64fb39a058
   EMAIL_FROM_NAME=Rhisos Mobilya
   EMAIL_REPLY_TO=iskberkan@gmail.com
   ```
5. **Restart** (Python App -> Restart). Açılışta tablolar otomatik oluşur, admin seed edilir.
   - passenger_wsgi.py, Passenger WSGI'yi FastAPI ASGI'ye a2wsgi ile köprüler ve
     init_db() ile tablo/admin kurulumunu tetikler.

### Backend doğrulama
`https://api.rhisos.lofydigital.com/api/health` ->
`{"status":"ok","database":"connected","admin_exists":true, ...}`

---

## 2) Frontend (ana domain)
`frontend/.env.production` içinde şu tanımlı (repoda hazır):
```
REACT_APP_BACKEND_URL=https://api.rhisos.lofydigital.com
```
- `yarn build` ile üretilen `frontend/build/` ana domain kök dizinine yüklenir.
- SPA fallback için build klasörüne `.htaccess`:
  ```apache
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
  ```
- Böylece tüm API çağrıları `https://api.rhisos.lofydigital.com/api/...` adresine gider.

### CORS / Cookie
- Backend CORS yalnızca `FRONTEND_URL`'e izin verir (allow_credentials=True).
- Oturum cookie'leri `SameSite=None; Secure`. Her iki alan da `lofydigital.com` altında
  olduğundan (same-site) HTTPS üzerinde sorunsuz çalışır.

---

## 3) HTTPS
Her iki (sub)domain için de SSL sertifikasının aktif olduğundan emin olun
(hPanel -> SSL). Cookie'ler yalnızca HTTPS üzerinde çalışır.

---

## Aynı domainde /api istenirse (alternatif, daha kırılgan)
Python App'in Application URL'ini `rhisos.lofydigital.com/api` yapıp frontend'i relative
`/api` ile (REACT_APP_BACKEND_URL boş) kullanabilirsiniz. Ancak Passenger'ın alt-yol
prefix davranışı sürüme göre değişebildiğinden subdomain yöntemi önerilir.

---

## Özet doğrulama akışı
1. `GET https://api.rhisos.lofydigital.com/api/health` -> connected + admin_exists:true
2. https://rhisos.lofydigital.com aç -> Giriş: `iskberkan@gmail.com` / `rhisos2026`
