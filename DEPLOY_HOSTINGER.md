# Hostinger Node.js Web App Deploy — Rhisos Mobilya CRM

Tek Node.js uygulaması: Express hem React build'ini hem `/api` route'larını AYNI
domainden servis eder. Framework: **Express**. Production domain: https://rhisos.lofydigital.com

## Mimari
- Backend: Node.js + Express (`server/index.js`), veritabanı MySQL/MariaDB (mysql2)
- Frontend: React build (`frontend/build/`) Express tarafından statik servis edilir
- Tüm API'ler `/api/...` altında; React Router için SPA fallback var (`/api/*` hariç)
- MongoDB tamamen kaldırıldı.

## Repo yapısı (root'tan deploy)
```
package.json        # scripts: build, start ; server bağımlılıkları
server/             # Express app (index.js, db.js, helpers.js, email.js)
frontend/           # React (build alınır -> frontend/build)
```

## Hostinger Node.js Web App adımları
1. hPanel -> Advanced -> **Node.js** (Setup Node.js App):
   - **Application root**: repo kök klasörü
   - **Application startup file**: `server/index.js`  (veya start komutu `npm start`)
   - Node sürümü: 18+ (20 önerilir)
2. **Environment variables** (Node App -> Environment variables):
   ```
   DB_HOST=srv711.hstgr.io      (Hostinger içinden "localhost" da olabilir)
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
   > PORT: Hostinger otomatik verir; kod `process.env.PORT` kullanır. Elle PORT girmeyin.
3. Bağımlılıklar: `npm install` (Node App arayüzünden "Run NPM Install").
4. Frontend build: bir kez `npm run build` çalıştırın (frontend/build üretir).
   - Hostinger Node App'te terminal/SSH ile: `npm run build`
   - Veya build'i lokalde alıp `frontend/build` klasörünü repoya dahil edip push edin.
5. **Start**: `npm start` (Express ayağa kalkar; ilk açılışta tablolar otomatik oluşur,
   admin ADMIN_EMAIL/ADMIN_PASSWORD ile seed edilir).

## Doğrulama
1. `https://rhisos.lofydigital.com/api/health`
   -> `{"status":"ok","database":"connected","admin_exists":true, ...}`
2. `https://rhisos.lofydigital.com` -> Giriş: `iskberkan@gmail.com` / `rhisos2026`

## Notlar
- Cookie'ler `httpOnly; Secure; SameSite=None` — HTTPS zorunlu (hPanel -> SSL aktif olmalı).
- Frontend ve backend aynı origin olduğundan `REACT_APP_BACKEND_URL` gerekmez (relative `/api`).
- MySQL şifresindeki özel karakterler mysql2 driver ile güvenle kullanılır.
