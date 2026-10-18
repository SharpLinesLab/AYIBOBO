import { browse } from './browse';
import { catalog } from './catalog';
import { common } from './common';
import { legal } from './legal';
import { pages } from './pages';
import { player } from './player';

export const dict = { ...common, ...browse, ...pages, ...player, ...catalog, ...legal };
