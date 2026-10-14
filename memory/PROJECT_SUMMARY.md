# VAL Aim — Proje Özeti ve Devam Prompt'u

## 1. Yapılan işin özeti

**Uygulama:** Tarayıcıda çalışan, Valorant tarzı 3D nişan antrenmanı (FastAPI + MongoDB backend, React + Three.js frontend). Giriş yok, tek kullanıcı.
Önizleme: https://memorable-6.preview.emergentagent.com

### Haritalar ve modlar
- 11 Valorant haritası (Abyss, Ascent, Bind, Breeze, Fracture, Haven, Icebox, Lotus, Pearl, Split, Sunset), kullanıcının .blend dosyalarından GLB'ye çevrildi; mini harita, çarpışma (BVH) ve zemin hizalama var.
- Range modları: Gridshot, Flick, Tracking, Strafe. Kart görselleri AI görsel yerine sade SVG çizimler.
- Harita senaryoları: Ön-nişan (pre-aim), Tutuş (hold), Spike. Toplam 40 hazır senaryo.
- Yeni **Sandbox** haritası + "Sandbox Arena" senaryosu: Editörde B ile kutu/duvar nesnesi eklenir, sağ tıkla seçilir, G ile taşınır, X ile silinir; boyut/yön/renk düzenlenir. Nesneler çarpışmaya dahil ve kaydediliyor.

### Birinci şahıs (FP) kollar ve silah
- Kingdom Archives'tan 29 ajanın FP kolları ve 18 silah + kaplamaları kullanılıyor.
- Silah R_WeaponPoint'e bağlı; uzun silahlar AK (Vandal) tutuşu, tabanca ve bıçak pistol tutuşu kullanıyor. Silah ekranda sabit bir "kanonik" konuma yerleştiriliyor.
- Sol el, her silahın kendi Left_Hand_Target noktasına IK ile yapışıyor.
- Animasyonlar gerçek oyun durumuna bağlı ve prosedürel: silah çekme, şarjör değiştirme (sol el bırakır), geri tepme, inceleme (Y), bıçak savurma, fare salınımı ve yürüme sallanması.
- Mermi izi ekrandaki namludan gerçek isabet noktasına gidiyor; namlu parlaması Muzzle soketinde.
- Kollar görünmüyordu çünkü kayıtlı ayarlarda "silah modelini göster" kapalıydı; tek seferlik göçle (migration) açıldı.
- **ESC → "Kol / silah ayarı" paneli:** Oyun görünürken silahın konumu/dönüşü/boyutu, silah FOV'u, sol el ofseti ve "silaha yapıştır" ayarı canlı değiştirilebiliyor. Silah bazında kaydediliyor; "Sıfırla" ve "Aynı türe uygula" butonları var.

### Botlar
- Kullanıcının verdiği robot modeli kullanılıyor (trainingbot.glb aslında STL'di; dosyadaki iki figürden biri alındı). Gunmetal boya, kırmızı vizör ve prosedürel panel dokusu var.
- Görünmez hitbox'lar modele göre oturtuldu (kafa / gövde+kollar / bacak). Silaha göre hasar uygulanıyor: Vandal kafadan tek atış, gövde 40, bacak 34.
- Zemine oturtma ve duvardan dışarı itme var. Botlar oyuncuya doğru doğal hızla dönüyor; strafe sırasında duvara girmiyor ve rampaları takip ediyor.
- Hasar alınca parlıyor, tek ölüm koruması var; ön-nişanda isteğe bağlı yeniden doğma.

### Sesler (kullanıcının gönderdiği dosyalar)
- Vandal, Phantom, Guardian, Operator: ateş (tap) dosyaları. Vandal, Phantom ve Operator'da şarjör değiştirme dosyası da var.
- Bıçak: çekme, savurma (ıskalama) ve saplama (isabet).
- Kafa vuruşu sesi ve öldürme serisi (1st, 2nd, 3rd, 4th, ACE) her zaman açık, tüm silahlarda geçerli; ayarlardan kaldırıldı.
- Dosyası olmayan silahlar silaha özel prosedürel seslerle çalışıyor. Skin'e özel ses dosyası yok, bu yüzden varsayılana dönülüyor.
- Victory, Defeat, Spike ve round anonsları tamamen kaldırıldı.
- Spray dosyaları indirildi ancak kullanılmıyor: oyundaki atış zamanlamasıyla senkron değiller, her atış tap dosyasıyla çalınıyor.

### Arayüz ve ayarlar
- Ana menüden Market kaldırıldı.
- Silah menüsü (B) Valorant tarzı: kategori sütunları, büyük dönen 3D silah önizlemesi (seçili kaplamayla), kuşan butonu, istatistik çubukları, hasar tablosu ve kaplama değiştirme.
- ESC menüsü: Oyuna dön, Ayarlar, Kontroller, Antrenman, Kol/silah ayarı, Ana menü, Oyundan çık.
- Varsayılanlar: hassasiyet 0.1, 1600 DPI (sadece referans), nokta nişangâh `0;P;o;1;d;1;f;0;0b;0;1b;0`.
- Ayarlarda çözünürlük (ekranın desteklediği; bozuksa yerel çözünürlüğe döner), tam ekran / kenarlıksız / pencereli mod, efekt ve ses seviyeleri var.
- Kaplama koleksiyonu yalnızca Battle Pass veya yükseltilebilir kaplamalardan oluşuyor; seviyeler bilgi olarak gösteriliyor (projede sadece Seviye 1 dosyaları var).

### Açık kalanlar
- 120 FPS hedefi gerçek donanımda doğrulanmadı (test ortamında ~20–24 FPS).
- Saldırı/savunma spawn bölgeleri harita verisi olmadığı için eklenmedi.
- Harita ışık ve doku kalitesi iyileştirmesi yapılmadı.
- Sesi olmayan silahlar için ses dosyası bekleniyor.

## 2. Devam için prompt (yeni oturuma yapıştır)

```
VAL Aim projesine devam et (/app). Önce /app/memory/SPEC.md ve /app/memory/PROJECT_SUMMARY.md dosyalarını oku.
Mevcut çalışan sistemleri bozma: FP kamera açısı, silah kanonik pozları (src/game/viewmodel.ts POSES), sol el IK,
robot botlar (src/game/trainingBot.ts), ses sistemi (src/game/audio.ts SAMPLES + kill serisi + headshot) ve ESC menüsü korunmalı.
Kurallar: önce ilgili dosyaları incele, sadece gereken değişikliği yap, her değişikliği gerçek oyunda test et,
test etmediğin şeyi bitti diye bildirme. Lisanssız içerik kopyalama. Market ana menüye geri gelmesin, maç/round anons sesleri eklenmesin.
Sıradaki işler:
1) Yeni ses dosyalarını public/sounds/<silah>/{tap,reload,equip}.mp3 olarak ekleyip audio.ts SAMPLES'a bağla.
2) Haritalarda saldırı/savunma spawn noktalarını editörden işaretlenebilir yap.
3) Harita ışıklandırma ve doku kalitesini FPS'i düşürmeden iyileştir.
4) 120 FPS hedefi için performans ölçümü ve optimizasyon yap (render scale ≥ %90).
```
