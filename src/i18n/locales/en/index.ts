import { account } from './account';
import { browse } from './browse';
import { common } from './common';
import { legal } from './legal';
import { pages } from './pages';
import { player } from './player';

export const dict = { ...common, ...browse, ...pages, ...player, ...legal, ...account };
