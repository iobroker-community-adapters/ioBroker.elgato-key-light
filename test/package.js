const path = require('path');
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { tests } = require('@iobroker/testing');

// Validate the package files
tests.packageFiles(path.join(__dirname, '..'));

describe('Moment locale loading regression (GHSA-4p3w-j4w9-5jqw)', () => {
    for (const project of ['.', 'src-admin', 'src-tab']) {
        it(`${project}: rejects crafted locale paths and preserves date formatting`, () => {
            const requests = [];
            const sandbox = {
                module: { exports: {} },
                exports: {},
                require: name => {
                    requests.push(name);
                    throw new Error('Locale loading intercepted by regression test');
                },
            };
            const source = require.resolve('moment', { paths: [path.join(__dirname, '..', project)] });
            vm.runInNewContext(fs.readFileSync(source, 'utf8'), sandbox);
            const moment = sandbox.module.exports;
            const names = [
                { match: () => true, toString: () => '../security-probe' },
                { match: () => true, toString: () => '..\\security-probe' },
                '../security-probe',
            ];
            for (const [index, parentLocale] of names.entries()) {
                // Rejection may throw or return without loading a module.
                try {
                    moment.defineLocale(`security-probe-${index}`, { parentLocale });
                } catch {
                    // The security invariant is no dynamic require for this input.
                }
            }
            assert.deepEqual(requests, []);
            assert.equal(moment.utc('2026-10-13').locale('en').format('YYYY-MM-DD'), '2026-10-13');
        });
    }
});
