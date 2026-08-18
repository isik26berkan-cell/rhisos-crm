# Ev Planı Hesaplama — PRD

## Problem Statement
Türkçe, modern, responsive, tamamen tarayıcı-taraflı (backend/DB yok) bir Ev Planı Hesaplama uygulaması. Kullanıcı finansman tutarı, peşinat, teslim tarihi ve vade girerek gerçek zamanlı ödeme planı oluşturur.

## Architecture
- Frontend-only React (CRA + craco), Tailwind + shadcn/ui, framer-motion.
- Kalıcılık: localStorage (kayıtlı planlar + ayarlar). Backend (FastAPI/Mongo) KULLANILMIYOR.
- Hesaplama motoru: `src/lib/calculations.js` (buildPlan + modüler fonksiyonlar), `src/lib/resolve.js`.
- Sayfalar: `src/pages/Calculator.jsx`, `src/pages/Settings.jsx`.
- Bileşenler: `src/components/calculator/` (PlanForm, SummaryCards, ProgressBar, PaymentTable, TieredPayments, ScenarioCompare), `CurrencyInput`.
- Ayarlar context: `src/context/SettingsContext.jsx`.
- Dışa aktarma: `src/lib/exporters.js` (jspdf + html2canvas PDF, xlsx Excel).

## User Personas
- Ev/finansman almak isteyen bireysel kullanıcı; peşinat/teslim/bütçe senaryolarını karşılaştırır.

## Core Requirements (static)
- Organizasyon bedeli %7 (finansmana dahil değil), teslim şartı %45, minimum aylık ödeme, teslim sonrası kalan borç.
- Türkçe para (2.000.000 TL) ve tarih (3 Ağu 2026) formatı.
- Canlı hesaplama; teslim ayı vurgusu; son taksit düzeltmesi.

## Implemented (2026-06)
- Canlı özet kartları (10 metrik) + teslim hedefi progress bar.
- Ödeme planı tablosu: Organizasyon Ücreti Peşinat, Proje Peşinatı, Tasarruf Taksiti, Finansman Taksiti; teslim ayı mercan vurgu.
- Manuel taksit düzenleme, ek/ara ödeme, kademeli ödeme planı.
- 3 hesaplama modu (Teslim tarihine göre / Aylık bütçeye göre / Peşinat+Teslim).
- Peşinat oranı, hata kontrolleri, manuel yeterlilik uyarıları, peşinat %45'i karşılama yeşil kutusu.
- Plan kaydet/aç/kopyala/sil (localStorage), en fazla 4 plan senaryo karşılaştırma.
- PDF ve Excel dışa aktarma. Ayarlar sayfası (org oranı, teslim oranı, ödeme günü, para birimi).
- Testing agent ile doğrulandı (~85% ilk tur → 2 bug düzeltildi: kaydet id yenileme, ayarlar float).

## Backlog (P1/P2)
- P1: Kaydet dialogunda mevcut planı güncelle vs. farklı kaydet ayrımı.
- P2: Kademe çakışma anlık görsel uyarısı, dialogları ayrı komponentlere bölme.
