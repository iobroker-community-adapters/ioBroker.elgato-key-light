import config from '@iobroker/eslint-config';

export default [
    {
        ignores: [
            '.dev-server/',
            '.npm-cache/',
            '.integration-temp/',
            '.git/',
            '.test-build/',
            '.vscode/',
            'admin/',
            'build/',
            'node_modules/',
            'src-admin/',
            'src-tab/',
            'test/',
            '**/adapter-config.d.ts',
        ],
    },
    ...config,
    {
        files: ['src/**/*.ts', 'scripts/**/*.ts'],
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',
            'jsdoc/no-blank-blocks': 'off',
        },
    },
    {
        files: ['src/**/*.test.ts'],
        rules: {
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/no-base-to-string': 'off',
        },
    },
];
