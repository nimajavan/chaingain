# استقرار مستقل ChainGain روی Ubuntu

این مسیر از Next.js روی Node 24 و SQLite محلی استفاده می‌کند. به Cloudflare، D1، Wrangler یا Sites برای build/start نیازی ندارد. فایل‌های قدیمی Worker/Vite صرفاً برای سابقه مهاجرت باقی مانده‌اند؛ آن‌ها را برای این استقرار اجرا نکنید.

این راهنما برای یک ماشین، دیسک محلی و یک indexer است؛ دیتابیس را روی NFS/OneDrive یا بین چند سرور مشترک نکنید. SQLite حاوی نمایه رویدادهاست؛ پول در قرارداد TRON نگهداری می‌شود، نه در این دیتابیس. این تغییر، تأیید امنیت قرارداد یا Mainnet نیست.

## ۱. دریافت نسخه و تست

ابتدا نسخه شامل این فایل را از مخزن دریافت کنید. تغییرات محلی سرور را پیش از pull بررسی کنید؛ هیچ reset اجباری انجام ندهید.

```bash
cd /opt/chaingain/app
git status --short
git pull --ff-only origin main
node --version
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm run contracts:compile
npm run contracts:test
npm test
npm audit --omit=dev --audit-level=high
```

هر دستور را جدا اجرا کنید و روی خطا متوقف شوید. Node باید 24.13 یا جدیدتر از شاخه 24 باشد. `npm test` اکنون سرور واقعی Next را روی پورت موقت بالا می‌آورد و HTML، CSS و API را هم بررسی می‌کند. برای build روی RAM یک گیگابایت ممکن است حافظه کافی نباشد؛ اگر `Killed` یا heap exhaustion دیدید، build را روی Linux با حافظه بیشتر انجام دهید یا منابع را افزایش دهید. افزایش سقف heap به بالاتر از RAM راه‌حل نیست.

## ۲. حساب سرویس و Node ثابت

دستورهای مدیریتی این راهنما با root اجرا می‌شوند؛ خود سرویس‌ها root نیستند. اگر حساب chaingain از قبل وجود دارد، آن را دوباره نسازید.

```bash
id chaingain || useradd --system --user-group --home-dir /var/lib/chaingain --shell /usr/sbin/nologin chaingain
id chaingain-keeper || useradd --system --user-group --no-create-home --shell /usr/sbin/nologin chaingain-keeper
install -d -o chaingain -g chaingain -m 0750 /var/lib/chaingain
install -d -o root -g root -m 0755 /etc/chaingain
install -d -o chaingain -g chaingain -m 0750 /opt/chaingain/app/.next/cache
```

برای مستقل‌بودن systemd از NVM کاربر root، ابتدا `command -v node` را بررسی کنید؛ باید باینری Node 24 انتخاب‌شده باشد. سپس فقط همان باینری را با نام اختصاصی نصب کنید:

```bash
install -o root -g root -m 0755 "$(command -v node)" /usr/local/bin/chaingain-node
/usr/local/bin/chaingain-node --version
```

کد و node_modules باید برای هر دو کاربر سرویس خواندنی و پوشه‌های والد قابل عبور باشند. فایل خصوصی را در پوشه پروژه نگذارید. در نصب production کد باید متعلق به مدیر انتشار باشد، نه کاربر وب؛ فقط cache و پوشه داده قابل نوشتن باشند. کل پوشه پروژه را chmod 777 نکنید.

## ۳. تنظیمات جداگانه

دستورهای install زیر فقط بار اول هستند؛ هنگام ارتقا فایل تنظیمات موجود را بازنویسی نکنید.

```bash
install -o root -g chaingain -m 0640 deploy/linux/web.env.example /etc/chaingain/web.env
install -o root -g chaingain -m 0640 deploy/linux/indexer.env.example /etc/chaingain/indexer.env
install -o root -g chaingain-keeper -m 0640 deploy/linux/keeper.env.example /etc/chaingain/keeper.env
```

با ویرایشگر مقادیر را تنظیم کنید. بدون قرارداد هم وب در حالت prelaunch باز می‌شود. برای indexer، آدرس واقعی قرارداد Nile باید در web.env و indexer.env یکسان باشد. فایل keeper.env فقط برای حساب محدود keeper است. هرگز کلید admin، خزانه یا deployer را در این فایل‌ها نگذارید. فعلاً `SALES_ENABLED=false` و `AUTOMATION_EXECUTE=false` بمانند.

تعویض شبکه یا قرارداد نیازمند DATABASE_PATH جداست. سامانه از ترکیب‌کردن اطلاعات دو قرارداد جلوگیری می‌کند. انتقال داده قبلی D1 خودکار نیست؛ برای شروع تازه می‌توان رویدادها را از زمان استقرار دوباره نمایه کرد.

## ۴. migration و شروع وب

```bash
sudo -u chaingain /usr/local/bin/chaingain-node --env-file=/etc/chaingain/web.env dist/services/server/cli.js migrate
install -m 0644 deploy/linux/chaingain-web.service /etc/systemd/system/chaingain-web.service
systemctl daemon-reload
systemctl enable --now chaingain-web
systemctl status chaingain-web --no-pager
curl --fail http://127.0.0.1:3000/
curl -i http://127.0.0.1:3000/api/health
```

`prelaunch` یعنی آدرس هنوز تنظیم نشده؛ `syncing` یعنی indexer هنوز آماده نیست؛ خطای 503 با identity تنظیم‌شده ولی نمایه‌نشده تا اجرای indexer انتظار می‌رود. خطای service_unavailable معمولاً نیازمند بررسی migration/مجوز/مسیر دیتابیس است:

```bash
journalctl -u chaingain-web -n 100 --no-pager
```

## ۵. indexer و keeper

فقط بعد از تنظیم آدرس واقعی Nile:

```bash
install -m 0644 deploy/linux/chaingain-indexer.service /etc/systemd/system/chaingain-indexer.service
install -m 0644 deploy/linux/chaingain-indexer.timer /etc/systemd/system/chaingain-indexer.timer
systemctl daemon-reload
systemctl start chaingain-indexer.service
journalctl -u chaingain-indexer -n 50 --no-pager
systemctl enable --now chaingain-indexer.timer
```

برای keeper ابتدا فقط dry-run:

```bash
install -m 0644 deploy/linux/chaingain-keeper.service /etc/systemd/system/chaingain-keeper.service
install -m 0644 deploy/linux/chaingain-keeper.timer /etc/systemd/system/chaingain-keeper.timer
systemctl daemon-reload
systemctl start chaingain-keeper.service
journalctl -u chaingain-keeper -n 50 --no-pager
```

پس از موفقیت dry-run می‌توان timer را فعال کرد: `systemctl enable --now chaingain-keeper.timer`. تا زمانی که AUTOMATION_EXECUTE=false است تراکنش امضا نمی‌شود. برای ارسال واقعی فقط حساب keeper محدود و دارای TRX هزینه اجرا استفاده شود. اجرای keeper در GitHub Actions و VPS را هم‌زمان فعال نکنید. ایجاد draw و عملیات admin همچنان جدا و از مسیر multisig است.

گردش‌کار GitHub در این نسخه فقط با متغیر ENABLE_GITHUB_KEEPER=true اجرا می‌شود و ارسال تراکنش آن نیز جداگانه نیازمند AUTOMATION_EXECUTE=true است؛ برای استقرار VPS این متغیرها را فعال نکنید.

## ۶. دامنه و HTTPS

DNS رکورد A دامنه را به IP سرور وصل کنید؛ فقط در صورت IPv6 صحیح رکورد AAAA بگذارید. در firewall ارائه‌دهنده فقط SSH مورد استفاده و 80/443 را باز کنید، نه 3000. قبل از تغییر firewall دسترسی SSH فعلی را حفظ و پورت واقعی آن را بررسی کنید.

```bash
apt update
apt install -y nginx certbot python3-certbot-nginx
install -m 0644 deploy/linux/nginx.conf.example /etc/nginx/sites-available/chaingain
```

در فایل `/etc/nginx/sites-available/chaingain`، دامنه نمونه را با دامنه واقعی عوض کنید. سپس بار اول:

```bash
ln -s /etc/nginx/sites-available/chaingain /etc/nginx/sites-enabled/chaingain
nginx -t
systemctl reload nginx
```

پس از موفقیت DNS و HTTP، دستور زیر را با دامنه واقعی اجرا کنید:

```bash
certbot --nginx -d YOUR_DOMAIN --redirect
certbot renew --dry-run
```

پیش از HTTPS موفق، اتصال کیف پول و فروش را فعال نکنید. پیام 502 را با وضعیت سرویس وب، و خطای 503 API را با دیتابیس/indexer بررسی کنید.

## ۷. پشتیبان، ارتقا و بازگشت

پشتیبان آنلاین از SQLite با API backup گرفته می‌شود؛ کپی‌کردن تنها فایل sqlite حین نوشتن WAL کافی نیست. یک مقصد جدید انتخاب کنید:

```bash
sudo -u chaingain /usr/local/bin/chaingain-node --env-file=/etc/chaingain/web.env dist/services/server/cli.js backup /var/lib/chaingain/backup-YYYYMMDD-HHMM.sqlite
```

نسخه پشتیبان را رمزگذاری‌شده به محل خارج سرور منتقل و بازیابی را آزمایش کنید. نگهداری چند backup روی همان VPS حفاظت از خرابی دیسک نیست.

برای بازیابی، timerها و هر سه سرویس را متوقف کنید؛ backup را به **مسیر جدید** کپی کنید، مالک را chaingain قرار دهید و DATABASE_PATH وب/indexer را به آن مسیر عوض کنید. migration نسخه مقصد را اجرا و سرویس‌ها را دوباره شروع کنید. فایل دیتابیس فعال یا فایل‌های WAL را بدون توقف سرویس‌ها بازنویسی/حذف نکنید.

پیش از ارتقا SHA نسخه فعلی را ثبت و backup بگیرید. روی سرور تک‌نسخه، وب و timerها را پیش از build متوقف کنید؛ تغییر `.next` در حین سرویس‌دهی امن نیست. نسخه جدید را نصب، تست و migrate کرده، سپس سرویس‌ها را راه‌اندازی کنید. rollback کد را فقط همراه بررسی سازگاری schema انجام دهید؛ migrationهای اعمال‌شده را ویرایش نکنید.

## ۸. شرط راه‌اندازی مالی

بالا آمدن وب فقط استقرار زیرساخت است. بازبینی مستقل قرارداد، آزمایش واقعی WINkLink، پذیرش multisig، چرخه کامل خرید/قرعه/دریافت جایزه/بازپرداخت روی Nile و بررسی پایش/backup هنوز شرط فعال‌کردن فروش هستند. SALES_ENABLED یک قفل عملیاتی رابط کاربری است، نه اثبات اعتبار قرارداد و نه جایگزین pause روی زنجیره. این راهنما Mainnet را فعال نمی‌کند.

## منابع رسمی

- [میزبانی مستقل Next.js](https://nextjs.org/docs/app/guides/self-hosting)
- [SQLite و پشتیبان در Node.js](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)
- [Reverse proxy در Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [راهنمای Certbot](https://certbot.eff.org/)
