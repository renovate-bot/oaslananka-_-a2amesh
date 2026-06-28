import { runPnpmSync } from './check-utils.mjs';

runPnpmSync(['run', 'docs:api'], { stdio: 'inherit' });
