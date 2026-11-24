# Site dosyalarını derleme

Hosting Node.js gerektirmez. HTML sayfaları, yerel görseller ve derlenmiş statik dosyalar normal şekilde yayınlanır.

Kaynak CSS ve JavaScript dosyaları saklanır. Sayfalar `css/site.min.css` dosyasını ve gerektiği yerde ilgili küçük JavaScript dosyasını yükler:

- Bütün sayfalar: `js/site.min.js` — üst menü ve sabit başlık.
- Ana sayfa: ayrıca `js/approaches.min.js` — sürekli dönen slider.
- İletişim sayfası `js/contact.min.js` ve `js/vendor/emailjs-5.0.2.min.js` kullanır. EmailJS Browser SDK, resmi `@emailjs/browser@5.0.2` paketinden alınmıştır. Lisansı `js/vendor/emailjs-LICENSE.txt` dosyasındadır.

CSS, JavaScript veya HTML sınıfları değiştirildiğinde proje kökünde:

```sh
npm ci
npm run build:assets
```

Derleyici, site haritasındaki 10 sayfa ve 404 sayfasını birlikte tarar. Menü durumları, form durumları ve sertifika/eğitim kartlarının sınıfları korunur. CSS değişkenleri ve font tanımları kaldırılmaz. CSS içindeki göreli dosya yolları birleştirme sırasında doğru kök adreslerine çevrilir.

Yayınlarken üretilen `css/site.min.css`, `js/site.min.js`, `js/approaches.min.js` ve `js/contact.min.js` dosyalarıyla birlikte `js/vendor` dizinini yükleyin. Değişen dosyaların tarayıcı önbelleğinde kalmaması için HTML içindeki `?v=` sürümünü güncelleyin. `node_modules` klasörünü hosting'e yüklemek gerekmez.

Derleme sonrasında ana sayfa, mobil menü, slider, SSS, eğitim kartları ve iletişim formunun görünümü/etkileşimi kontrol edilmelidir. Klinik metinlerdeki esaslı güncellemelerde, görünür güncelleme tarihi ile Article/WebPage `dateModified` alanları aynı gerçek tarihi göstermelidir. Uzman incelemesi yapılmadan inceleme yapıldığı belirtilmemelidir.
