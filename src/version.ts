import manifest from '../package.json';

export const APP_VERSION = manifest.version.replace(/^(\d+\.\d+\.\d+)-(\d+)$/, '$1.$2');
