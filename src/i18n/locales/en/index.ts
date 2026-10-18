import { boost } from './boost';
import { boostPages } from './boostPages';
import { browse } from './browse';
import { common } from './common';
import { pages } from './pages';
import { player } from './player';

export const dict = { ...common, ...browse, ...pages, ...player, ...boost, ...boostPages };
