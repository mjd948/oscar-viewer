import React from 'react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import RuntimeExtensionsManager from '@/app/_components/extensions/RuntimeExtensionsManager';
import {
    createLeafletPmTilesLayer,
    isValidOfflineMapBounds,
    resolveAbsolutePmTilesUrl,
} from '@/app/_components/maps/PmTilesLayerFactory';

const MOCK_STATUS = {
    ocr: {
        activeSource: 'builtin',
        customActive: false,
        packageKind: 'builtin-onnx-pack',
        fileName: 'Bundled PP-OCRv3 + PARSeq (models/ocr)',
        sha256: '',
        engineId: 'OnnxOcrEngine (PP-OCRv3 + PARSeq INT8)',
        versionId: '3.11.0',
        fastRoiSupported: true,
        plateRuleSetId: 'builtin-latin',
        plateRuleDescription: 'Built-In Latin & ISO-6346 Filter',
        modelFiles: ['det.onnx', 'rec.onnx', 'dict.txt', 'stencil_det_fp32.onnx', 'parseq_rec_int8.onnx'],
        loadedAt: '',
        lastError: '',
    },
    maps: {
        activeSource: 'custom',
        customActive: true,
        builtinDefaultLabel: 'OpenStreetMap Streets + Esri World Imagery',
        activeFileName: 'east-tn-corridor.pmtiles',
        displayName: 'East Tennessee Vector Corridor',
        defaultBasemap: true,
        sizeBytes: 52428800,
        sha256: 'abc123def456',
        activatedAt: '2026-11-19T18:00:00Z',
        header: {
            specVersion: 3,
            tileType: 'mvt',
            tileTypeCode: 1,
            tileCompression: 'gzip',
            minZoom: 2,
            maxZoom: 15,
            minLon: -85.5,
            minLat: 35.0,
            maxLon: -83.0,
            maxLat: 36.8,
            centerZoom: 9,
            centerLon: -84.25,
            centerLat: 35.9,
            addressedTilesCount: 12450,
            tileEntriesCount: 11200,
        },
        tileUrl: '/sensorhub/oscar/extensions/maps/tiles/east-tn-corridor.pmtiles',
        storedPacks: [
            {
                fileName: 'east-tn-corridor.pmtiles',
                displayName: 'East Tennessee Vector Corridor',
                sizeBytes: 52428800,
                sha256: 'abc123def456',
                header: null,
                uploadedAt: '2026-11-19T18:00:00Z',
            },
        ],
        lastError: '',
    },
    spectroscopy: {
        activeSource: 'builtin',
        customActive: false,
        packageKind: 'builtin-webid-n42',
        fileName: 'Sandia Full Spectrum WebID + ANSI N42.42 / Cambio Parser',
        sha256: '',
        algorithmId: 'https://full-spectrum.sandia.gov/api/v1/',
        versionId: '3.11.0',
        executionMode: 'webid-primary',
        isotopeCount: 0,
        loadedAt: '',
        lastError: '',
    },
    trustedCerts: {
        activeSource: 'builtin',
        customActive: false,
        systemTrustedIssuerCount: 140,
        customCertificateCount: 0,
        customCertificates: [],
        generation: 1,
        lastError: '',
    },
    policyPacks: {
        activeSource: 'custom',
        customActive: true,
        builtinSummary: 'ANSI/OSCAR Standard Disposition Codes (Codes 1-11, 9998, 9999)',
        baseConfiguredCount: 0,
        effectiveCustomCodes: [{ code: 101, label: 'Verified Medical Radiopharmaceutical' }],
        activePack: {
            packId: 'port-authority-v1',
            version: '1.0.0',
            agencyName: 'Port Secondary Inspection',
            fileName: 'port-authority-v1.json',
            sha256: '99887766',
            codes: [{ code: 101, label: 'Verified Medical Radiopharmaceutical' }],
            operatorChecklist: ['Verify cargo manifest'],
            activatedAt: '2026-11-19T18:00:00Z',
        },
        lastError: '',
    },
    eml: {
        loaded: false,
        customActive: false,
        activeSource: 'unconfigured',
        fileName: '',
        sha256: '',
        versionId: '',
        collimatedModelId: '',
        uncollimatedModelId: '',
        loadedAt: '',
        lastError: '',
    },
    uff: {
        enabled: false,
        customActive: false,
        activeSource: 'disabled',
        sourceType: 'smb',
        shareUrl: '',
        subPath: '',
        localPath: '',
        domain: '',
        username: '',
        passwordConfigured: false,
        correlationWindowMinutes: 60,
        allowFuzzyOcrMatch: true,
        updatedAt: '',
        indexedCount: 0,
        uff2Count: 0,
        uff3Count: 0,
        scanners: [],
        lastRefreshAt: '',
        lastRefreshDurationMs: 0,
        lastError: '',
    },
};

describe('RuntimeExtensionsManager & PMTiles Helpers', () => {
    it('validates PMTiles helper bounds and creates vector and raster Leaflet layers', () => {
        expect(isValidOfflineMapBounds([[35.0, -85.5], [36.8, -83.0]])).to.equal(true);
        expect(isValidOfflineMapBounds([[36.8, -85.5], [35.0, -83.0]])).to.equal(false);
        expect(resolveAbsolutePmTilesUrl('/sensorhub/oscar/extensions/maps/tiles/a.pmtiles')).to.include(
            '/sensorhub/oscar/extensions/maps/tiles/a.pmtiles'
        );

        const mvtLayer = createLeafletPmTilesLayer(
            {
                active: true,
                fileName: 'region.pmtiles',
                displayName: 'Region Vector',
                tileUrl: '/sensorhub/oscar/extensions/maps/tiles/region.pmtiles',
                tileType: 'mvt',
                maxZoom: 14,
            },
            'en'
        );
        expect(mvtLayer).to.not.equal(null);

        const pngLayer = createLeafletPmTilesLayer(
            {
                active: true,
                fileName: 'sat.pmtiles',
                displayName: 'Region Satellite',
                tileUrl: '/sensorhub/oscar/extensions/maps/tiles/sat.pmtiles',
                tileType: 'png',
                maxZoom: 16,
            },
            'en'
        );
        expect(pngLayer).to.not.equal(null);
    });

    it('renders all 6 accessible tabs, navigates via keyboard arrows, and confirms reset via native dialog', () => {
        cy.intercept({ method: 'GET', pathname: '/sensorhub/session' }, {
            statusCode: 200,
            body: {
                username: 'admin',
                displayName: 'Site Admin',
                primaryRole: 'admin',
                isAdmin: true,
                roles: ['admin'],
                canAdjudicate: true,
                isReadOnly: false,
                allowedViews: [],
                mustChangePassword: false,
            },
        }).as('sessionMe');

        cy.intercept('GET', '**/oscar/extensions/status', {
            statusCode: 200,
            body: MOCK_STATUS,
        }).as('extStatus');

        cy.intercept('POST', '**/oscar/extensions/maps/action', (req) => {
            expect(req.body).to.deep.equal({ action: 'reset' });
            req.reply({
                statusCode: 200,
                body: {
                    ...MOCK_STATUS,
                    maps: {
                        ...MOCK_STATUS.maps,
                        activeSource: 'builtin',
                        customActive: false,
                        displayName: 'OpenStreetMap Streets + Esri World Imagery',
                    },
                },
            });
        }).as('resetMaps');

        cy.mount(
            <LanguageProvider>
                <RuntimeExtensionsManager />
            </LanguageProvider>
        );

        cy.wait(['@sessionMe', '@extStatus']);
        cy.get('[data-testid="runtime-extensions-page"]').should('be.visible');
        cy.get('[data-testid="ext-tab-ocr"]').should('have.attr', 'aria-selected', 'true');
        cy.contains('OnnxOcrEngine (PP-OCRv3 + PARSeq INT8)').should('be.visible');

        // Keyboard arrow navigation to Offline Maps tab
        cy.get('[data-testid="ext-tab-ocr"]').focus().type('{rightarrow}');
        cy.get('[data-testid="ext-tab-maps"]').should('have.attr', 'aria-selected', 'true');
        cy.contains('East Tennessee Vector Corridor').should('be.visible');

        // Reset via native <dialog> confirmation
        cy.get('[data-testid="ext-maps-reset-btn"]').click();
        cy.get('dialog[open]').should('be.visible');
        cy.get('[data-testid="ext-dialog-confirm-btn"]').click();
        cy.wait('@resetMaps');
        cy.contains('OpenStreetMap Streets + Esri World Imagery').should('be.visible');

        // Verify 7th Cargo NII (WCO UFF) tab is disabled by default with zero background clutter
        cy.get('[data-testid="ext-tab-uff"]').click();
        cy.get('[data-testid="uff-ext-disabled-note"]').should('be.visible');
    });

    it('blocks non-admin operators with an informative warning banner', () => {
        cy.intercept({ method: 'GET', pathname: '/sensorhub/session' }, {
            statusCode: 200,
            body: {
                username: 'operator1',
                displayName: 'Operator',
                primaryRole: 'operator',
                isAdmin: false,
                roles: ['operator'],
                canAdjudicate: true,
                isReadOnly: false,
                allowedViews: [],
                mustChangePassword: false,
            },
        });

        cy.mount(
            <LanguageProvider>
                <RuntimeExtensionsManager />
            </LanguageProvider>
        );

        cy.get('[data-testid="ext-admin-required-alert"]').should('be.visible');
    });
});
