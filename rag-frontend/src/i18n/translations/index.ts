import { en } from './en';
import { de } from './de';
import { pl } from './pl';
import { no } from './no';
import { ar } from './ar';

export type TranslationTree = typeof en;

export const translations: Record<string, TranslationTree> = { en, de, pl, no, ar };
