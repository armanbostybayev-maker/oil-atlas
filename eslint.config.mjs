export default [
  { ignores:['node_modules/**','dist/**','artifacts/**','data/archive/**','**/*.before-*.mjs','**/*.before-*.jsx','**/*.clean-before-*.jsx'] },
  {
    files:['**/*.mjs','**/*.jsx'],
    languageOptions:{ ecmaVersion:'latest',sourceType:'module',parserOptions:{ecmaFeatures:{jsx:true}} },
    rules:{
      'constructor-super':'error', 'for-direction':'error', 'getter-return':'error',
      'no-async-promise-executor':'error', 'no-class-assign':'error', 'no-compare-neg-zero':'error',
      'no-cond-assign':['error','except-parens'], 'no-const-assign':'error', 'no-dupe-args':'error',
      'no-dupe-class-members':'error', 'no-dupe-else-if':'error', 'no-duplicate-case':'error',
      'no-ex-assign':'error', 'no-func-assign':'error', 'no-loss-of-precision':'error',
      'no-new-native-nonconstructor':'error', 'no-obj-calls':'error', 'no-promise-executor-return':'error',
      'no-self-assign':'error', 'no-setter-return':'error', 'no-sparse-arrays':'error',
      'no-this-before-super':'error', 'no-unexpected-multiline':'error', 'no-unreachable':'error',
      'no-unsafe-finally':'error', 'no-unsafe-negation':'error', 'no-unsafe-optional-chaining':'error',
      'use-isnan':'error', 'valid-typeof':'error',
    },
  },
];
