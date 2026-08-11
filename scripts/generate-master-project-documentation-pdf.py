from pathlib import Path
import json
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, LongTable, TableStyle, PageBreak, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
ledger = json.loads((ROOT / 'config/master-build-ledger.json').read_text(encoding='utf-8'))
build = ledger['currentBuild']
version = ledger['currentVersion']
entry = next(item for item in ledger['builds'] if item['build'] == build)
ruleset = ledger['projectRules']['versions'][-1]
output = ROOT / 'docs' / 'current' / f'MASTER_PROJECT_DOCUMENTATION_BUILD{build}.pdf'

font_path = Path('C:/Windows/Fonts/arial.ttf')
bold_path = Path('C:/Windows/Fonts/arialbd.ttf')
font_name = 'Arial' if font_path.exists() else 'Helvetica'
bold_name = 'Arial-Bold' if bold_path.exists() else 'Helvetica-Bold'
if font_path.exists(): pdfmetrics.registerFont(TTFont('Arial', str(font_path)))
if bold_path.exists(): pdfmetrics.registerFont(TTFont('Arial-Bold', str(bold_path)))

bronze = colors.HexColor('#7C4D20')
light = colors.HexColor('#F5EEE7')
muted = colors.HexColor('#555555')
styles = getSampleStyleSheet()
body = ParagraphStyle('BodyTR', parent=styles['BodyText'], fontName=font_name, fontSize=9.2, leading=12, spaceAfter=5)
small = ParagraphStyle('SmallTR', parent=body, fontSize=7.8, leading=10)
h1 = ParagraphStyle('H1TR', parent=styles['Heading1'], fontName=bold_name, fontSize=15, leading=18, textColor=bronze, spaceBefore=10, spaceAfter=7)
h2 = ParagraphStyle('H2TR', parent=styles['Heading2'], fontName=bold_name, fontSize=11, leading=14, textColor=bronze, spaceBefore=7, spaceAfter=4)
title = ParagraphStyle('TitleTR', parent=styles['Title'], fontName=bold_name, fontSize=24, leading=29, alignment=TA_CENTER, textColor=bronze, spaceAfter=8)
subtitle = ParagraphStyle('SubtitleTR', parent=body, fontSize=12, leading=16, alignment=TA_CENTER, textColor=muted, spaceAfter=16)

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(font_name, 7.5)
    canvas.setFillColor(muted)
    canvas.drawString(0.7 * inch, 0.42 * inch, f'Anadolu Parsı Aile Yaşam Merkezi - Build {build}')
    canvas.drawRightString(7.8 * inch, 0.42 * inch, f'Sayfa {doc.page}')
    canvas.restoreState()

story = [
    Spacer(1, 0.55 * inch),
    Paragraph('ANADOLU PARSI', title),
    Paragraph('Aile Yaşam Merkezi', ParagraphStyle('Product', parent=title, fontSize=20, textColor=colors.black)),
    Paragraph(f'Master Proje Dokümantasyonu - Build {build}<br/>Sürüm {version} - Bronze RC2 Active Development', subtitle)
]
summary = [
    ['Üst marka', 'Panthera pardus tulliana'],
    ['Uygulama', 'Anadolu Parsı Aile Yaşam Merkezi'],
    ['Build / sürüm', f'{build} / {version}'],
    ['Kural seti', ruleset['version']],
    ['Kural SHA-256', ruleset['sha256']],
    ['Durum', entry['status']]
]
table = Table(summary, colWidths=[1.45 * inch, 5.25 * inch], repeatRows=0)
table.setStyle(TableStyle([
    ('FONTNAME', (0,0), (-1,-1), font_name), ('FONTNAME', (0,0), (0,-1), bold_name),
    ('FONTSIZE', (0,0), (-1,-1), 8.5), ('BACKGROUND', (0,0), (0,-1), bronze),
    ('TEXTCOLOR', (0,0), (0,-1), colors.white), ('BACKGROUND', (1,0), (1,-1), light),
    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#C8B8A8')), ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5)
]))
story += [table, Spacer(1, 12), Paragraph('1. Build228 governance kapsamı', h1)]
for text in [
    'Build228 yalnız resmî kapanış ve governance buildidir; yeni güvenlik özelliği veya ilgisiz kod değişikliği içermez.',
    'OPEN-021 ve OPEN-022, exact Build227 source ZIP SHA-256 ve gerçek Windows evidence ZIP SHA-256 bağında CLOSED yapılmıştır.',
    'Build227 ve daha eski tarihsel kaynak, SHA, manifest, evidence ve build defteri kayıtları değiştirilmez; NOT_RUN PASS değildir.'
]: story.append(Paragraph(text, body))

story.append(Paragraph('2. Güvenlik mimarisi', h1))
sections = [
    ('Sandbox preload', 'Preload node:crypto import etmez; globalThis.crypto.randomUUID uygunluk kontrolüyle kullanılır. sandbox, contextIsolation ve nodeIntegration güvenlik politikası değişmez.'),
    ('CurrentUser DPAPI persistence', 'Electron synchronous ve async safeStorage iki-süreç testi başarısız olduğu için kalıcı zarflar gerçek iki-süreç PASS veren Windows CurrentUser DPAPI sağlayıcısını kullanır. Yanlış provider, bozuk veya açılamayan zarf otomatik silinmez ya da yenilenmez; startup fail-closed kalır.'),
    ('OPEN-021 / EFS', 'PowerShell path değeri komut metnine eklenmez; child-process environment üzerinden sabit encoded script içine alınır. cipher exit 0 yalnız ön koşuldur. Directory, snapshot ve görünür journal/WAL/SHM/temp ağacı gerçek NTFS Encrypted niteliğiyle doğrulanır. Snapshot VACUUM öncesi boş ve EFS-protected hazırlanır, yazım sonrası yeniden doğrulanır.'),
    ('OPEN-022 / DPAPI', 'Windows backend-name eşitliği kapı değildir. win32 platformu, provider contract, gerçek protect/unprotect, iki-süreç persistence, device-wrapped key envelope, korumalı artifact round-trip, plaintext leakage ve at-rest evidence zorunludur. Runtime backend string uydurulmaz.'),
    ('Installer lifecycle', 'Kısa TEMP install root, bounded polling, dosya adına bağlı olmayan executable/uninstaller keşfi, dinamik uninstall kayıt doğrulaması ve sıfır residue kapanış kapısıdır.'),
    ('Fatal startup', 'Window oluşturulmadan önceki fatal hata stage, error name/message/stack, version/build ve timestamp içeren sınırlı tanısal kanıt üretir. Fatal app.whenReady hatası app.exit(1) ile kapanır; normal kullanıcı çıkışı değişmez.'),
    ('PR-172', 'Yalnız platform tarafından sağlanan gerçek sohbet bağlam kullanımı yüzde 90 veya üzerindeyse HARD_STOP oluşur. Tahmin ve ölçüm yokluğu zorunlu handoff üretmez. Gerçek HARD_STOP aynı yanıtta tam devir metni ve NEW_CHAT_HANDOFF_BUILDxxx.md gerektirir.')
]
for heading, text in sections:
    story.append(KeepTogether([Paragraph(heading, h2), Paragraph(text, body)]))

story += [Paragraph('3. Doğrulama durumu', h1)]
validation_rows = [['Kontrol', 'Sonuç'],
    ['Build228 governance closure contract', 'PASS'],
    ['Exact Build227 source SHA binding', 'PASS'],
    ['Build227 Windows evidence SHA binding', 'PASS'],
    ['Gerçek Windows OPEN-021', 'PASS / CLOSED'],
    ['Gerçek Windows OPEN-022', 'PASS / CLOSED'],
    ['Installer / uninstaller / residue', 'PASS / PASS / zero'],
    ['Bağımsız closure verifier', 'PASS - 95/95'],
    ['NOT_RUN', '0'],
    ['Full root tsc --noEmit', 'FAIL - Silver'],
    ['Unit / integration', 'FAIL - Silver'],
    ['Blocking smoke', 'FAIL - Silver']]
vt = Table(validation_rows, colWidths=[4.5*inch, 2.2*inch], repeatRows=1)
vt.setStyle(TableStyle([('FONTNAME',(0,0),(-1,-1),font_name),('FONTNAME',(0,0),(-1,0),bold_name),('FONTSIZE',(0,0),(-1,-1),8.5),('BACKGROUND',(0,0),(-1,0),bronze),('TEXTCOLOR',(0,0),(-1,0),colors.white),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,light]),('GRID',(0,0),(-1,-1),0.4,colors.HexColor('#C8B8A8')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
story += [vt, PageBreak(), Paragraph('4. Proje Anayasası - 172 bağlayıcı kural', h1)]
rule_rows = [[Paragraph(f'{rule["id"]} - {rule["text"]}', small)] for rule in ruleset['rules']]
for offset in range(0, len(rule_rows), 25):
    rules_table = Table(rule_rows[offset:offset + 25], colWidths=[6.7 * inch], splitByRow=1)
    rules_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
    ]))
    story.append(rules_table)
    if offset + 25 < len(rule_rows):
        story.append(PageBreak())

story += [PageBreak(), Paragraph('5. Açık işler ve devam sınırı', h1)]
for item in sorted((x for x in ledger['remainingWork'] if x['status'] in ('OPEN','IN_PROGRESS')), key=lambda x: x['order']):
    story.append(Paragraph(f'<b>{item["id"]} - {item["title"]}</b> [{item["status"]}]<br/>{item["details"]}', small))

story += [Paragraph('6. Build228 karar ve kanıt dosyaları', h1)]
for path in [
    'docs/18_PROJECT_CONSTITUTION_V6.md', 'docs/18_PROJECT_CONSTITUTION_V6.json',
    'docs/decisions/DEC-116-build224-windows-security-root-cause-remediation.md',
    'docs/adr/ADR-099-fail-closed-windows-efs-safestorage-startup-evidence.md',
    'docs/decisions/DEC-117-pr172-platform-actual-context-hard-stop.md',
    'docs/adr/ADR-100-platform-actual-conversation-capacity-gate.md',
    'BUILD_STATUS_BRONZE_RC2_BUILD225.md', 'RELEASE_NOTES_BRONZE_RC2_BUILD225.md',
    'BUILD225_ARCHITECTURE_VALIDATION_REPORT.md', 'BUILD225_DELIVERY_VALIDATION_REPORT.md',
    'docs/decisions/DEC-118-build225-fresh-profile-device-identity-initialization-order.md',
    'docs/adr/ADR-101-protected-device-identity-before-device-bound-maintenance-restore.md',
    'docs/security/FRESH_PROFILE_DEVICE_IDENTITY_INITIALIZATION_BUILD226.md',
    'BUILD_STATUS_BRONZE_RC2_BUILD226.md', 'RELEASE_NOTES_BRONZE_RC2_BUILD226.md',
    'BUILD226_ARCHITECTURE_VALIDATION_REPORT.md', 'BUILD226_DELIVERY_VALIDATION_REPORT.md',
    'docs/decisions/DEC-119-build227-four-proven-windows-root-causes.md',
    'docs/adr/ADR-102-build227-windows-persistence-and-closure-remediation.md',
    'docs/security/WINDOWS_ROOT_CAUSE_REMEDIATION_BUILD227.md',
    'BUILD_STATUS_BRONZE_RC2_BUILD227.md', 'RELEASE_NOTES_BRONZE_RC2_BUILD227.md',
    'BUILD227_ARCHITECTURE_VALIDATION_REPORT.md', 'BUILD227_DELIVERY_VALIDATION_REPORT.md',
    'docs/decisions/DEC-120-build228-open021-open022-official-closure.md',
    'docs/adr/ADR-103-build227-evidence-bound-bronze-open-closure.md',
    'docs/security/BRONZE_OPEN021_OPEN022_CLOSURE_BUILD228.md',
    'config/bronze-open-closure-status.json',
    'BUILD_STATUS_BRONZE_RC2_BUILD228.md', 'RELEASE_NOTES_BRONZE_RC2_BUILD228.md',
    'BUILD228_ARCHITECTURE_VALIDATION_REPORT.md', 'BUILD228_DELIVERY_VALIDATION_REPORT.md'
]: story.append(Paragraph(path, small))

output.parent.mkdir(parents=True, exist_ok=True)
doc = SimpleDocTemplate(str(output), pagesize=letter, rightMargin=0.7*inch, leftMargin=0.7*inch, topMargin=0.65*inch, bottomMargin=0.62*inch, title=f'Anadolu Parsı Aile Yaşam Merkezi Build {build}', author='Panthera pardus tulliana')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(output)
