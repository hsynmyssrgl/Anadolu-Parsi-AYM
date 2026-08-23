import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
const center = app.slice(app.indexOf('function PrivacyOwnershipCenter()'), app.indexOf('function SettingsSecurity('));

describe('33-O privacy ownership and data rights UI', () => {
  it('extends the existing security route without creating a competing route or menu item', () => {
    expect(app).toContain('active === SECURITY_CENTER_ROUTE');
    expect(app).toContain('Gizlilik, Sahiplik ve Olay Kontrol Merkezi');
    expect(app.match(/<PrivacyOwnershipCenter\/>/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'privacy-ownership'");
  });

  it('renders all governed local-observation sections and explicit claim boundaries', () => {
    for (const heading of ['Tutulan veri','AI hafıza denetimi','Erişim geçmişi','Cihaz ve yerel işleme gözlemi','Veri hakları, saklama ve şifreli dışa aktarım','Türetilmiş veri zinciri','Olay ve yerel sınırlama','Karşı taraf izin simülasyonu']) {
      expect(app).toContain(`<h3>${heading}</h3>`);
    }
    for (const boundary of ['Uzaktan silme, MDM, ağ teslimi, uzak durum veya hukuk/gizlilik sertifikasyonu iddiası yoktur.','Güvenilir cihaz, açık oturum anlamına gelmez.','Yalnız yerel olarak gözlenen','dış kopya silme garantisi yok','İçerik gösterilmez','yetki oluşturmaz, erişim yapmaz']) expect(app).toContain(boundary);
  });

  it('uses governed async states, retry-stable operation IDs, revision CAS and pending locking', () => {
    expect(app).toContain('AsyncStatePanel state="loading" title="Gizlilik ve sahiplik merkezi yükleniyor"');
    expect(app).toContain('AsyncStatePanel state="error" title="Gizlilik merkezi yüklenemedi"');
    expect(app).toContain('AsyncStatePanel state="empty" title="Gizlilik merkezi boş"');
    expect(app).toContain('pendingOperations.current.get(key)??');
    expect(app).toContain('expectedRevision:revision');
    expect(app).toContain('Aynı işlem kimliği ve özgün revizyonla yeniden deneyebilirsiniz.');
    expect(app).toContain("if(busy)return");
    expect(center).toContain("allowedPurposes:['general']");
    expect(center).toContain('const targetId=center.key.accountId');
    expect(center).toContain("actions:[{action:'revoke_local_session_authority',targetId}]");
    expect(center).toContain("purpose:'general'");
    expect(center).not.toContain("purpose:'owner_review'");
  });

  it('eksik saklama tarihi ile istek gondermez ve oturum kapatan olayi acik onaya baglar', () => {
    expect(center).toContain('disabled={Boolean(busy)||!retentionUntil}');
    expect(center).toContain('Önce saklama bitiş zamanını seçin.');
    expect(center).toContain("if(!confirm('Bu işlem yerel inceleme kaydını açar, mevcut oturumu kapatır ve yeniden giriş gerektirir. Devam edilsin mi?'))return;");
    expect(center).toContain('Yerel inceleme kaydı açıldı; mevcut oturum kapatıldı.');
  });

  it('creates both governed export request kinds with exact current-owner scopes and auto-selects an active request', () => {
    expect(center).toContain("createExportRequest('encrypted_export')");
    expect(center).toContain("createExportRequest('legacy_export')");
    expect(center).toContain("scopeResourceType:kind==='legacy_export'?'digital_legacy':'privacy_inventory'");
    expect(center).toContain('scopeResourceId:center.key.ownerPersonId');
    expect(center).not.toContain("scopeResourceId:'current'");
    expect(center).toContain('setExportRequestId(result.resourceId)');
    expect(center).toContain('active.some(item=>item.id===current)?current:active[0]?.id');
    expect(center).toContain('<select value={exportRequestId}');
    expect(center).toContain('Arşiv ikili dosyaları, sahipliği kesin bağlanamayan aile etkinlikleri ve açıkça seçilmemiş form taslakları dahil edilmez.');
  });

  it('shows category and record totals and exposes inventory expansion state accessibly', () => {
    expect(center).toContain('reduce((total,item)=>total+item.recordCount,0)');
    expect(center).toContain('toplam {inventoryRecordCount} yerel kayıt');
    expect(center).toContain('id="privacy-data-inventory-list"');
    expect(center).toContain('aria-expanded={inventoryExpanded}');
    expect(center).toContain('aria-controls="privacy-data-inventory-list"');
  });

  it('consumes rights and incident update APIs through truthful local workflow actions', () => {
    expect(center).toContain('updatePrivacyRightsRequest({...operation,requestId:request.id,status');
    expect(center).toContain("updateRightsRequest(item,'in_review')");
    expect(center).toContain("updateRightsRequest(item,'locally_completed')");
    expect(center).toContain('harici kopya fiziksel silme veya ağ üzerinden teslim garantisi verilmez');
    expect(center).toContain('updatePrivacyIncident({...operation,incidentId:incident.id,status');
    expect(center).toContain("updateIncident(item,'contained_locally')");
    expect(center).toContain("updateIncident(item,'resolved')");
    expect(center).toContain('uzaktan silme, cihaz yönetimi veya ağ üzerinden teslim yapılmadı');
  });

  it('clears the export passphrase after both success and failure and refreshes completed-request selection', () => {
    expect(center).toContain("finally{setExportPassphrase('');setBusy('');}");
    expect(center).toContain("exportEncryptedPrivacyData({requestId:exportRequestId,passphrase:exportPassphrase});await load();");
    expect(center).not.toContain('result.filePath');
  });
});
