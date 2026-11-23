import type { Category } from "./shared";

export type CategoryNode = Category & { children: CategoryNode[] };

export function categoryTree(categories: Category[]) {
  const nodes = new Map(categories.map(category => [category.id, { ...category, children: [] } as CategoryNode]));
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function categoryPath(categories: Category[], id: string) {
  const byId = new Map(categories.map(category => [category.id, category]));
  const path: Category[] = [];
  for (let node = byId.get(id); node; node = byId.get(node.parentId ?? "")) path.push(node);
  return path.reverse();
}

export function categoryOptions(categories: Category[], excludedId?: string) {
  const options: { id: string; label: string }[] = [];
  function visit(nodes: CategoryNode[], parentLabel = "") {
    for (const node of nodes) {
      if (node.id === excludedId) continue;
      const label = parentLabel ? `${parentLabel} / ${node.name}` : node.name;
      options.push({ id:node.id, label });
      visit(node.children,label);
    }
  }
  visit(categoryTree(categories));
  return options;
}
