module.exports = {
  // basic formatting
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  quoteProps: 'as-needed',
  tabWidth: 2,
  useTabs: false,

  // line length
  printWidth: 100,
  
  // spacing
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',

  // typescript specific
  parser: 'typescript',

  // end of line
  endOfLine: 'lf',

  // overrides for specific file types
  overrides: [
    {
      files: '*.json',
      options: {
        parser: 'json',
        printWidth: 80,
      },
    },
    {
      files: '*.md',
      options: {
        parser: 'markdown',
        printWidth: 80,
        proseWrap: 'always',
      },
    },
    {
      files: '*.yml',
      options: {
        parser: 'yaml',
        tabWidth: 2,
      },
    },
  ],
};