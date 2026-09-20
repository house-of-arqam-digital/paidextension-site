const js = require('@eslint/js');

module.exports = [
  {
    files: ['docs/**/*.js'],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        performance: 'readonly',
        IntersectionObserver: 'readonly',
        URLSearchParams: 'readonly',
        Paddle: 'readonly',
        fetch: 'readonly',
        Promise: 'readonly'
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['error', { caughtErrorsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'off'
    }
  }
];
