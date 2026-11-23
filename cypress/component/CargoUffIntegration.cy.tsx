import React from 'react';
import { strToU8, zipSync, zlibSync } from 'fflate';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import {
    extractUffUuidFromOmniboxInput,
    isCargoUffAttachmentPath,
} from '@/lib/data/oscar/CargoUffApi';
import { decodeHemdPalettizedPng, decodeTiff16Bytes } from '@/lib/data/oscar/Tiff16Decoder';
import { parseLocalUffFile } from '@/lib/data/oscar/UffClientArchive';
import CargoUffViewerDialog from '@/app/_components/uff/CargoUffViewerDialog';
import CargoUffSmbPickerDialog from '@/app/_components/uff/CargoUffSmbPickerDialog';

function buildMinimalTiff16(width: number, height: number): Uint8Array {
    // Uncompressed little-endian 16-bit grayscale TIFF (6 tags)
    const tagCount = 6;
    const ifdOffset = 8;
    const pixelOffset = ifdOffset + 2 + tagCount * 12 + 4;
    const pixelBytes = width * height * 2;
    const buf = new ArrayBuffer(pixelOffset + pixelBytes);
    const view = new DataView(buf);

    // Header: 'II', magic 42, IFD offset 8
    view.setUint8(0, 0x49);
    view.setUint8(1, 0x49);
    view.setUint16(2, 42, true);
    view.setUint32(4, ifdOffset, true);
    view.setUint16(ifdOffset, tagCount, true);

    const writeShortOrLongTag = (idx: number, tag: number, type: number, count: number, val: number) => {
        const pos = ifdOffset + 2 + idx * 12;
        view.setUint16(pos, tag, true);
        view.setUint16(pos + 2, type, true);
        view.setUint32(pos + 4, count, true);
        if (type === 3) {
            view.setUint16(pos + 8, val, true);
        } else {
            view.setUint32(pos + 8, val, true);
        }
    };

    writeShortOrLongTag(0, 256, 4, 1, width); // ImageWidth
    writeShortOrLongTag(1, 257, 4, 1, height); // ImageLength
    writeShortOrLongTag(2, 258, 3, 1, 16); // BitsPerSample = 16
    writeShortOrLongTag(3, 259, 3, 1, 1); // Compression = Uncompressed
    writeShortOrLongTag(4, 273, 4, 1, pixelOffset); // StripOffsets
    writeShortOrLongTag(5, 279, 4, 1, pixelBytes); // StripByteCounts
    view.setUint32(ifdOffset + 2 + tagCount * 12, 0, true);

    let p = pixelOffset;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const val = Math.round(((x + y * width) / Math.max(1, width * height - 1)) * 65535);
            view.setUint16(p, val, true);
            p += 2;
        }
    }
    return new Uint8Array(buf);
}

function crc32(bytes: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        c ^= bytes[i]!;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
    }
    return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length, false);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)), false);
    return out;
}

function buildMinimalPalettizedHemdPng(width: number, height: number): Uint8Array {
    const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = new Uint8Array(13);
    const ihdrDv = new DataView(ihdr.buffer);
    ihdrDv.setUint32(0, width, false);
    ihdrDv.setUint32(4, height, false);
    ihdr[8] = 8; // bit depth 8
    ihdr[9] = 3; // color type 3 = indexed palette

    // 4-entry palette: 0=white air, 1=orange organic, 2=green NORM/mineral, 3=blue high-Z
    const plte = new Uint8Array([
        255, 255, 255,
        235, 130, 35,
        46, 175, 85,
        35, 105, 225,
    ]);

    const rawScanlines = new Uint8Array(height * (1 + width));
    for (let y = 0; y < height; y++) {
        const rowStart = y * (1 + width);
        rawScanlines[rowStart] = 0; // filter None
        for (let x = 0; x < width; x++) {
            rawScanlines[rowStart + 1 + x] = (x % 4);
        }
    }
    const idat = zlibSync(rawScanlines);

    const chunks = [
        sig,
        pngChunk('IHDR', ihdr),
        pngChunk('PLTE', plte),
        pngChunk('IDAT', idat),
        pngChunk('IEND', new Uint8Array(0)),
    ];
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
    }
    return out;
}

describe('Cargo NII (WCO UFF 2.0 & 3.0) Client Helpers, 16-Bit Viewer & SMB Picker', () => {
    it('extracts UFF UUIDs cleanly from raw UUIDs, .uff filenames, and UNC paths while ignoring normal Vehicle IDs', () => {
        const sampleUuid = 'a4f19012-7b31-49e2-9c1d-558899aabbcc';
        expect(extractUffUuidFromOmniboxInput(sampleUuid.toUpperCase())).to.equal(sampleUuid);
        expect(extractUffUuidFromOmniboxInput(`${sampleUuid}.uff`)).to.equal(sampleUuid);
        expect(extractUffUuidFromOmniboxInput(`uff-link-${sampleUuid}.uffref.json`)).to.equal(sampleUuid);
        expect(
            extractUffUuidFromOmniboxInput(
                `\\\\192.168.0.60\\oscar-uff\\smb-date-archive\\2026\\11\\20\\EAGLE-P60-LANE01\\${sampleUuid}.uff`,
            ),
        ).to.equal(sampleUuid);
        expect(extractUffUuidFromOmniboxInput(`Z:\\2026\\11\\20\\${sampleUuid}.uff`)).to.equal(sampleUuid);

        // Normal container IDs and license plates must NOT trigger UFF UUID extraction
        expect(extractUffUuidFromOmniboxInput('MSCU 528572 5')).to.equal('');
        expect(extractUffUuidFromOmniboxInput('ABC-1234')).to.equal('');
        expect(isCargoUffAttachmentPath('buckets/adjudication/uff-link-123.uffref.json')).to.equal(true);
        expect(isCargoUffAttachmentPath('scan-01.uff')).to.equal(true);
        expect(isCargoUffAttachmentPath('foreground.n42')).to.equal(false);
    });

    it('decodes 16-bit uint16 TIFF + palettized HEMD PNG inside a local WCO UFF 3.0.0 archive and renders interactive controls', () => {
        const uffUuid = '11223344-5566-7788-99aa-bbccddeeff00';
        const tifBytes = buildMinimalTiff16(64, 32);
        const hemdBytes = buildMinimalPalettizedHemdPng(64, 32);

        cy.wrap(null).then(async () => {
            const decodedTiff = await decodeTiff16Bytes(tifBytes);
            expect(decodedTiff.width).to.equal(64);
            expect(decodedTiff.height).to.equal(32);
            expect(decodedTiff.pixels[0]).to.equal(0);
            expect(decodedTiff.maxVal).to.equal(65535);

            const decodedHemd = await decodeHemdPalettizedPng(hemdBytes);
            expect(decodedHemd.width).to.equal(64);
            expect(decodedHemd.height).to.equal(32);
            expect(decodedHemd.paletteRgb.length).to.equal(768);
        });

        const uff3Xml = `<?xml version="1.0" encoding="UTF-8"?>
<UFF xmlns="UFF3">
  <Id>${uffUuid}</Id>
  <Target>
    <EventId>evt-target-1</EventId>
    <Vehicle>
      <FrontPlateNum>TN8842A</FrontPlateNum>
      <VehicleType>TractorTrailer</VehicleType>
      <Container>
        <ContainerNum>MSCU5285725</ContainerNum>
        <Weight>21450</Weight>
        <Length>40</Length>
        <Declaration>
          <CustomsId>DEC-9001</CustomsId>
          <GoodsDescription>
            <HSCode>3105.20</HSCode>
            <Description>Potassium Nitrate NPK Fertilizer</Description>
          </GoodsDescription>
        </Declaration>
      </Container>
    </Vehicle>
  </Target>
  <Scan>
    <EventId>evt-scan-1</EventId>
    <ScannerCaseId>CASE-301</ScannerCaseId>
    <TimeStamp>2026-11-20T14:22:10Z</TimeStamp>
    <XraySystem>
      <Identifier>EAGLE-P60-LANE01</Identifier>
      <Manufacturer>Rapiscan</Manufacturer>
      <ModelName>Eagle P60</ModelName>
      <SerialNumber>SN-001</SerialNumber>
    </XraySystem>
    <XRayFile>
      <FileId>xray-1</FileId>
      <View>Side</View>
      <Modality>Transmission</Modality>
      <URI>xray/side_he.tif</URI>
      <Energy>6.0</Energy>
      <Energy>4.0</Energy>
      <HEMDInfo>
        <HEMDFileURI>xray/side_hemd.png</HEMDFileURI>
        <HEMDMap>
          <ZMap>
            <Name>Organic</Name>
            <PaletteStart>1</PaletteStart>
            <PaletteEnd>1</PaletteEnd>
            <EffectiveZStart>1</EffectiveZStart>
            <EffectiveZEnd>9</EffectiveZEnd>
          </ZMap>
          <ZMap>
            <Name>Inorganic / Mineral</Name>
            <PaletteStart>2</PaletteStart>
            <PaletteEnd>2</PaletteEnd>
            <EffectiveZStart>10</EffectiveZStart>
            <EffectiveZEnd>18</EffectiveZEnd>
          </ZMap>
          <ZMap>
            <Name>Metallic / High-Z</Name>
            <PaletteStart>3</PaletteStart>
            <PaletteEnd>3</PaletteEnd>
            <EffectiveZStart>19</EffectiveZStart>
            <EffectiveZEnd>92</EffectiveZEnd>
          </ZMap>
        </HEMDMap>
      </HEMDInfo>
    </XRayFile>
    <OcrResult>
      <OcrType>Container</OcrType>
      <Value>MSCU5285725</Value>
      <Confidence>0.97</Confidence>
    </OcrResult>
    <OutputFile>
      <FileId>rad-1</FileId>
      <Type>RadiationDetection</Type>
      <URI>radiation/rpm_pass.n42</URI>
    </OutputFile>
  </Scan>
  <Analysis>
    <Assessment>Suspect</Assessment>
    <Result>Anomaly</Result>
    <Annotation>
      <AnnotationId>ann-1</AnnotationId>
      <Description>High-Z Shielding Candidate</Description>
      <Confidence>0.91</Confidence>
      <BoundingBox>
        <Top>6</Top>
        <Left>18</Left>
        <Bottom>24</Bottom>
        <Right>42</Right>
      </BoundingBox>
    </Annotation>
  </Analysis>
</UFF>`;

        const archiveBytes = zipSync({
            version: strToU8('3.0.0'),
            [`${uffUuid}.xml`]: strToU8(uff3Xml),
            'xray/side_he.tif': tifBytes,
            'xray/side_hemd.png': hemdBytes,
            'radiation/rpm_pass.n42': strToU8('<RadInstrumentData/>'),
        });
        const uffCopy = new Uint8Array(archiveBytes.byteLength);
        uffCopy.set(archiveBytes);
        const uffFile = new File([uffCopy], `${uffUuid}.uff`, { type: 'application/zip' });

        cy.wrap(null).then(async () => {
            const parsed = await parseLocalUffFile(uffFile);
            expect(parsed.metadata.uffVersion).to.equal('3.0.0');
            expect(parsed.metadata.allDisplayVehicleIds[0]).to.contain('MSCU');
            expect(parsed.embeddedN42File?.name).to.equal(`uff-spectrum-${uffUuid}.n42`);
        });

        const appliedIds: string[] = [];
        cy.mount(
            <LanguageProvider>
                <CargoUffViewerDialog
                    open
                    onClose={() => {}}
                    localFile={uffFile}
                    initialRadiationProfile={[
                        { timestampMs: 1000, offsetSeconds: 0, gammaCounts: 240, neutronCounts: 1 },
                        { timestampMs: 2000, offsetSeconds: 1, gammaCounts: 1980, neutronCounts: 2 },
                        { timestampMs: 3000, offsetSeconds: 2, gammaCounts: 310, neutronCounts: 1 },
                    ]}
                    onApplyVehicleId={(vid) => appliedIds.push(vid)}
                />
            </LanguageProvider>,
        );

        cy.get('[data-testid="cargo-uff-viewer-dialog"]').should('be.visible');
        cy.get('[data-testid="uff-viewer-version-chip"]').should('contain.text', 'UFF 3.0.0');
        cy.get('[data-testid="uff-16bit-xray-canvas"]').should('be.visible');
        cy.get('[data-testid="uff-rpm-alignment-strip"]').should('be.visible');
        cy.get('[data-testid="uff-declared-goods"]').should('contain.text', 'Potassium Nitrate NPK Fertilizer');

        // Exercise interactive 16-bit radiology & HEMD material controls
        cy.get('[data-testid="uff-preset-penetration"]').click();
        cy.get('[data-testid="uff-toggle-log"]').click();
        cy.get('[data-testid="uff-toggle-highz-strip"]').click();
        cy.get('[data-testid="uff-band-organic"]').click();
        cy.get('[data-testid="uff-flip-cab-btn"]').click();

        cy.get('[data-testid="uff-apply-ocr-0"]').click().then(() => {
            expect(appliedIds).to.deep.equal(['MSCU5285725']);
        });
    });

    it('supports commercial scanner/time-window browsing, Tier-1 UUID lookup, and 1-char OCR fuzzy correlation in CargoUffSmbPickerDialog', () => {
        const tier1Uuid = '99887766-5544-3322-1100-ffeeddccbbaa';
        const tier2Uuid = '22334455-6677-8899-aabb-ccddeeff0011';

        cy.intercept('GET', '**/oscar/extensions/uff/search*', (req) => {
            const url = new URL(req.url);
            const uffId = url.searchParams.get('uffId') || '';
            if (uffId.includes(tier1Uuid)) {
                req.reply({
                    statusCode: 200,
                    body: {
                        enabled: true,
                        totalIndexed: 160,
                        scanners: ['EAGLE-P60-LANE01', 'HCVM-PORTAL-02'],
                        matches: [
                            {
                                uffUuid: tier1Uuid,
                                uffVersion: '2.0',
                                archiveFileName: `${tier1Uuid}.uff`,
                                relativePath: `2026/11/20/EAGLE-P60-LANE01/${tier1Uuid}.uff`,
                                archiveSizeBytes: 9437184,
                                scannerId: 'EAGLE-P60-LANE01',
                                scannerManufacturer: 'Rapiscan',
                                scannerModel: 'Eagle P60',
                                scanTimestamp: '2026-11-20T15:00:00Z',
                                scanEpochMillis: Date.parse('2026-11-20T15:00:00Z'),
                                containerNum: '',
                                frontPlateNum: '',
                                displayVehicleIds: [],
                                hsCode: '',
                                goodsDescription: '',
                                hasPreview: true,
                                hasHemd: false,
                                hasManifestPdf: false,
                                hasRadiationN42: false,
                                annotationCount: 0,
                                analysisResult: 'Clear',
                                fuzzyMatch: false,
                                matchedIdentifier: tier1Uuid,
                                timeDeltaSeconds: 42,
                            },
                        ],
                    },
                });
                return;
            }
            req.reply({
                statusCode: 200,
                body: {
                    enabled: true,
                    totalIndexed: 160,
                    scanners: ['EAGLE-P60-LANE01', 'HCVM-PORTAL-02'],
                    matches: [
                        {
                            uffUuid: tier2Uuid,
                            uffVersion: '3.0.0',
                            archiveFileName: `${tier2Uuid}.uff`,
                            relativePath: `2026/11/20/HCVM-PORTAL-02/${tier2Uuid}.uff`,
                            archiveSizeBytes: 12582912,
                            scannerId: 'HCVM-PORTAL-02',
                            scannerManufacturer: 'Smiths Detection',
                            scannerModel: 'HCVM',
                            scanTimestamp: '2026-11-20T14:58:10Z',
                            scanEpochMillis: Date.parse('2026-11-20T14:58:10Z'),
                            containerNum: 'MSCU5285725',
                            frontPlateNum: '',
                            displayVehicleIds: ['MSCU 528572 5'],
                            hsCode: '6907.21',
                            goodsDescription: 'Glazed Ceramic Tiles',
                            hasPreview: true,
                            hasHemd: true,
                            hasManifestPdf: true,
                            hasRadiationN42: true,
                            annotationCount: 1,
                            analysisResult: 'Clear',
                            fuzzyMatch: true,
                            matchedIdentifier: 'MSCU5285725',
                            timeDeltaSeconds: 18,
                        },
                    ],
                },
            });
        }).as('uffSearch');

        const inspected: string[] = [];
        const linked: string[] = [];

        cy.mount(
            <LanguageProvider>
                <CargoUffSmbPickerDialog
                    open
                    onClose={() => {}}
                    alarmTimestampIso="2026-11-20T14:58:28Z"
                    initialVehicleId="MSCU52B5725"
                    onInspectUff={(id) => inspected.push(id)}
                    onLinkUff={(id) => linked.push(id)}
                />
            </LanguageProvider>,
        );

        cy.wait('@uffSearch');
        cy.get(`[data-testid="uff-smb-match-${tier2Uuid}"]`).should('be.visible').and('contain.text', 'Glazed Ceramic Tiles');
        cy.get(`[data-testid="uff-smb-inspect-${tier2Uuid}"]`).click().then(() => {
            expect(inspected).to.deep.equal([tier2Uuid]);
        });

        // Paste full Windows UNC path for a Tier-1 sparse unlabelled UFF scan
        cy.get('[data-testid="uff-smb-picker-search-input"]')
            .clear()
            .type(`\\\\192.168.0.60\\oscar-uff\\smb-date-archive\\2026\\11\\20\\EAGLE-P60-LANE01\\${tier1Uuid}.uff`);
        cy.get('[data-testid="uff-smb-picker-submit"]').click();
        cy.wait('@uffSearch');

        cy.get(`[data-testid="uff-smb-match-${tier1Uuid}"]`).should('be.visible');
        cy.get(`[data-testid="uff-smb-link-${tier1Uuid}"]`).click().then(() => {
            expect(linked).to.deep.equal([tier1Uuid]);
        });
    });
});
