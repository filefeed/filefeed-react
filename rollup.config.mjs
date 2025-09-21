import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import alias from '@rollup/plugin-alias';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

export default {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    {
      file: pkg.module || 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
  ],
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    '@mantine/core',
    '@mantine/hooks',
    '@mantine/form',
    '@mantine/dropzone',
    '@mantine/notifications',
    '@mantine/modals',
    '@mantine/dates',
    '@tabler/icons-react',
    'papaparse',
    'xlsx',
    'jschardet',
    'zustand',
    'lodash',
    'date-fns',
    'react-beautiful-dnd',
    'react-table',
  ],
  plugins: [
    alias({
      entries: [{ find: '@/', replacement: 'src/' }],
    }),
    resolve({
      browser: true,
      preferBuiltins: false,
      extensions: ['.mjs', '.js', '.json', '.node', '.ts', '.tsx'],
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.lib.json',
      declaration: false,
      rootDir: 'src',
    }),
  ],
};