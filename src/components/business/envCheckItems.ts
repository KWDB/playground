export type EnvCheckItem = {
  name: string;
  ok: boolean;
  message: string;
  details?: string;
};

const VISIBLE_ITEM_PREFIXES = ['服务健康检查 ('];
const VISIBLE_ITEM_NAMES = new Set(['Docker 环境', '镜像源可用性']);

export function isEnvCheckItemVisible(itemName: string): boolean {
  if (VISIBLE_ITEM_NAMES.has(itemName)) {
    return true;
  }
  return VISIBLE_ITEM_PREFIXES.some(prefix => itemName.startsWith(prefix));
}

export function filterVisibleEnvCheckItems(items?: EnvCheckItem[]): EnvCheckItem[] {
  if (!items) {
    return [];
  }
  return items.filter(item => isEnvCheckItemVisible(item.name));
}
