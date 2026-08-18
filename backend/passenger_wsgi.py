"""
Hostinger 'Setup Python App' (Passenger) girişi.
Passenger WSGI bekler; FastAPI ASGI olduğu için a2wsgi ile köprülenir.
Passenger, ASGI 'startup' event'ini çalıştırmadığından tablo oluşturma + admin seed
burada init_db() ile açılışta bir kez tetiklenir.

Application root = backend/ , Application startup file = passenger_wsgi.py
Env değişkenleri (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET,
ADMIN_EMAIL, ADMIN_PASSWORD, FRONTEND_URL, EMERGENT_EMAIL_KEY, EMAIL_FROM_NAME,
EMAIL_REPLY_TO) Python App ayarlarından girilmelidir.
"""
import asyncio

from server import app, init_db

try:
    asyncio.run(init_db())
except RuntimeError:
    # Zaten bir event loop varsa yeni bir loop ile çalıştır
    loop = asyncio.new_event_loop()
    loop.run_until_complete(init_db())
    loop.close()

from a2wsgi import ASGIMiddleware

application = ASGIMiddleware(app)
