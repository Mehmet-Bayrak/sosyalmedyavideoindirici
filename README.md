# 🎬 Video İndirici

YouTube, TikTok ve Instagram videolarını MP4 olarak indiren site. Ziyaretçilerin hiçbir şey kurmasına gerek yoktur.

## İnternette yayınlama (Render, ücretsiz)

1. Bu klasörü GitHub'a yükleyin.
2. https://render.com adresinde GitHub hesabınızla giriş yapın.
3. **New → Web Service** deyip bu depoyu seçin.
4. Language: **Docker**, Instance Type: **Free** seçip **Deploy**'a basın.
5. Birkaç dakika sonra `https://<isim>.onrender.com` adresi hazır olur. Bu linki paylaşın.

Notlar:
- Ücretsiz planda site 15 dakika kullanılmazsa uyur; ilk açılış ~1 dakika sürebilir.
- YouTube, sunucu şirketlerinin IP adreslerini sık sık engeller. TikTok ve Instagram genelde çalışır, YouTube bazen "indirilemedi" diyebilir.

## Kendi bilgisayarında çalıştırma (Windows)

```
winget install OpenJS.NodeJS.LTS
winget install yt-dlp.yt-dlp
```

Sonra `baslat.bat` dosyasına çift tıklayın; tarayıcıda http://localhost:3000 açılır.

> Sadece kendi videolarınızı veya indirme izni olan videoları indirin.
