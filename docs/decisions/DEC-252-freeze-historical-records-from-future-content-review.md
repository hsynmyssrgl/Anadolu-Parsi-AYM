# DEC-252 — Tarihsel kayıtların gelecek içerik denetimlerinden çıkarılması

Durum: ACTIVE

Tarih: 17 Ağustos 2026

## Karar

17 Ağustos 2026 güncel dokümantasyon yenilemesinde yapılan kapsamlı tarama, eski build, arşiv ve checkpoint belgeleri için son ve tek seferlik içerik-okunabilirlik temelidir. Bu temel tamamlandıktan sonra tarihsel belgeler:

- yeniden okunmaz, yeniden render edilmez ve semantik güncellik denetimine sokulmaz;
- yeni karar, kapsam, iş listesi veya tamamlanma gerçeği için kaynak sayılmaz;
- yeni DOCX/PDF içine güncel otorite gibi kopyalanmaz;
- yalnız `HISTORICAL` sınıfında, değişmez ve aktif olmayan kayıt olarak korunur;
- gelecekteki karar-belge eşzamanlılık kapısına dahil edilmez.

Gelecek denetimler yalnız aktif otorite, aktif referans, güncel config/Markdown, DEC/ADR/threat modeli, kaynak kod, test ve yeni kanıtları inceler. Tarihsel kayıtların varlığını belge dizininde sınıflandırmak, içeriklerini tekrar doğrulamak anlamına gelmez.

## Uygulama

- Politika: `config/documentation-synchronization-policy.json`
- Tarama: `scripts/audit-all-project-documents.py`
- Dondurulmuş temel: `artifacts/manifests/ALL_PROJECT_DOCUMENT_FORMAT_AUDIT.json`
- Güncel denetim özeti: `docs/current/12_TUM_BELGE_TURLERI_DENETIMI.md`
- Aktif belge sınıflandırması: `config/active-document-set.json`

## Sınır

Bu karar geçmiş dosyaları silmez veya değiştirilebilir yapmaz. Geçmiş dosya üzerinde yeni çalışma yapılması gerekirse eski dosya düzenlenmez; yeni sürüm ve yeni karar oluşturulur.
