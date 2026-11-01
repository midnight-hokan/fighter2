// 占位角色：复制示例角色的招式，只为让 8 人选人页和对战能先跑起来。
// 【R1 由大炮替换】每个占位角色都要改成原创角色（独立招式、独立流派），并删除 placeholder 标记。
import base from './c01.js';

export function makePlaceholder(id, primary) {
  const c = JSON.parse(JSON.stringify(base));
  return {
    ...c,
    id,
    name: `待设计${id.slice(1)}`,
    title: '占位角色',
    style: '占位：等待原创设计',
    archetype: 'placeholder',
    colors: { ...c.colors, primary },
    ending: '占位结局。',
    placeholder: true,
  };
}
