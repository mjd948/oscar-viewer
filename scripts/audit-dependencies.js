#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

// Advisories with no upstream patched version on npm yet (first_patched_version: null)
// that exist strictly in build/test-time tooling (Babel/Vite/Cypress) and are never
// bundled into OSCAR Viewer's exported static runtime assets.
const UNPATCHED_BUILD_ONLY_ALLOWLIST = new Map([
    [
        'GHSA-fc5q-39xc-vjpf',
        'picomatch <=4.0.7 build/test-only ReDoS (no upstream fix published yet; not shipped in browser bundle)',
    ],
]);

const res = spawnSync('npm', ['audit', '--audit-level=low', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 32 * 1024 * 1024,
});

if (!res.stdout) {
    console.error(res.stderr || 'npm audit produced no JSON output');
    process.exit(res.status || 1);
}

let report;
try {
    report = JSON.parse(res.stdout);
} catch (err) {
    console.error('Failed to parse npm audit JSON:', err.message);
    process.exit(1);
}

const vulns = report.vulnerabilities || {};
const directAdvisories = new Map();
for (const pkg of Object.values(vulns)) {
    for (const via of pkg.via || []) {
        if (via && typeof via === 'object' && typeof via.url === 'string') {
            const match = via.url.match(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i);
            const id = match ? match[0] : via.url;
            directAdvisories.set(id, { pkg: pkg.name, severity: via.severity, title: via.title, url: via.url });
        }
    }
}

const actionable = [];
for (const [id, info] of directAdvisories.entries()) {
    if (UNPATCHED_BUILD_ONLY_ALLOWLIST.has(id)) {
        console.log(`[audit:allowlisted] ${id} (${info.pkg}): ${UNPATCHED_BUILD_ONLY_ALLOWLIST.get(id)}`);
    } else {
        actionable.push({ id, ...info });
    }
}

if (actionable.length > 0) {
    console.error('Actionable npm dependency vulnerabilities detected:');
    for (const item of actionable) {
        console.error(`- [${item.severity}] ${item.id} in ${item.pkg}: ${item.title} (${item.url})`);
    }
    process.exit(1);
}

console.log('npm dependency security audit passed (0 actionable vulnerabilities).');
