import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'build/**/*']
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
