// Video İndirici sunucusu
// Tarayıcıdan gelen linki yt-dlp ile indirir ve dosyayı geri gönderir.
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// İnternette (Render vb.) çalışırken port ortamdan gelir ve herkese açılır;
// kendi bilgisayarında ise sadece bu bilgisayardan erişilebilir.
const PORT = process.env.PORT || 3000;
const HOST = process.env.PORT ? "0.0.0.0" : "127.0.0.1";
const IZINLI_SITELER = ["youtube.com", "youtu.be", "tiktok.com", "instagram.com"];

// Herkese açık sunucunun yükünü sınırlamak için
const AYNI_ANDA_EN_FAZLA = 3;
const EN_BUYUK_DOSYA = "300M";
const ZAMAN_ASIMI_MS = 5 * 60 * 1000;
let aktifIndirme = 0;

// En iyi video + ses; aralarından her oynatıcıda açılan H.264 ve m4a öncelikli.
// (TikTok aynı videoyu H.265 olarak da sunuyor, o Windows'ta ek codec ister.)
const FORMAT = "bv*+ba/b";
const SIRALAMA = "vcodec:h264,res,acodec:m4a";

// Sadece izin verilen sitelerin linklerini kabul et
function linkGecerliMi(link) {
    try {
        const adres = new URL(link);
        if (adres.protocol !== "https:" && adres.protocol !== "http:") {
            return false;
        }
        return IZINLI_SITELER.some(
            (site) => adres.hostname === site || adres.hostname.endsWith("." + site)
        );
    } catch {
        return false;
    }
}

function jsonGonder(cevap, kod, veri) {
    cevap.writeHead(kod, { "Content-Type": "application/json; charset=utf-8" });
    cevap.end(JSON.stringify(veri));
}

// Gelen isteğin gövdesini (JSON) okur
function govdeOku(istek) {
    return new Promise((coz, reddet) => {
        let veri = "";
        istek.on("data", (parca) => {
            veri += parca;
            if (veri.length > 10000) {
                reddet(new Error("İstek çok büyük"));
                istek.destroy();
            }
        });
        istek.on("end", () => coz(veri));
        istek.on("error", reddet);
    });
}

function videoIndir(cevap, link) {
    // Her indirme kendi geçici klasörüne iner, iş bitince silinir
    const klasor = fs.mkdtempSync(path.join(os.tmpdir(), "video-"));
    const temizle = () => fs.rmSync(klasor, { recursive: true, force: true });

    aktifIndirme++;
    const ytdlp = spawn("yt-dlp", [
        "--no-playlist",
        "-f", FORMAT,
        "-S", SIRALAMA,
        "--max-filesize", EN_BUYUK_DOSYA,
        // YouTube için JavaScript çalıştırıcısı; Node zaten kurulu
        "--js-runtimes", "node",
        "--merge-output-format", "mp4",
        "-o", path.join(klasor, "%(title).80B.%(ext)s"),
        "--", link,
    ]);

    // Takılan indirmeler sunucuyu meşgul etmesin
    const zamanlayici = setTimeout(() => ytdlp.kill(), ZAMAN_ASIMI_MS);

    let hataMesaji = "";
    ytdlp.stderr.on("data", (parca) => {
        hataMesaji += parca;
    });

    // yt-dlp hiç başlayamazsa "error" ardından "close" da gelir; cevabı iki kez gönderme
    let baslayamadi = false;
    ytdlp.on("error", () => {
        baslayamadi = true;
        temizle();
        jsonGonder(cevap, 500, { hata: "yt-dlp bulunamadı. Kurulu olduğundan emin olun." });
    });

    ytdlp.on("close", (kod) => {
        aktifIndirme--;
        clearTimeout(zamanlayici);
        if (baslayamadi) {
            return;
        }
        const dosyalar = fs.existsSync(klasor) ? fs.readdirSync(klasor) : [];
        if (kod !== 0 || dosyalar.length === 0) {
            temizle();
            console.error(hataMesaji);
            if (cevap.destroyed) {
                return;
            }
            let mesaj = "Video indirilemedi. Link doğru mu, video herkese açık mı?";
            if (hataMesaji.includes("login") || hataMesaji.includes("cookies")) {
                mesaj = "Bu video giriş yapmayı gerektiriyor, indirilemiyor.";
            } else if (hataMesaji.includes("max-filesize") || hataMesaji.includes("larger than max")) {
                mesaj = `Video çok büyük (en fazla ${EN_BUYUK_DOSYA}B).`;
            }
            jsonGonder(cevap, 400, { hata: mesaj });
            return;
        }

        const dosyaAdi = dosyalar[0];
        const dosyaYolu = path.join(klasor, dosyaAdi);
        cevap.writeHead(200, {
            "Content-Type": "video/mp4",
            "Content-Length": fs.statSync(dosyaYolu).size,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(dosyaAdi)}`,
        });
        const akis = fs.createReadStream(dosyaYolu);
        akis.pipe(cevap);
        akis.on("close", temizle);
    });

    // Kullanıcı sayfayı kapatırsa indirmeyi durdur
    cevap.on("close", () => {
        if (!cevap.writableFinished) {
            ytdlp.kill();
        }
    });
}

const sunucu = http.createServer(async (istek, cevap) => {
    // Kendi bilgisayarında, dosyadan açılan sayfa da bu sunucuya istek atabilsin.
    // İnternette gerek yok: sayfa ile sunucu aynı adreste.
    if (HOST === "127.0.0.1") {
        cevap.setHeader("Access-Control-Allow-Origin", "*");
        cevap.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
        if (istek.method === "OPTIONS") {
            cevap.writeHead(204, {
                "Access-Control-Allow-Methods": "POST",
                "Access-Control-Allow-Headers": "Content-Type",
            });
            cevap.end();
            return;
        }
    }

    if (istek.method === "GET" && istek.url === "/") {
        cevap.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        fs.createReadStream(path.join(import.meta.dirname, "index.html")).pipe(cevap);
        return;
    }

    if (istek.method === "POST" && istek.url === "/indir") {
        let link;
        try {
            link = JSON.parse(await govdeOku(istek)).link;
        } catch {
            jsonGonder(cevap, 400, { hata: "Geçersiz istek." });
            return;
        }
        if (typeof link !== "string" || !linkGecerliMi(link.trim())) {
            jsonGonder(cevap, 400, { hata: "Sadece YouTube, TikTok ve Instagram linkleri kabul edilir." });
            return;
        }
        if (aktifIndirme >= AYNI_ANDA_EN_FAZLA) {
            jsonGonder(cevap, 503, { hata: "Sunucu şu an meşgul, biraz sonra tekrar deneyin." });
            return;
        }
        console.log("İndiriliyor:", link);
        videoIndir(cevap, link.trim());
        return;
    }

    jsonGonder(cevap, 404, { hata: "Sayfa bulunamadı." });
});

sunucu.listen(PORT, HOST, () => {
    console.log(`Video İndirici çalışıyor: http://localhost:${PORT}`);
});
