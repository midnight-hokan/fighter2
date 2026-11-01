// 当前主题。换主题只改这一行。
import theme from './meilong/theme.js';

export default theme;
export const ROSTER = theme.roster;
export function getCharacter(id) {
  return theme.roster.find(c => c.id === id) ?? theme.roster[0];
}
