# ADR-018 — Finans ve Sağlık Nesnelerinde Mahremiyet Öncelikli Yetkilendirme

- Durum: Kabul edildi
- Tarih: 27.07.2026
- Build: 133
- Karar: DEC-047

## Bağlam

Finans ve sağlık kayıtları `private`, `selected_members` veya `family` mahremiyet
seviyesi taşımaktadır. Önceki merkezi yetkilendirme motorunda `family_admin`
rolü genel yıldız politikası nedeniyle kayıt mahremiyetinden önce değerlendiriliyor,
bu da aile yöneticisinin başka bir yetişkine ait özel kaydı rol yoluyla görmesine
veya değiştirmesine izin verebiliyordu.

## Karar

Hassas finans ve sağlık nesnelerinde karar sırası şöyledir:

1. Etkin açık ret her şeyden önce uygulanır.
2. `ai_process` yalnız etkin açık nesne izniyle yapılabilir; sahiplik veya rol yeterli değildir.
3. `private` ve `selected_members` kayıtları yalnız veri sahibi veya etkin açık nesne izniyle erişilebilir.
4. `family` kayıtlarında veri sahibi ve açık izinlerden sonra sınırlı rol politikası uygulanabilir.
5. Aile yöneticiliği, özel yetişkin finans/sağlık verisine otomatik erişim sağlamaz.
6. Değerleme gibi alt kayıtlar üst finans kaydının mahremiyetini devralır.
7. Oluşturma sırasında hedef kişinin sahipliği ve seçilen mahremiyet seviyesi birlikte değerlendirilir.

## Rol sınırları

- `family_admin`: yalnız `family` hassas kayıtlarında rol yetkisi; özel/seçili kayıt için açık izin gerekir.
- `adult_member`: aile görünürlüklü finans ve sağlık kayıtlarını okuyabilir; kendi kayıtlarında sahiplik yetkisi vardır.
- `caregiver`: aile görünürlüklü sağlık kaydı, ilaç planı ve aile sağlık geçmişini okuyabilir.
- `advisor`: aile görünürlüklü finans kaydı ve değerlemeyi okuyabilir.
- `limited_member`: hassas aile kayıtlarına varsayılan rol erişimi yoktur.

## Sonuçlar

Bu karar veri sahibinin mahremiyetini yönetici rolünden üstün tutar. Açık izin ve
ret kayıtlarının süreleri korunur. Genel yetkilendirme davranışı hassas olmayan
kaynaklarda değişmez.
