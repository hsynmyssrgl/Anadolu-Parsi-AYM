# Kanit ve Izlenebilirlik Sistemi

## Kimlik zinciri

`TKR karar -> GRK gereksinim -> IS is paketi -> TST test -> KNT kanit -> DGS degisiklik`

## Kanit kaydi alanlari

- `evidenceId`
- `requirementIds`
- `sourceHead`
- `worktreeClean`
- `command`
- `startedAt`, `completedAt`
- `status`
- `fileCount`, `testCount`, `checkCount`
- `artifactPaths`
- `sha256`
- `failures`
- `externalOrManual`
- `countsAsRequirementPass`

## Kanit gecerliligi

- Farkli source HEAD veya kaynak hashine ait kanit stale'dir.
- FAIL sonucu silinmez; sonraki PASS ile iliskilendirilir.
- Sentetik/sahte cihaz kaniti gercek cihaz UAT sayilmaz.
- Test adapteri production provider availability kaniti sayilmaz.
- Yerel imzasiz paket production signed artifact sayilmaz.
- Belge iddiasi koddaki false/NOT_RUN alanini PASS'a ceviremez.

## Teslim raporu

Her teslim raporu en az sunlari gosterir:

1. Tamamlanan isler.
2. Acik isler ve nedenleri.
3. Yerel olarak yapilabilecek sonraki adimlar.
4. Kullanici veya dis kaynak gerektiren adimlar.
5. Test/build/migration sonuc ve sayilari.
6. Degisen tum belge yolları.
7. Uretim/ticari uygunluk durumu.

