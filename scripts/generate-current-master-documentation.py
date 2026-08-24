from __future__ import annotations

import hashlib
import html
import json
import re
import subprocess
from collections import Counter
from pathlib import Path
from zipfile import ZipFile

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    CondPageBreak,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
AS_OF = "24.08.2026"
VERSION = "GUNCEL-2026-08-24-V5"
SOURCE = ROOT / "docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md"
DOCX_OUT = ROOT / "docs/current/MASTER_PROJE_DOKUMANTASYONU_GUNCEL_24.08.2026_V5.docx"
PDF_OUT = ROOT / "docs/current/MASTER_PROJE_DOKUMANTASYONU_GUNCEL_24.08.2026_V5.pdf"
LOGO = ROOT / "apps/desktop/src/renderer/assets/brand-mark.png"

BRONZE = "7C4D20"
BRONZE_LIGHT = "F5EEE7"
GOLD = "D5A526"
GREEN = "467259"
INK = "333537"
MUTED = "666B69"
RED = "A33A3A"
BLUE_GRAY = "E8EEF5"


def read_json(path: str):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def read_text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def first_heading(path: Path) -> str:
    for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return path.stem


def status_from_markdown(path: Path) -> str:
    for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        normalized = line.replace("**", "").strip()
        match = re.match(r"^(?:[-•]\s*)?(?:Durum|Status)\s*:\s*(.+)$", normalized, flags=re.I)
        if not match:
            continue
        value = match.group(1).strip().strip("`").strip()
        if ". " in value:
            value = value.split(". ", 1)[0].strip()
        value = value.replace("`", "").strip()
        return value or "KAYITLI"
    return "KAYITLI"


def decision_number(path: Path) -> int:
    match = re.match(r"DEC-(\d+)", path.name)
    return int(match.group(1)) if match else 9999


def adr_number(path: Path) -> int:
    match = re.match(r"ADR-(\d+)", path.name)
    return int(match.group(1)) if match else 9999


def git_head() -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()


def get_requirement_counts(registry: dict) -> dict[str, int]:
    return dict(Counter(item.get("status", "UNKNOWN") for item in registry["requirements"]))


def scan_existing_word_pdf() -> list[dict]:
    rows = []
    excluded = {DOCX_OUT.name, PDF_OUT.name}
    for path in sorted((ROOT / "docs/current").iterdir()):
        if path.name in excluded or path.suffix.lower() not in {".docx", ".pdf"}:
            continue
        row = {"name": path.name, "type": path.suffix.lower()[1:], "bytes": path.stat().st_size, "readable": True}
        try:
            if path.suffix.lower() == ".pdf":
                reader = PdfReader(str(path))
                row["pages"] = len(reader.pages)
                row["characters"] = sum(len(page.extract_text() or "") for page in reader.pages)
            else:
                document = Document(path)
                row["paragraphs"] = len(document.paragraphs)
                row["tables"] = len(document.tables)
                with ZipFile(path) as archive:
                    app_xml = archive.read("docProps/app.xml").decode("utf-8", errors="ignore")
                    pages = re.search(r"<Pages>(\d+)</Pages>", app_xml)
                    if pages:
                        row["pages"] = int(pages.group(1))
        except Exception as error:  # pragma: no cover - audit-only branch
            row["readable"] = False
            row["error"] = str(error)
        rows.append(row)
    return rows


ledger = read_json("config/active-governance-ledger.json")
rules = read_json("config/canonical-rule-registry.json")
constitution = read_json("config/project-constitution.json")
requirements = read_json("config/accepted-scope-registry.json")
roadmap = read_json("config/remaining-scope-package-roadmap.json")
visual = read_json("config/ui-visual-reference-manifest.json")
closure = read_json("config/34-l-bronze-final-drift-deterministic-delivery-closure-scope.json")
windows_scope = read_json("config/34-k-windows-resilience-universal-ux-scope.json")
document_index = read_json("artifacts/manifests/ALL_DOCUMENTS_INDEX.json")
full_document_audit = read_json("artifacts/manifests/ALL_PROJECT_DOCUMENT_FORMAT_AUDIT.json")
user_decisions = read_json("config/user-decision-ledger.json")
requirement_counts = get_requirement_counts(requirements)
decision_files = sorted((ROOT / "docs/decisions").glob("DEC-*.md"), key=decision_number)
adr_files = sorted((ROOT / "docs/adr").glob("ADR-*.md"), key=adr_number)
threat_files = sorted((ROOT / "docs/security").glob("*.md"))
word_pdf_scan = scan_existing_word_pdf()
readable_count = sum(1 for row in word_pdf_scan if row["readable"])
historical_pairs = len(word_pdf_scan) // 2


WORKFLOWS = [
    ("Karar ve kural değişikliği", "Açık kullanıcı kararı → aynı değişiklikte DEC kaydı + makine defteri + etkilenen aktif belgeler + iş listesi açık/kapalı/neden alanları → etki analizi → gerekiyorsa kanonik kural/scope ve kod → doğrulama → indeks/master DOCX/PDF. Eşzamanlılık eksikse karar veya iş tamamlandı sayılamaz; sessiz istisna ve waiver yoktur."),
    ("Paket yürütme", "Aynı anda tek paket/adım IN_PROGRESS olabilir. Paket, yerel PASS üretse bile dış ve manuel kabul kanıtı eksikse açık kalır. Sonraki paketin başlaması, öncekinin kalıcı receipt ve kabul koşullarına bağlıdır."),
    ("Yetkilendirilmiş işlem", "Oturum kimliği + hesap + kişi + aile + cihaz + güvenlik epoch + amaç + kaynak + hassasiyet merkezi PEP tarafından değerlendirilir; receipt/UoW/optimistic revision/audit/outbox aynı yönetilen işlem sınırında korunur."),
    ("Veri yaşam döngüsü", "Kaynak sınıflandırma → sahiplik ve saklama → erişim/işleme gözlemi → türetilmiş veri mirası → geri alınabilir silme → kaynak silme yayılımı → içeriksiz tombstone → yedek/haricî kopya için açık risk. Fiziksel güvenli silme garantisi verilmez."),
    ("Kimlik ve cihaz", "Passkey challenge ve doğrulama → cihaz/epoch bağlama → kayıp anahtar kurtarma → yerel oturum iptali. Federated kimlik yalnız yapılandırılmış ve güvenilen sağlayıcı/JWKS/ağ zinciriyle görünür; gerçek sağlayıcı testi yoksa PASS yoktur."),
    ("Yerel OCR", "Archive kaynağı PEP + ayrı hassas işleme rızası → main-only byte okuma → bounded child process → malware kapısı → sealed sonuç kasası → düzeltme/rerun lineage → source deletion propagation. PDF/malware/low privilege eksikleri fail-closed kalır."),
    ("İletişim", "Kimlik/politika → MLS/E2EE oturum → içerikten ayrı audit → mesaj/dosya yaşam döngüsü → çağrı preflight → açık kayıt rızası → medya retention → çeviri/altyazı. Gerçek provider/cihaz/ağ UAT olmadan üretim iddiası yoktur."),
    ("Dağıtık çalışma", "Windows tek-yazar yerel veri otoritesi → mutation log → node kimliği/mTLS → quorum/witness → snapshot/failover → istemci API/cache → operasyon ve DR. Yerel simülasyon gerçek çoklu node kanıtı değildir."),
    ("Windows teslim", "Governed preflight → typecheck/test/build → Electron fuse/ASAR doğrulama → imzalama/provenance → installer → kurulu uygulama açılışı → update/rollback → uninstall/residue → postflight. Sertifika veya lifecycle UAT eksikse dağıtım hazır sayılmaz."),
    ("Belge güncelleme", "Canlı kaynak ve JSON sicilleri taranır → açık/kapalı/neden matrisi güncellenir → Markdown tek kaynak oluşturulur → DOCX/PDF aynı veriden üretilir → bütün sayfalar render edilir → hash manifesti yenilenir → tarihsel belgeler korunur."),
]


INFRASTRUCTURE = [
    ("Platform Policy Kernel", "Fail-closed merkezi karar; doğrudan rol kontrolü yeni kodda yasak; receipt/UoW/audit/outbox bağları."),
    ("Windows Desktop", "Electron main güvenlik otoritesi, preload exact bridge, renderer yetkisiz sunum katmanı, korumalı yerel secret/artifact sınırları."),
    ("Core Service", "Ayrı Electron utility companion süreci, sürümlü typed API, CurrentUser DPAPI korumalı provisioning, her açılışta yeni local named-pipe/token ve içeriksiz lifecycle protokolü; aile verisi/SQLite sahipliği Desktop'ta kalır, Windows Service/cluster kabulü ayrıca gerekir."),
    ("Veri katmanı", "Şifreli yerel SQLite, migration/trigger/optimistic revision/idempotency, append-only mutation/audit, source-deletion lineage."),
    ("Kimlik", "Passkey, bounded challenge, lost-key recovery, trusted OIDC+PKCE/JWKS/vault, temporary credential, companion snapshot temelleri."),
    ("OCR", "PEP-authorized archive read, bounded child process, malware fail-closed, sealed result vault, correction lineage ve purge."),
    ("İletişim", "MLS/E2EE metadata/payload sınırları, messaging, presence, calling, recording consent, translation, meetings, file sharing, archive audit."),
    ("Dağıtık platform", "Mutation/consensus/tenancy, distributed clients/operations/DR ve Windows resilience için local hardened foundation."),
    ("Görsel sistem", "Onaylı sıcak-nötr açık tema, exact release colors, 512 px sıcak-bronz logo, merkezi typography/accessibility tokenları."),
    ("Belge yönetişimi", "DEC-251 eşzamanlı karar-belge-iş listesi kapısı; tüm belge türü hash/okunabilirlik denetimi; tarihsel kayıtların değişmezliği."),
    ("Marka ve kurumsallaşma", "DEC-261 ile ana marka ParsYuva, görünür ürün ParsYuva Aile Yaşam Merkezi; AYM yalnız tarihsel ve zorunlu teknik uyumluluk kimliklerinde korunur. Şirket, marka, alan adı, hukuk/vergi/gizlilik ve mağaza kanıtları NOT_RUN iken tamamlanmış gösterilmez."),
]


EXTERNAL_DEPENDENCIES = [
    ("Üretim sertifikası ve provenance", "Authenticode/kod imzalama sertifikası, güvenilir zaman damgası ve üretim provenance kanıtı yoksa installer yayıma hazır sayılamaz."),
    ("Gerçek cihaz ve sağlayıcı UAT", "Passkey/authenticator, Windows cihazları, kamera/mikrofon, Matter, OCR/AI/çeviri, OIDC, WebRTC/SFU/TURN, bulut/kurum bağlantıları ve Apple istemcileri gerçek ortamda sınanmalıdır."),
    ("Gerçek dağıtık sistem", "En az gerçek çoklu node, quorum/witness, mTLS, ağ bölünmesi, failover, snapshot ve felaket kurtarma provası gerekir."),
    ("Uzun süreli işletim", "168 saat soak, yeniden başlatma, güç kesintisi, disk doluluğu, saat değişimi, uyku/uyanma ve güncelleme/rollback kanıtları gerekir."),
    ("Hukuk ve gizlilik", "Saklama/imha süreleri, çocuk/sağlık/iletişim kaydı, delil niteliği, sağlayıcı sözleşmeleri ve ülke bazlı yükümlülükler uzman incelemesi olmadan ürün gerçeği olarak sunulamaz."),
    ("İnsan ve erişilebilirlik UAT", "Narrator, büyütme, klavye, contrast, metin taşması, çocuk/yetişkin/ileri yaş/bakım veren profilleri ve gerçek kritik akışlar insanlarla doğrulanmalıdır."),
]


DRIFT_FIXES = [
    "Aktif kapsam toplamı 344 → 358 olarak düzeltildi ve durum dağılımı eklendi.",
    "Kanonik kural sicili V10/214/194 ve güncel SHA ile ParsYuva marka, kurumsallaşma, platform ve belge sınıflandırma kurallarına yükseltildi.",
    "Kullanıcı karar defteri 83 kayda yükseltildi; DEC-254 marka uyumluluğu ve kurumsallaşma kararını bağladı.",
    "Platform mimarisindeki 'OCR/iletişim başlamadı' anlatımı yerel bileşim var fakat kabul dış kanıta bağlı şeklinde düzeltildi.",
    "Yol haritasına her açık paket için yerel uygulama durumu, açık kalma nedeni, eksik kanıt ve requirement PASS alanları eklendi.",
    "Görsel sözleşme 17 px body, exact Bronze/Silver/Gold tokenları ve onaylı 512 px sıcak-bronz logo SHA'sıyla hizalandı.",
    "Geçici .tmp/.tmp-runtime-dist içeriğinin aktif belge envanterine girmesi engellendi.",
    "Build209–228 ve eski Bronze master çiftleri tarihsel olarak korundu; yeni sürüm ayrı adla oluşturuldu.",
    "Word/PDF dışındaki RTF, Markdown, JSON/YAML, TXT, CSV ve HTML kayıtları da kök klasör düzeyinde hash ve okunabilirlik denetimine alındı; Excel/PowerPoint bulunmadığı açıkça kaydedildi.",
    "Her yeni kararın DEC, makine defteri, etkilenen belgeler ve açık/kapalı iş gerekçeleriyle aynı değişiklikte güncellenmesi fail-closed kurala bağlandı.",
    "Bu kapsamlı tarama tarihsel kayıtların son içerik temelidir; DEC-252 gereği gelecekte eski build/arşiv/checkpoint içeriği yeniden denetlenmeyecek, yalnız değişmez HISTORICAL kayıt olarak korunacaktır.",
    "Core Service companion ASAR paketine bağlandı; güncel tam regresyonda 350/350 test dosyası ve 2187/2187 test, root typecheck/build ve aynı profilde iki ardışık normal win-unpacked açılışı PASS verdi. Production Authenticode sertifikası bulunmadığından signed installer/kurulu yaşam döngüsü açık bırakıldı.",
    "EK-001–EK-019 tarihsel karar tamponu DEC-260 ile ana sicillere bağlandı; daha yeni ParsYuva, dil ve kurulum kararları çatışmada üstün tutuldu.",
    "Kanonik kural sicili V16/228/207 durumuna yükseltildi; tam ParsYuva Aile Yaşam Merkezi adı, sürüm paleti, parola görünürlüğü, installer yaşam döngüsü, aylık build, deneme/Gold, kaldırma-sıfırlama, tepsi ve migration/rollback kararları fail-closed kapılara bağlandı.",
    "DEC-261 ile AYM kısaltması güncel kullanıcı yüzeylerinden kaldırıldı; yalnız tarihsel kayıtlar ve değiştirilemeyen teknik uyumluluk yolları güncel marka olmadığı açıkça belirtilerek korunur.",
    "DEC-262 ile Windows kurulum hedefi C:\\Program Files\\PPT\\ParsYuva, ana program ve kısayol adı ParsYuva, teslim adı ParsYuva-<Kanal>-GG.AA.YYYY.NN.exe olarak sabitlendi.",
    "DEC-271 ile güncel kanal program kökleri legacy dizinin dışındaki C:\\Program Files\\PPT\\ParsYuva-<Kanal> kardeş yollarına taşındı; AppData ParsYuva/<Kanal> ve diğer kanal yalıtımı korunurken otomatik legacy veri migration veya silme yasaklandı.",
    "DEC-272 ile sürüm tahsisi exact expected release ID alan açık tek mutasyon oldu; preview yazmaz, uyuşmazlık yazım ve temizliğe geçmeden durur, signed/local/dir yalnız önceden tahsisli exact current kimliğini tüketir.",
    "DEC-273 ile Windows installer teslimi metadata-only kanonik UAT110 gerçek N→N+1 ve same-version maintenance koruması ile source/package/expected release bağlı schema2 kurulu ön yüz UAT111 makbuzuna bağlandı.",
    "DEC-274/PR-239 ile Windows teslim zinciri canlı PR-235 readback, schema2 package provenance, Bronze 50 bootstrap veya Bronze 51+ exact sibling continuation modlu UAT110 V3, installer-experience V2, parent-run bağlı UAT111 V3 ve final V3 geri-okuma kapılarıyla adversarial olarak güçlendirildi.",
    "PR-235 ile en küçük değişiklik dahi exact değişen yol, bağımlı kural/karar/belge/manifest/ratchet/test/UAT kayıtları ve aynı temiz committe hedefli-tam-bütünlük kanıtlarıyla fail-closed eşlemeye bağlandı.",
    "PR-239 UAT111 kapsamı Git'te izlenen TypeScript kanonik rota otoritesi, tüm görünür ve uygun kontrollerin dinamik outcome matrisi, gerçek native CANCEL/ACCEPT ve exclusive reparse-korumalı kanıt köküyle güncellendi.",
]


def package_evidence(item: dict) -> str:
    missing = item.get("missingEvidence") or []
    return ", ".join(missing[:8]) + (f" (+{len(missing) - 8})" if len(missing) > 8 else "") if missing else "Yok/yerel tamamlandı"


def package_status_reason(item: dict) -> str:
    if item.get("status") == "COMPLETED":
        return item.get("closureReason") or "Kapalı; yerel kabul zinciri ve kalıcı receipt tamamlandı."
    return item.get("openReason") or "Açık kalma nedeni kaydedilmemiş — fail-closed belge drifti."


def build_markdown() -> str:
    lines = [
        "# ParsYuva Aile Yaşam Merkezi — Güncel Karar, Kural ve İş Akışı Sicili",
        "",
        f"- Belge sürümü: **{VERSION}**",
        f"- Tarih: **{AS_OF}**",
        f"- Görünür ürün sürümü: **{ledger['release']}**",
        f"- Kaynak HEAD: `{git_head()}`",
        "- Statü: **ACTIVE_CURRENT_MASTER_REFERENCE**",
        "- Kararlar: **DEC-250–DEC-275**",
        "",
        "> Bu sürüm geçmiş PDF/DOCX ve build kapanış belgelerinin üzerine yazmaz. Yerel PASS ile dış kabul kanıtını ayırır; NOT_RUN/PARTIAL/BLOCKED sonuçlarını tamamlanmış göstermez.",
        "",
        "## 1. Denetim sonucu",
        "",
        f"- Aktif repo Word/PDF tarihsel taraması: **{len(word_pdf_scan)} dosya / {historical_pairs} çift / {readable_count} okunabilir**.",
        f"- `C:\\PPT\\AYM` tüm belge türü taraması: **{full_document_audit['documentFileCount']} dosya / {full_document_audit['readableCount']} okunabilir / {full_document_audit['unreadableCount']} sorun**.",
        f"- Office/RTF/PDF: **{full_document_audit['officeAndPdfCount']}**; benzersiz içerik hash'i: **{full_document_audit['uniqueContentHashCount']}**; tekrar kopya: **{full_document_audit['duplicateFileCount']}**.",
        "- Build209–228 master çiftleri ve eski Bronze aktif referans çifti tarihsel olarak korunmuştur.",
        f"- Karar dosyası: **{len(decision_files)}**; ADR: **{len(adr_files)}**; security/threat belgesi: **{len(threat_files)}**.",
        f"- Mevcut tam belge/config/kanıt envanteri: **{document_index['documentCount']}** (yeni sürümden önceki indeks).",
        "",
        "## 2. Yetki ve öncelik",
        "",
        "1. Kanonik kural sicili ve Proje Anayasası",
        "2. Aktif yönetişim, kullanıcı karar ve kabul edilmiş kapsam sicilleri",
        "3. Güncel birleşik sicil ve aktif çalışma belgeleri",
        "4. DEC/ADR/threat model ve makine okunur scope/inventory",
        "5. Kaynak kod, test ve üretilmiş kanıt",
        "6. Tarihsel build belgeleri (yalnız kendi zamanlarının kanıtı)",
        "",
        "## 3. Kapsam ve kural özeti",
        "",
        f"- Gereksinim: **{requirements['requirementCount']}** — COMPLETE {requirement_counts.get('COMPLETE', 0)}, PARTIAL {requirement_counts.get('PARTIAL', 0)}, FOUNDATION_STARTED {requirement_counts.get('FOUNDATION_STARTED', 0)}, NOT_IMPLEMENTED {requirement_counts.get('NOT_IMPLEMENTED', 0)}.",
        f"- Kural sicili: **{rules['id']}**, toplam {rules['ruleCount']}, aktif {rules['activeRuleCount']}, superseded {rules['supersededRuleCount']}, SHA-256 `{rules['rulesSha256']}`.",
        f"- Kullanıcı karar defteri: **{user_decisions['decisionCount']}** açık kullanıcı kararı.",
        "",
        "## 4. İş akışları",
        "",
    ]
    for title, detail in WORKFLOWS:
        lines += [f"### {title}", "", detail, ""]
    lines += ["## 5. Paket iş listesi — açık/kapalı/neden", "", "| Paket | Resmî durum | Yerel durum | Requirement PASS | Açık kalma nedeni | Eksik kanıt |", "|---|---|---|---:|---|---|"]
    for item in roadmap["packages"]:
        lines.append(
            f"| {item['step']} | {item['status']} | {item.get('localImplementationStatus') or '-'} | {'EVET' if item.get('countsAsRequirementPass') else 'HAYIR'} | {package_status_reason(item)} | {package_evidence(item)} |"
        )
    lines += [
        "",
        "## 6. 34-L yerel kapanış gerçeği",
        "",
        f"- Boundary: {closure['validation']['localPackageBoundaries']['status']} / {closure['validation']['localPackageBoundaries']['checks']} kontrol.",
        f"- Contract: {closure['validation']['localPackageContracts']['status']} / {closure['validation']['localPackageContracts']['checks']} kontrol.",
        f"- Runtime: {closure['validation']['localPackageRuntimes']['status']} / {closure['validation']['localPackageRuntimes']['checks']} kontrol.",
        f"- Full regression: {closure['validation']['fullRegression']['status']} / {closure['validation']['fullRegression']['files']} dosya / {closure['validation']['fullRegression']['tests']} test.",
        f"- Production build: {closure['validation']['productionBuilds']['status']} / {closure['validation']['productionBuilds']['workspaces']} workspace.",
        f"- Güncel Core Service companion: {windows_scope['validation']['currentCoreServiceCompanionEvidence']['status']} / {windows_scope['validation']['currentCoreServiceCompanionEvidence']['fullRegression']['files']} dosya / {windows_scope['validation']['currentCoreServiceCompanionEvidence']['fullRegression']['tests']} test / {windows_scope['validation']['currentCoreServiceCompanionEvidence']['packagedLaunches']} normal paket açılışı.",
        f"- Güncel dağıtım imzası: {windows_scope['validation']['currentCoreServiceCompanionEvidence']['executableSignature']}; yerel imzasız ParsYuva-Bronze-20.08.2026.37.exe üretildi ve aynı win-unpacked paketinin iki ardışık açılışı PASS verdi. Production sertifikası ve yükseltilmiş kurulu yaşam döngüsü PASS olmadığı için ticari dağıtım hazır sayılmaz.",
        "- Buna rağmen allRoadmapPackagesAccepted=false, requirementsClosed=false ve countsAsRequirementPass=false.",
        "",
        "## 7. Dış bağımlılıklar ve neden açık",
        "",
    ]
    for title, detail in EXTERNAL_DEPENDENCIES:
        lines += [f"- **{title}:** {detail}"]
    lines += ["", "## 8. Belge sapmaları ve yapılan düzeltmeler", ""]
    lines += [f"- {item}" for item in DRIFT_FIXES]
    lines += ["", "## 9. Görsel kimlik ve erişilebilirlik", ""]
    lines += [
        f"- Logo: `{visual['brandMark']['path']}`, `{visual['brandMark']['style']}`, SHA-256 `{visual['brandMark']['sha256']}`, {visual['brandMark']['width']}×{visual['brandMark']['height']}, şeffaf arka plan.",
        f"- Tipografi: large title {visual['typography']['largeTitlePx']} px; title1 {visual['typography']['title1Px']} px; title2 {visual['typography']['title2Px']} px; body {visual['typography']['bodyPx']} px; control {visual['typography']['controlPx']} px; minimum {visual['typography']['minimumPx']} px.",
    ]
    for channel, palette in visual["releaseChannelNavigationColors"].items():
        lines.append(f"- {channel}: text {palette['text']}, strong {palette['strong']}, icon {palette['icon']}, edge {palette['edge']}.")
    lines += ["", "## 10. Tüm belge türü denetimi", ""]
    for extension, count in full_document_audit["extensionCounts"].items():
        lines.append(f"- `{extension}`: {count}")
    lines += [f"- Bulunmayan Office türleri: {', '.join(full_document_audit['absentOfficeFormats']) or 'Yok'}.", "- Tam yol/hash/okuma sonucu: `artifacts/manifests/ALL_PROJECT_DOCUMENT_FORMAT_AUDIT.json`."]
    lines += ["", "## 11. DEC karar dizini", ""]
    for path in decision_files:
        lines.append(f"- `{path.stem.split('-')[0]}-{path.stem.split('-')[1]}` — {first_heading(path)} — {status_from_markdown(path)} — `{path.relative_to(ROOT).as_posix()}`")
    lines += ["", "## 12. ADR dizini", ""]
    for path in adr_files:
        lines.append(f"- `{path.stem.split('-')[0]}-{path.stem.split('-')[1]}` — {first_heading(path)} — `{path.relative_to(ROOT).as_posix()}`")
    lines += ["", "## 13. Kanonik kurallar — eksiksiz", ""]
    for rule in rules["rules"]:
        lines.append(f"- **{rule['id']} [{rule['state']}]** — {rule['text']}")
    lines += ["", "## 14. Aktif repo Word/PDF tarihsel denetim envanteri", ""]
    for row in word_pdf_scan:
        extra = f", {row.get('pages', '?')} sayfa" if row.get("pages") is not None else ""
        lines.append(f"- `{row['name']}` — {row['type'].upper()} — {row['bytes']} bayt{extra} — {'OKUNABİLİR' if row['readable'] else 'HATA'}")
    lines += ["", "## 15. Kapanış sınırı", "", "Bu belge canlı kaynak gerçeğini toplar; build kapanışı, kanal terfisi, sertifika, hukuk görüşü veya gerçek cihaz/sağlayıcı UAT belgesi değildir. Tarihsel kanıtlar değişmeden kalır.", ""]
    return "\n".join(lines)


SOURCE.parent.mkdir(parents=True, exist_ok=True)
SOURCE.write_bytes(build_markdown().encode("utf-8"))


def set_cell_shading(cell, fill: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_text(cell, text: str, *, bold=False, color=INK, size=8.2):
    cell.text = ""
    paragraph = cell.paragraphs[0]
    paragraph.paragraph_format.space_after = Pt(0)
    run = paragraph.add_run(str(text))
    run.bold = bold
    run.font.name = "Calibri"
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), "Calibri")
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), "Calibri")
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def set_row_pagination(row, *, repeat_header=False):
    row_properties = row._tr.get_or_add_trPr()
    cannot_split = OxmlElement("w:cantSplit")
    row_properties.append(cannot_split)
    if repeat_header:
        header = OxmlElement("w:tblHeader")
        header.set(qn("w:val"), "true")
        row_properties.append(header)


def set_table_fixed(table, widths: list[int]):
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_pr = table._tbl.tblPr
    layout = table_pr.find(qn("w:tblLayout"))
    if layout is None:
        layout = OxmlElement("w:tblLayout")
        table_pr.append(layout)
    layout.set(qn("w:type"), "fixed")
    table_width = table_pr.find(qn("w:tblW"))
    if table_width is None:
        table_width = OxmlElement("w:tblW")
        table_pr.append(table_width)
    table_width.set(qn("w:w"), str(sum(widths)))
    table_width.set(qn("w:type"), "dxa")
    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(width))
        grid.append(col)
    for row in table.rows:
        for cell, width in zip(row.cells, widths):
            cell.width = Inches(width / 1440)
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(width))
            tc_w.set(qn("w:type"), "dxa")


def set_run_font(run, *, name="Calibri", size=None, color=None, bold=None, italic=None):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    if size is not None:
        run.font.size = Pt(size)
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic


def add_page_field(paragraph):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, end])


def add_doc_heading(document, text: str, level=1):
    p = document.add_paragraph(style=f"Heading {level}")
    p.paragraph_format.keep_with_next = True
    p.add_run(text)
    return p


def add_doc_paragraph(document, text: str, *, bold_prefix=None, italic=False):
    p = document.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.25
    p.paragraph_format.keep_together = True
    if bold_prefix and text.startswith(bold_prefix):
        first = p.add_run(bold_prefix)
        set_run_font(first, bold=True)
        second = p.add_run(text[len(bold_prefix):])
        set_run_font(second)
    else:
        run = p.add_run(text)
        set_run_font(run, italic=italic)
    return p


def add_doc_table(document, headers: list[str], rows: list[list[str]], widths: list[int], font_size=7.8):
    table = document.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    set_row_pagination(table.rows[0], repeat_header=True)
    for cell, value in zip(table.rows[0].cells, headers):
        set_cell_shading(cell, BRONZE)
        set_cell_text(cell, value, bold=True, color="FFFFFF", size=font_size)
    for values in rows:
        row = table.add_row()
        set_row_pagination(row)
        cells = row.cells
        for cell, value in zip(cells, values):
            set_cell_text(cell, value, size=font_size)
    set_table_fixed(table, widths)
    return table


def build_docx():
    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(0.95)
    section.left_margin = Inches(0.8)
    section.right_margin = Inches(0.8)
    section.header_distance = Inches(0.28)
    section.footer_distance = Inches(0.28)

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
    normal.font.size = Pt(10)
    normal.font.color.rgb = RGBColor.from_string(INK)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25
    for name, size, before, after, color in [
        ("Heading 1", 16, 18, 10, BRONZE),
        ("Heading 2", 13, 14, 7, BRONZE),
        ("Heading 3", 11, 10, 5, GREEN),
    ]:
        style = doc.styles[name]
        style.font.name = "Calibri"
        style._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
        style._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.line_spacing = 1.0
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.keep_together = True

    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_run_font(header.add_run("PARSYUVA AİLE YAŞAM MERKEZİ  •  GÜNCEL MASTER DOKÜMANTASYON"), size=8, color=MUTED, bold=True)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_run_font(footer.add_run(f"{VERSION}  •  Sayfa "), size=8, color=MUTED)
    add_page_field(footer)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)
    if LOGO.exists():
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        logo_shape = p.add_run().add_picture(str(LOGO), width=Inches(1.25))
        logo_shape._inline.docPr.set("title", "ParsYuva logosu")
        logo_shape._inline.docPr.set("descr", "Sıcak bronz tonlarda Anadolu parsı başı biçimindeki ParsYuva logosu")
    kicker = doc.add_paragraph()
    kicker.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_run_font(kicker.add_run("GÜNCEL ÇALIŞMA REFERANSI"), size=10, color=GOLD, bold=True)
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_after = Pt(4)
    set_run_font(title.add_run("PARSYUVA AİLE YAŞAM MERKEZİ"), size=24, color=BRONZE, bold=True)
    sub2 = doc.add_paragraph()
    sub2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub2.paragraph_format.space_after = Pt(16)
    set_run_font(sub2.add_run("Karar • Kural • Mimari • İş Akışı • Açık İş • Kanıt Sicili"), size=12.5, color=GREEN)
    add_doc_table(doc, ["Alan", "Güncel değer"], [
        ["Belge sürümü", VERSION], ["Tarih", AS_OF], ["Ürün sürümü", ledger["release"]],
        ["Kaynak HEAD", git_head()], ["Kural sicili", f"{rules['id']} / {rules['activeRuleCount']} aktif / {rules['rulesSha256']}"],
        ["Durum", "Aktif çalışma referansı; build kapanışı veya kanal terfisi değildir"],
    ], [1900, 7460], 8.4)
    add_doc_paragraph(doc, "Tarihsel Build209–228 ve eski Bronze master belgeleri değiştirilmeden korunmuştur. Yerel PASS, dış kabul kanıtı değildir; NOT_RUN/PARTIAL/BLOCKED tamamlandı gösterilmez.", italic=True)

    doc.add_page_break()
    add_doc_heading(doc, "1. Yönetici özeti", 1)
    add_doc_paragraph(doc, f"Denetimde {len(word_pdf_scan)} mevcut Word/PDF dosyasının tamamı ayrıştırıldı; {readable_count} dosya okunabilir bulundu. Tarihsel çiftler korunurken güncel master sürüm ayrı adla oluşturuldu.")
    summary_rows = [
        ["Kabul edilmiş gereksinim", str(requirements["requirementCount"])],
        ["COMPLETE / PARTIAL / FOUNDATION / NOT_IMPLEMENTED", f"{requirement_counts.get('COMPLETE',0)} / {requirement_counts.get('PARTIAL',0)} / {requirement_counts.get('FOUNDATION_STARTED',0)} / {requirement_counts.get('NOT_IMPLEMENTED',0)}"],
        ["Kanonik kural", f"{rules['ruleCount']} toplam / {rules['activeRuleCount']} aktif / {rules['supersededRuleCount']} superseded"],
        ["Karar / ADR / threat dosyası", f"{len(decision_files)} / {len(adr_files)} / {len(threat_files)}"],
        ["İş paketi", f"{roadmap['packageCount']} toplam; 3 resmî COMPLETED, 23 açık/acceptance blocked"],
        ["Silver", "BLOCKED"],
    ]
    add_doc_table(doc, ["Gösterge", "Canlı sonuç"], summary_rows, [3000, 6360], 8.5)

    add_doc_heading(doc, "2. Belge yetkisi ve tarihsel koruma", 1)
    for text in [
        "Kanonik kural sicili ve Proje Anayasası en üst makine-okunur otoritedir.",
        "Aktif governance, kullanıcı karar ve kabul edilmiş kapsam sicilleri çalışma durumunu belirler.",
        "Bu güncel master, aktif Markdown/config/DEC/ADR/threat/source/test kanıtlarını birleştirir.",
        "Build209–228 ve eski Bronze Word/PDF dosyaları kendi zamanlarının tarihsel delilidir; aktif davranışı geçersiz kılamaz ve üzerine yazılmaz.",
    ]:
        add_doc_paragraph(doc, text)

    add_doc_heading(doc, "3. Kanonik kapsam ve kural tabanı", 1)
    add_doc_paragraph(doc, f"Kapsam sicilinde {requirements['requirementCount']} gereksinim vardır. Dağılım: COMPLETE {requirement_counts.get('COMPLETE',0)}, PARTIAL {requirement_counts.get('PARTIAL',0)}, FOUNDATION_STARTED {requirement_counts.get('FOUNDATION_STARTED',0)}, NOT_IMPLEMENTED {requirement_counts.get('NOT_IMPLEMENTED',0)}.")
    add_doc_paragraph(doc, f"Kural sicili {rules['id']}: {rules['ruleCount']} toplam, {rules['activeRuleCount']} aktif, {rules['supersededRuleCount']} superseded. SHA-256 {rules['rulesSha256']}.")
    add_doc_paragraph(doc, "Tamamlanma zinciri karar → domain → şema/migration → use-case → repository → PEP/UoW → API/IPC → UI/menü → hedefli test → belge → kanıttır. Zincirin herhangi bir halkası eksikse requirement tamamlanmaz.")

    add_doc_heading(doc, "4. Güncel altyapı ve mimari", 1)
    add_doc_table(doc, ["Katman", "Güncel altyapı gerçeği"], [[a, b] for a, b in INFRASTRUCTURE], [2100, 7260], 8.1)

    add_doc_heading(doc, "5. Bağlayıcı iş akışları", 1)
    add_doc_table(doc, ["İş akışı", "Bağlayıcı yürütme"], [[title, detail] for title, detail in WORKFLOWS], [2300, 7060], 8.4)

    add_doc_heading(doc, "6. Paket iş listesi — açık/kapalı/neden", 1)
    add_doc_paragraph(doc, "Kullanıcı kuralı gereği her açık paket; yerel olarak neyin bulunduğunu, neden açık kaldığını, eksik kanıtı ve requirement PASS sayılıp sayılmadığını birlikte gösterir.")
    package_rows = []
    for item in roadmap["packages"]:
        package_rows.append([
            item["step"], item["status"], item.get("localImplementationStatus") or "-",
            "EVET" if item.get("countsAsRequirementPass") else "HAYIR",
            package_status_reason(item),
        ])
    add_doc_table(doc, ["Paket", "Resmî", "Yerel", "PASS", "Açık kalma nedeni"], package_rows, [650, 1050, 1700, 650, 5310], 6.9)

    add_doc_heading(doc, "7. Yerel doğrulama ve kabul sınırı", 1)
    validation = closure["validation"]
    validation_rows = [
        ["Boundary", validation["localPackageBoundaries"]["status"], str(validation["localPackageBoundaries"]["checks"])],
        ["Contract", validation["localPackageContracts"]["status"], str(validation["localPackageContracts"]["checks"])],
        ["Runtime", validation["localPackageRuntimes"]["status"], str(validation["localPackageRuntimes"]["checks"])],
        ["Targeted", validation["targeted"]["status"], f"{validation['targeted']['files']} dosya / {validation['targeted']['tests']} test"],
        ["Full regression", validation["fullRegression"]["status"], f"{validation['fullRegression']['files']} dosya / {validation['fullRegression']['tests']} test"],
        ["Root typecheck", validation["rootTypecheck"], "Kaynak tipi"],
        ["Production builds", validation["productionBuilds"]["status"], f"{validation['productionBuilds']['workspaces']} workspace"],
        ["Requirement kabul", "HAYIR", "requirementsClosed=false / countsAsRequirementPass=false"],
    ]
    add_doc_table(doc, ["Kapı", "Sonuç", "Kanıt"], validation_rows, [2100, 1400, 5860], 8.1)

    add_doc_heading(doc, "8. Dış bağımlılıklar ve neden açık", 1)
    add_doc_table(doc, ["Dış bağımlılık", "Açık kalma nedeni"], [[title, detail] for title, detail in EXTERNAL_DEPENDENCIES], [2300, 7060], 8.4)

    add_doc_heading(doc, "9. Installer ve çalıştırma gerçeği", 1)
    add_doc_paragraph(doc, "Güncel kanal program hedefi legacy kökün dışındaki C:\\Program Files\\PPT\\ParsYuva-<Kanal> kardeş dizinidir; ana dosya ParsYuva-<Kanal>.exe, kısayol ParsYuva <Kanal>, AppData kökü ParsYuva/<Kanal> ve teslim EXE adı ParsYuva-<Kanal>-GG.AA.YYYY.NN.exe biçimindedir. Otomatik legacy veri migration veya silme yoktur. ParsYuva-Bronze-20.08.2026.37.exe tarihsel yerel test installerı ile aynı win-unpacked paketin iki açılış kaydı güncel N->N+1 kabul kanıtı değildir. Yükseltilmiş gerçek kurulum yaşam döngüsü PASS olmadıkça ve Production Authenticode sertifikası ile temiz harici Windows makinesi kanıtı tamamlanmadıkça 'ticari dağıtıma hazır' iddiası kurulmaz.")

    add_doc_heading(doc, "10. Görsel kimlik ve erişilebilirlik", 1)
    palette_rows = [[channel, value["text"], value["strong"], value["icon"], value["edge"]] for channel, value in visual["releaseChannelNavigationColors"].items()]
    add_doc_table(doc, ["Kanal", "Text", "Strong", "Icon", "Edge"], palette_rows, [1200, 2040, 2040, 2040, 2040], 8.0)
    add_doc_paragraph(doc, f"Logo {visual['brandMark']['width']}×{visual['brandMark']['height']} şeffaf PNG, stil {visual['brandMark']['style']}, SHA-256 {visual['brandMark']['sha256']}. Body {visual['typography']['bodyPx']} px; control {visual['typography']['controlPx']} px; minimum {visual['typography']['minimumPx']} px. Gerçek ekran/Narrator/büyütme/UAT ayrıca gereklidir.")

    add_doc_heading(doc, "11. Belge sapmaları ve düzeltmeler", 1)
    for item in DRIFT_FIXES:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.keep_together = True
        set_run_font(p.add_run(item), size=9.5)

    add_doc_heading(doc, "12. Tüm belge türü denetimi", 1)
    add_doc_table(doc, ["Uzantı", "Dosya"], [[extension, str(count)] for extension, count in full_document_audit["extensionCounts"].items()], [2800, 6560], 8.2)
    add_doc_paragraph(doc, f"Kök taramada {full_document_audit['documentFileCount']} belge/config/metin dosyası bulundu; {full_document_audit['readableCount']} okunabilir, {full_document_audit['unreadableCount']} sorunlu. Tam yol ve SHA-256 listesi artifacts/manifests/ALL_PROJECT_DOCUMENT_FORMAT_AUDIT.json içindedir.")

    add_doc_heading(doc, "13. DEC karar dizini — eksiksiz", 1)
    decision_rows = [[f"DEC-{decision_number(path):03d}", first_heading(path), status_from_markdown(path), path.relative_to(ROOT).as_posix()] for path in decision_files]
    add_doc_table(doc, ["ID", "Karar", "Durum", "Dosya"], decision_rows, [850, 4140, 1500, 2870], 6.5)

    add_doc_heading(doc, "14. ADR dizini — eksiksiz", 1)
    adr_rows = [[f"ADR-{adr_number(path):03d}", first_heading(path), path.relative_to(ROOT).as_posix()] for path in adr_files]
    add_doc_table(doc, ["ID", "Mimari karar", "Dosya"], adr_rows, [900, 5000, 3460], 6.8)

    add_doc_heading(doc, f"15. Kanonik kurallar — {rules['ruleCount']} kayıt", 1)
    rule_rows = [[rule["id"], rule["state"], rule["text"]] for rule in rules["rules"]]
    add_doc_table(doc, ["ID", "Durum", "Kural"], rule_rows, [850, 1100, 7410], 7.0)

    add_doc_heading(doc, "16. Aktif repo Word/PDF tarihsel envanter denetimi", 1)
    audit_rows = [[row["name"], row["type"].upper(), str(row["bytes"]), str(row.get("pages", "-")), "OK" if row["readable"] else "HATA"] for row in word_pdf_scan]
    add_doc_table(doc, ["Dosya", "Tür", "Bayt", "Sayfa", "Okuma"], audit_rows, [5000, 800, 1300, 850, 1410], 7.0)
    add_doc_paragraph(doc, "Yeni sürüm, tarihsel dosyaların yerine geçmez; yalnız aktif çalışma gerçeğini tek yerde toplar.")

    doc.core_properties.title = "ParsYuva Aile Yaşam Merkezi Güncel Master Dokümantasyon"
    doc.core_properties.subject = "Karar, kural, mimari, iş akışı, açık iş ve kanıt sicili"
    doc.core_properties.author = "ParsYuva"
    doc.core_properties.keywords = "ParsYuva Aile Yaşam Merkezi, governance, güvenlik, kurumsallaşma, iş akışı, karar, kural"
    DOCX_OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(DOCX_OUT)


def pdf_escape(text: str) -> str:
    return html.escape(str(text)).replace("\n", "<br/>")


def build_pdf():
    arial = Path("C:/Windows/Fonts/arial.ttf")
    arial_bold = Path("C:/Windows/Fonts/arialbd.ttf")
    font = "Helvetica"
    bold = "Helvetica-Bold"
    if arial.exists() and arial_bold.exists():
        pdfmetrics.registerFont(TTFont("ArialCurrent", str(arial)))
        pdfmetrics.registerFont(TTFont("ArialCurrent-Bold", str(arial_bold)))
        font, bold = "ArialCurrent", "ArialCurrent-Bold"
    styles = getSampleStyleSheet()
    body = ParagraphStyle("BodyCurrent", parent=styles["BodyText"], fontName=font, fontSize=8.6, leading=11, spaceAfter=5, textColor=colors.HexColor(f"#{INK}"))
    small = ParagraphStyle("SmallCurrent", parent=body, fontSize=6.7, leading=8.2, spaceAfter=2)
    h1 = ParagraphStyle("H1Current", parent=styles["Heading1"], fontName=bold, fontSize=14, leading=17, textColor=colors.HexColor(f"#{BRONZE}"), spaceBefore=10, spaceAfter=7)
    h2 = ParagraphStyle("H2Current", parent=styles["Heading2"], fontName=bold, fontSize=10.5, leading=13, textColor=colors.HexColor(f"#{GREEN}"), spaceBefore=7, spaceAfter=4)
    title_style = ParagraphStyle("TitleCurrent", parent=styles["Title"], fontName=bold, fontSize=23, leading=27, alignment=TA_CENTER, textColor=colors.HexColor(f"#{BRONZE}"), spaceAfter=5)
    subtitle_style = ParagraphStyle("SubtitleCurrent", parent=body, fontName=font, fontSize=12, leading=15, alignment=TA_CENTER, textColor=colors.HexColor(f"#{GREEN}"), spaceAfter=14)

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(font, 7)
        canvas.setFillColor(colors.HexColor(f"#{MUTED}"))
        canvas.drawString(0.65 * inch, 0.36 * inch, f"ParsYuva Aile Yaşam Merkezi • {VERSION}")
        canvas.drawRightString(7.85 * inch, 0.36 * inch, f"Sayfa {doc.page}")
        canvas.restoreState()

    def p(text: str, style=body):
        return Paragraph(pdf_escape(text), style)

    def pdf_table(headers, rows, widths, font_size=7.0):
        data = [[Paragraph(pdf_escape(value), ParagraphStyle("TH", parent=small, fontName=bold, fontSize=font_size, leading=font_size + 1.5, textColor=colors.white)) for value in headers]]
        for row in rows:
            data.append([Paragraph(pdf_escape(value), ParagraphStyle("TD", parent=small, fontSize=font_size, leading=font_size + 1.5)) for value in row])
        table = Table(data, colWidths=widths, repeatRows=1, splitByRow=1, splitInRow=0, longTableOptimize=False)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{BRONZE}")),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#C8B8A8")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor(f"#{BRONZE_LIGHT}")]),
        ]))
        return table

    story = [Spacer(1, 0.22 * inch)]
    if LOGO.exists():
        logo = Image(str(LOGO), width=1.05 * inch, height=1.05 * inch)
        logo.hAlign = "CENTER"
        story += [logo, Spacer(1, 6)]
    story += [
        Paragraph("GÜNCEL ÇALIŞMA REFERANSI", ParagraphStyle("Kicker", parent=body, alignment=TA_CENTER, fontName=bold, fontSize=9, textColor=colors.HexColor(f"#{GOLD}"))),
        Paragraph("PARSYUVA AİLE YAŞAM MERKEZİ", title_style),
        Paragraph("Karar • Kural • Mimari • İş Akışı • Açık İş • Kanıt Sicili", subtitle_style),
        pdf_table(["Alan", "Güncel değer"], [
            ["Belge sürümü", VERSION], ["Tarih", AS_OF], ["Ürün sürümü", ledger["release"]], ["Kaynak HEAD", git_head()],
            ["Kural sicili", f"{rules['id']} / {rules['activeRuleCount']} aktif / {rules['rulesSha256']}"],
            ["Durum", "Aktif çalışma referansı; build kapanışı veya kanal terfisi değildir"],
        ], [1.45 * inch, 5.55 * inch], 8),
        Spacer(1, 8), p("Tarihsel Build209–228 ve eski Bronze master belgeleri değiştirilmeden korunmuştur. Yerel PASS, dış kabul kanıtı değildir; NOT_RUN/PARTIAL/BLOCKED tamamlandı gösterilmez."),
        PageBreak(), Paragraph("1. Yönetici özeti", h1),
        p(f"Denetimde {len(word_pdf_scan)} mevcut Word/PDF dosyasının tamamı ayrıştırıldı; {readable_count} dosya okunabilir bulundu. Tarihsel çiftler korunurken güncel master sürüm ayrı adla oluşturuldu."),
        pdf_table(["Gösterge", "Canlı sonuç"], [
            ["Kabul edilmiş gereksinim", str(requirements["requirementCount"])],
            ["COMPLETE / PARTIAL / FOUNDATION / NOT_IMPLEMENTED", f"{requirement_counts.get('COMPLETE',0)} / {requirement_counts.get('PARTIAL',0)} / {requirement_counts.get('FOUNDATION_STARTED',0)} / {requirement_counts.get('NOT_IMPLEMENTED',0)}"],
            ["Kanonik kural", f"{rules['ruleCount']} toplam / {rules['activeRuleCount']} aktif / {rules['supersededRuleCount']} superseded"],
            ["Karar / ADR / threat", f"{len(decision_files)} / {len(adr_files)} / {len(threat_files)}"],
            ["İş paketi", f"{roadmap['packageCount']} toplam; 3 resmî COMPLETED, 23 açık/acceptance blocked"], ["Silver", "BLOCKED"],
        ], [2.4 * inch, 4.6 * inch], 8),
        Paragraph("2. Belge yetkisi ve tarihsel koruma", h1),
    ]
    for text in [
        "Kanonik kural sicili ve Proje Anayasası en üst makine-okunur otoritedir.",
        "Aktif governance, kullanıcı karar ve kabul edilmiş kapsam sicilleri çalışma durumunu belirler.",
        "Bu güncel master, aktif Markdown/config/DEC/ADR/threat/source/test kanıtlarını birleştirir.",
        "Build209–228 ve eski Bronze Word/PDF dosyaları kendi zamanlarının tarihsel delilidir; aktif davranışı geçersiz kılamaz ve üzerine yazılmaz.",
    ]:
        story.append(p(text))
    story += [Paragraph("3. Kanonik kapsam ve kural tabanı", h1), p(f"Kapsam sicilinde {requirements['requirementCount']} gereksinim vardır. Dağılım: COMPLETE {requirement_counts.get('COMPLETE',0)}, PARTIAL {requirement_counts.get('PARTIAL',0)}, FOUNDATION_STARTED {requirement_counts.get('FOUNDATION_STARTED',0)}, NOT_IMPLEMENTED {requirement_counts.get('NOT_IMPLEMENTED',0)}."), p(f"Kural sicili {rules['id']}: {rules['ruleCount']} toplam, {rules['activeRuleCount']} aktif, {rules['supersededRuleCount']} superseded. SHA-256 {rules['rulesSha256']}.")]
    # Bu tablo tek bir kısa devam satırı için yeni sayfa üretmemeli. Biraz daha
    # sıkı tipografi, bütün mimari özetini aynı sayfada okunaklı biçimde tutar.
    story += [Paragraph("4. Güncel altyapı ve mimari", h1), pdf_table(["Katman", "Güncel altyapı gerçeği"], [[a, b] for a, b in INFRASTRUCTURE], [1.55 * inch, 5.45 * inch], 7.2), PageBreak(), Paragraph("5. Bağlayıcı iş akışları", h1)]
    for title_text, detail in WORKFLOWS:
        story.append(KeepTogether([Paragraph(pdf_escape(title_text), h2), p(detail)]))
    package_rows = [[item["step"], item["status"], item.get("localImplementationStatus") or "-", "EVET" if item.get("countsAsRequirementPass") else "HAYIR", package_status_reason(item)] for item in roadmap["packages"]]
    story += [PageBreak(), Paragraph("6. Paket iş listesi — açık/kapalı/neden", h1), p("Her açık paket yerel durum, açık kalma nedeni, eksik kanıt ve requirement PASS gerçeğiyle birlikte gösterilir."), pdf_table(["Paket", "Resmî", "Yerel", "PASS", "Açık kalma nedeni"], package_rows, [0.45*inch, 0.8*inch, 1.3*inch, 0.45*inch, 4.0*inch], 5.8)]
    validation = closure["validation"]
    validation_rows = [["Boundary", validation["localPackageBoundaries"]["status"], str(validation["localPackageBoundaries"]["checks"])], ["Contract", validation["localPackageContracts"]["status"], str(validation["localPackageContracts"]["checks"])], ["Runtime", validation["localPackageRuntimes"]["status"], str(validation["localPackageRuntimes"]["checks"])], ["Targeted", validation["targeted"]["status"], f"{validation['targeted']['files']} dosya / {validation['targeted']['tests']} test"], ["Full regression", validation["fullRegression"]["status"], f"{validation['fullRegression']['files']} dosya / {validation['fullRegression']['tests']} test"], ["Production builds", validation["productionBuilds"]["status"], f"{validation['productionBuilds']['workspaces']} workspace"], ["Requirement kabul", "HAYIR", "requirementsClosed=false / countsAsRequirementPass=false"]]
    story += [Paragraph("7. Yerel doğrulama ve kabul sınırı", h1), pdf_table(["Kapı", "Sonuç", "Kanıt"], validation_rows, [1.6*inch, 1.1*inch, 4.3*inch], 7.6), Paragraph("8. Dış bağımlılıklar ve neden açık", h1)]
    for title_text, detail in EXTERNAL_DEPENDENCIES:
        story.append(KeepTogether([Paragraph(pdf_escape(title_text), h2), p(detail)]))
    visual_table = pdf_table(["Kanal", "Text", "Strong", "Icon", "Edge"], [[c, v['text'], v['strong'], v['icon'], v['edge']] for c, v in visual['releaseChannelNavigationColors'].items()], [1.0*inch,1.5*inch,1.5*inch,1.5*inch,1.5*inch],7.5)
    story += [KeepTogether([Paragraph("9. Installer ve çalıştırma gerçeği", h1), p("Güncel kanal program hedefi legacy kökün dışındaki C:\\Program Files\\PPT\\ParsYuva-<Kanal> kardeş dizinidir; ana dosya ParsYuva-<Kanal>.exe, kısayol ParsYuva <Kanal>, AppData kökü ParsYuva/<Kanal> ve teslim EXE adı ParsYuva-<Kanal>-GG.AA.YYYY.NN.exe biçimindedir. Otomatik legacy veri migration veya silme yoktur. ParsYuva-Bronze-20.08.2026.37.exe tarihsel yerel test installerı güncel N->N+1 kabul kanıtı değildir. Yükseltilmiş gerçek kurulum yaşam döngüsü PASS olmadıkça ve Production Authenticode sertifikası ile temiz harici Windows makinesi kanıtı tamamlanmadıkça ticari dağıtım hazır sayılmaz.")]), KeepTogether([Paragraph("10. Görsel kimlik ve erişilebilirlik", h1), visual_table, p(f"Logo {visual['brandMark']['width']}×{visual['brandMark']['height']} şeffaf PNG; SHA-256 {visual['brandMark']['sha256']}. Body {visual['typography']['bodyPx']} px, control {visual['typography']['controlPx']} px, minimum {visual['typography']['minimumPx']} px.")])]
    story += [KeepTogether([Paragraph("11. Belge sapmaları ve düzeltmeler", h1), p(f"• {DRIFT_FIXES[0]}")])] + [p(f"• {item}") for item in DRIFT_FIXES[1:]]
    story += [Paragraph("12. Tüm belge türü denetimi", h1), pdf_table(["Uzantı", "Dosya"], [[extension, str(count)] for extension, count in full_document_audit["extensionCounts"].items()], [2.0*inch,5.0*inch], 8.0), p(f"Kök taramada {full_document_audit['documentFileCount']} belge/config/metin dosyası bulundu; {full_document_audit['readableCount']} okunabilir, {full_document_audit['unreadableCount']} sorunlu. Tam yol ve SHA-256 listesi artifacts/manifests/ALL_PROJECT_DOCUMENT_FORMAT_AUDIT.json içindedir.")]
    decision_rows = [[f"DEC-{decision_number(path):03d}", first_heading(path), status_from_markdown(path), path.relative_to(ROOT).as_posix()] for path in decision_files]
    story += [CondPageBreak(1.5*inch), Paragraph("13. DEC karar dizini — eksiksiz", h1), pdf_table(["ID", "Karar", "Durum", "Dosya"], decision_rows, [0.65*inch,3.1*inch,1.0*inch,2.25*inch], 5.5)]
    adr_rows = [[f"ADR-{adr_number(path):03d}", first_heading(path), path.relative_to(ROOT).as_posix()] for path in adr_files]
    story += [CondPageBreak(1.2*inch), Paragraph("14. ADR dizini — eksiksiz", h1), pdf_table(["ID", "Mimari karar", "Dosya"], adr_rows, [0.7*inch,3.9*inch,2.4*inch], 5.8)]
    rule_rows = [[rule["id"], rule["state"], rule["text"]] for rule in rules["rules"]]
    story += [CondPageBreak(1.2*inch), Paragraph(f"15. Kanonik kurallar — {rules['ruleCount']} kayıt", h1), pdf_table(["ID", "Durum", "Kural"], rule_rows, [0.65*inch,0.85*inch,5.5*inch], 6.0)]
    audit_rows = [[row["name"], row["type"].upper(), str(row["bytes"]), str(row.get("pages", "-")), "OK" if row["readable"] else "HATA"] for row in word_pdf_scan]
    story += [CondPageBreak(1.2*inch), Paragraph("16. Aktif repo Word/PDF tarihsel envanter denetimi", h1), pdf_table(["Dosya", "Tür", "Bayt", "Sayfa", "Okuma"], audit_rows, [4.1*inch,0.55*inch,0.8*inch,0.6*inch,0.95*inch], 6.1), p("Yeni sürüm tarihsel dosyaların yerine geçmez; yalnız aktif çalışma gerçeğini tek yerde toplar.")]
    PDF_OUT.parent.mkdir(parents=True, exist_ok=True)
    class FooterAfterContentDocument(SimpleDocTemplate):
        def afterPage(self):
            footer(self.canv, self)

    document = FooterAfterContentDocument(str(PDF_OUT), pagesize=letter, leftMargin=0.65*inch, rightMargin=0.65*inch, topMargin=0.68*inch, bottomMargin=0.78*inch, title="ParsYuva Aile Yaşam Merkezi Güncel Master Dokümantasyon", author="ParsYuva")
    document.build(story)


build_docx()
build_pdf()
print(SOURCE)
print(DOCX_OUT)
print(PDF_OUT)
print(f"source_sha256={sha256(SOURCE)}")
print(f"docx_sha256={sha256(DOCX_OUT)}")
print(f"pdf_sha256={sha256(PDF_OUT)}")
