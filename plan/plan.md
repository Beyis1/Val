# VAL Aim — Valorant Temalı Tarayıcı Nişan Antrenmanı (Güncel Plan)

Tarayıcıda çalışan, ishoutu.cn/aim örnek alınarak yapılan 3D bir Valorant nişan antrenmanı. Gerçek Valorant haritalarında rakipler gerçek ajan modelleriyle karşınıza çıkıyor. Siz ise birinci şahıs görünümde ajan kollarıyla ve gerçek silah modelleriyle oynuyorsunuz.

## Kimin için
Windows ve Opera üzerinde aim çalışan tek bir Valorant oyuncusu için. Giriş ekranı ve topluluk paylaşımı yok; tüm veriler uygulamanın sunucusunda tutuluyor.

## Temel özellikler ve deneyim

**Haritalar**
- Drive klasöründeki 11 harita kullanılıyor: Abyss, Ascent, Bind, Breeze, Fracture, Haven, Icebox, Lotus, Pearl, Split ve Sunset.
- Haritalar tarayıcıda açılacak şekilde dönüştürülüyor. Bu işlemde dokular küçültülüyor ve detay azaltılıyor.
- Ascent dönüştürüldü ve kontrol edildi: dosya boyutu yaklaşık 19 MB, mini harita gerçek düzeni gösteriyor. Diğer 10 harita aynı yöntemle işleniyor. Sorun çıkaran harita olursa ayrıca bildirilecek.
- Bunlara ek olarak Valorant Range tarzı hazır antrenman odaları var.

**Rakipler (yeni)**
- Botlar Kingdom Archives'taki gerçek ajan modelleri. Havuzda 8 ajan var: Jett, Reyna, Phoenix, Sage, Omen, Sova, Killjoy ve Raze. Her bota rastgele biri atanıyor.
- Kafa, gövde ve bacak isabet bölgeleri her ajanın vücuduna göre ayarlanıyor. Hasar bu bölgelere göre hesaplanıyor.
- Botlar duruyor, eğiliyor, sağa sola strafe atıyor ve köşeden peek atıyor. Vurulunca düşüyor.

**Birinci şahıs (yeni)**
- Ekranda seçilen ajanın birinci şahıs kolları ve elinde kuşanılmış silah görünüyor.
- Kollar Ayarlar'dan herhangi bir ajan olarak seçilebiliyor. Varsayılan Jett.

**Silahlar ve kaplamalar (yeni)**
- Tüm silah modelleri Kingdom Archives'tan alınıyor. Bıçak ve Spike modeli de buradan geliyor.
- İstenirse bir silah için kendi GLB dosyanızı yükleyerek arşiv modelini değiştirebiliyorsunuz.
- Atış hızı, hasar, şarjör ve koşu hızı değerleri tüm silahlarda Valorant'a yakın. Zırh, hasarın %66'sını emiyor.

**Hareket**
- WASD, zıplama, eğilme ve yavaş yürüme var. F tuşu kullanma tuşu olarak çalışıyor.
- Haritalarda duvar ve zemin çarpışması bulunuyor.
- Sağ tıkla nişan alınıyor; bas-bırak ya da basılı tut seçilebiliyor. Operator'da dürbün var.

**Senaryo türleri**
- Haritada oynananlar:
  - Ön-nişan rotası: yol boyunca saklanan botları temizleme
  - Açı tutma
  - Süreli Spike senaryosu: botlar temizlenir, ardından Spike F ile imha edilir
- Hazır aim modları: Gridshot, Flick, Tracking ve Strafe Bot.
- Botların ateş açıp açmayacağı her senaryoda ayrı seçiliyor. Botlar ateş açıyorsa can ve zırh devreye giriyor; ölünce tur bitiyor.

**Atölye (senaryo kütüphanesi)**
- Senaryolar haritaya göre gruplanmış kartlarda duruyor.
- Kartta harita görseli, kişisel en iyi skor, zorluk (Kolay / Orta / Zor), tür etiketi ve oynanma sayısı var.
- Harita, "oynanmadı" ve "favoriler" filtreleri, arama ve Önerilen / Popüler / En yeni sıralaması bulunuyor.
- Hazır senaryolarla birlikte geliyor.

**Atölye editörü**
- Haritayı seçip içinde dolaşarak senaryo kuruluyor.
- Başlangıç noktası, botlar ve Spike yeri yerleştiriliyor.
- Her bot için duruş, hareket, can ve ateş açma seçiliyor.
- Senaryo için süre, zorluk, açıklama ve izin verilen silahlar belirleniyor.
- Senaryo kaydediliyor, düzenleniyor, siliniyor ve hemen denenebiliyor.

**Senaryo açılışı**
- Önce harita görseli, mini harita, senaryo adı ve açıklaması gösteriliyor.
- Ardından "Başlamak için tıkla" ekranı geliyor; süre ve kuşanılmış silah burada görünüyor.

**Oyun içi ekran**
- Sol üstte mini harita var. Boyutu, yakınlığı, yönle dönmesi ve botların gösterilmesi ayarlanabiliyor.
- Üstte skor ve süre, altta mermi, can ve zırh göstergeleri yer alıyor.
- Ateş, isabet ve öldürme sesleri çalıyor.
- Kısayollar: TAB menü, B market, R şarjör değiştirme, 1/2/3 silah değiştirme, Esc duraklatma.

**Market (B tuşu)**
- Yalnızca silah ve zırh alınıyor. Düzen Valorant satın alma menüsündeki gibi; kredi yok, her şey açık.
  - Tabanca: Classic, Shorty, Frenzy, Ghost, Sheriff
  - SMG: Stinger, Spectre
  - Pompalı: Bucky, Judge
  - Tüfek: Bulldog, Guardian, Phantom, Vandal
  - Keskin Nişancı: Marshal, Outlaw, Operator
  - Makineli: Ares, Odin
  - Zırh: Hafif, Yenilenen, Ağır
- Kartlarda atış hızı ve şarjör yazıyor.
- Sağdaki detay panelinde koşu hızı, şarjör değiştirme süresi ve mesafeye göre kafa/gövde/bacak hasarı gösteriliyor.
- Bir silaha tıklayınca hemen kuşanılıyor; "Varsayılan" ile geri dönülüyor.

**Kaplama penceresi (yeni, marketten ayrı)**
- Her silah için arşivdeki kaplamalar listeleniyor (örneğin Vandal için Prime, Black.Market, Sakura ve diğerleri). Seçilen kaplama oyunda o silahın görünümü oluyor.
- Silahın ekrandaki yönü, boyutu ve konumu buradan ayarlanıyor.
- GLB yükleme alanı da bu pencerede.
- Oyun dışında sol menüden, oyun içinde ise duraklatma ve TAB menüsünden açılıyor.

**Anons sesleri (yeni)**
Arşivden yalnızca senaryo olaylarına uyan anonslar kullanılıyor:
- Spike kuruldu
- Spike imha edildi
- Spike patlamak üzere
- Raund kazanıldı / kaybedildi
- Son düşman kaldı

Diğer anonslar eklenmiyor.

**Kayıtlar**
- Her turun skoru, isabet oranı, kafa vuruşu oranı, gerçek ölçülen tepki süresi, öldürme sayısı ve süresi tutuluyor.
- Senaryo ve moda göre gelişim grafiği, en iyi skorlar ve toplam istatistikler gösteriliyor.

**Ayarlar (referanstaki düzen)**
Üstte arama kutusu, sağda değişikliği anında gösteren canlı önizleme var. Her değişiklik otomatik kaydediliyor. Sekmeler:
- Genel: Valorant ile birebir hassasiyet; nişan ve dürbün çarpanları; nişan alma şekli; mini harita; yazı okunabilirliği; birinci şahıs ajanı
- Kontrol: tüm tuşlar için ana ve yedek atama; varsayılana döndürme
- Nişangah: ana, nişanlı ve dürbün nişangahı; renk, dış çizgi, merkez nokta, iç/dış çizgiler; hazır nişangahlar; yakınlaştırılmış önizleme; Valorant nişangah kodu içe/dışa aktarma
- Görüntü: görüş açısı (FOV), grafik kalitesi, kare hızı sınırı
- Ses: ateş, isabet ve öldürme sesi seçenekleri; ana ses seviyesi
- Antrenman alanı: hazır odaların hedef ve bot ayarları

**Dil**
TR/EN seçimi var ve tercih kaydediliyor.

**Performans (yeni)**
- Hedef her haritada ve modda en az 120 FPS. Görüntü kalitesi gözle görülür biçimde düşürülmüyor.
- Çözünürlük ölçeği varsayılan olarak %100.
  - FPS 120'nin altına inerse ölçek kendiliğinden düşüyor, ama en fazla %90'a kadar; daha aşağı inmiyor.
  - FPS toparlanınca ölçek tekrar %100'e çıkıyor.
  - Ayarlar > Görüntü'den otomatik ölçek kapatılabiliyor veya ölçek %90–100 arasında elle sabitlenebiliyor.
- Modeller bu hedefe göre optimize ediliyor; harita, ajan, kol, silah ve kaplamaların hepsi kapsamda:
  - Yakındaki nesneler tam detayda kalıyor. Uzaktakiler ve harita dışındaki arka plan yapıları sadeleştiriliyor.
  - Aynı nesneler tek seferde çiziliyor; ekranda görünmeyen kısımlar hiç çizilmiyor.
  - Dokular ekran kartı belleğinde az yer kaplayan sıkıştırılmış biçimde tutuluyor. Haritalarda doku keskinliği korunuyor.
  - Rakip ajanların uzaktan daha hafif bir sürümü kullanılıyor. Kolların ve silahların modeli tam detayda kalıyor.
- Oyun içinde FPS sayacı gösterilebiliyor. Kare hızı sınırı Ayarlar'dan seçiliyor: sınırsız, 144, 165, 240.
- Her harita, en kalabalık senaryo düzeninde (bütün botlar ekranda) FPS açısından ölçülüyor. Hedefi tutturamayan harita, ayrıntısıyla birlikte size bildiriliyor.

## Kullanıcı akışı
1. Uygulama Atölye ile açılır. Harita filtresiyle senaryo seçilir; isteğe göre favorilere eklenir.
2. Senaryo açılışında harita görseli, mini harita ve açıklama görülür, ardından "Başlamak için tıkla"ya basılır. Oyun tam ekrana geçer.
3. Oyun sırasında B ile silah değiştirilir. Kaplama ise duraklatma veya TAB menüsünden seçilir.
4. Tur bitince sonuç ekranında skor, isabet, kafa vuruşu, tepki süresi ve varsa yeni rekor görünür. Buradan tekrar oynanır ya da Atölye'ye dönülür.
5. Kayıtlar sekmesinden gelişim izlenir; Ayarlar'dan hassasiyet, nişangah ve tuşlar düzenlenir.
6. Atölye Editörü'nde haritada dolaşılarak yeni senaryo kurulur, denenir ve kaydedilir.

## Arayüz hissi
- Referans siteyle aynı düzen: siyah-lacivert zemin ve Valorant kırmızısı vurgular. Hassasiyet ve ölçüm değerleri mavi. Başlıklar büyük ve kalın, paneller keskin köşeli.
- Üstte Atölye / Kayıtlar / Ayarlar sekmeleri, sağ üstte hassasiyet hızlı ayarı var.
- Sol kenarda Favoriler, Atölye Editörü, Kaplamalar ve Güncellemeler bulunuyor.
- Market ve kaplama penceresi oyunun üstünde yarı saydam açılıyor; Valorant'taki satın alma ekranı hissi veriyor.
- İsabet işareti, öldürme bildirimi ve hasar uyarısı kısa ve net animasyonlarla gösteriliyor.

## Uygulama aşamaları

**Faz 1 — şimdi yapılacak (MVP)**
- Referans düzende Valorant temalı arayüz ve TR/EN dil desteği
- 11 Drive haritasının dönüştürülmesi ve hazır antrenman odaları
- Yürüme, zıplama, eğilme ve çarpışmalı birinci şahıs oynanış
- Seçilebilir ajan kolları (varsayılan Jett)
- Arşivden 8 ajanlık rastgele rakip havuzu
- Ön-nişan, açı tutma ve Spike senaryoları; Gridshot, Flick, Tracking ve Strafe Bot
- Ateş açan veya açmayan botlar; can ve zırh
- Atölye kütüphanesi, hazır senaryolar ve senaryo editörü
- Kredisiz market; tüm silahlar arşivden, detay paneli
- Ayrı kaplama penceresi; GLB ile model değiştirme
- Senaryo olaylarına uygun anons sesleri
- Kayıtlar sayfası; tüm ayar sekmeleri, canlı önizleme ve nişangah kodu
- 120 FPS hedefli optimizasyon: %90 tabanlı otomatik çözünürlük ölçeği, model ve doku optimizasyonu, FPS sayacı
- Faz 1 bitince önizleme bağlantısı paylaşılıyor; her şeyi kendiniz deneyebiliyorsunuz. Hangi haritaların ve modellerin eklendiği ve hangilerinin sorun çıkardığı da bu sırada bildiriliyor.

**Faz 2 — sonra**
- Rakip havuzunun 28 ajanın tamamına çıkarılması ve havuzun ayarlardan seçilebilmesi
- Botlar için koşma, peek ve ölüm animasyonları
- Senaryo başına bot zorluk profilleri

**Faz 3 — daha sonra**
- Referanstaki "Oyuncu Atölyesi" (topluluk paylaşımı)
- Hesap/giriş
- Masaüstü sürüm
- Gecikme testi

## Varsayımlar
- Ajan, kol, silah, kaplama, bıçak, Spike ve anons dosyaları yapım sırasında Kingdom Archives'tan bir kez indiriliyor, kontrol ediliyor ve küçültülüyor. Oyun bu dosyaları uygulamanın kendi sunucusundan yüklüyor; oynarken arşive bağlanmıyor.
- Her model tek tek kontrol ediliyor: açılıyor mu, ölçek ve yön doğru mu, isabet bölgeleri oturuyor mu. İndirilemeyen ya da bozuk çıkan model ayrıca bildirilecek. Onun yerine o silahın varsayılan modeli kullanılacak, varsayılan da bozuksa sade bir yedek model.
- Kaplamalar ve ajan kolları ilk seçildiklerinde yükleniyor; oyunun açılış süresi bundan etkilenmiyor.
- Arşivdeki ajan modellerinin hazır hareket animasyonu olmayabilir. Bu durumda botlar ajanın kendi duruşunda görünüyor ve kayarak hareket ediyor; ateş ederken namlu parlaması ve ses geliyor. Gerçek animasyonlar Faz 2'de.
- Anonslar, arşivde varsa seçili dilde çalıyor; yoksa İngilizce.
- Varsayılan donanım Vandal + Classic + Ağır zırh. "Varsayılan" düğmesi bu donanıma döndürüyor.
- Eğilme tuşu varsayılan olarak Sol Ctrl, yedeği C. Oyun tam ekranda tuşları yakaladığı için Ctrl+W sekmeyi kapatmıyor.
- Haritalardaki hazır senaryoların başlangıç noktaları ve bot yerleri, haritanın yürünebilir alanından otomatik seçiliyor. Editörde istenildiği gibi değiştirilebiliyor.
- 120 FPS hedefi, Valorant'ı yüksek ayarlarda rahatça açan bir oyun bilgisayarı için geçerli (1080p, güncel Opera, donanım hızlandırma açık). FPS, sunucuya değil sizin bilgisayarınıza bağlı. Önizleme ortamında haritaların ilk indirilmesi daha yavaş olabilir; bu kare hızını etkilemiyor.
- Opera'da "donanım hızlandırma" kapalıysa veya batarya tasarrufu açıksa FPS düşük kalır. Uygulama bu durumu fark edip uyarı gösteriyor.
- Haritalar, ajanlar, silahlar ve sesler Riot Games'e ait oyun içerikleri. Uygulama kişisel kullanım için; herkese açık yayınlanması hak sorunu doğurabilir.
