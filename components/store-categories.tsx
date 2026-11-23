"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, LayoutGrid, Menu } from "lucide-react";
import { categoryPath, categoryTree, type CategoryNode } from "@/lib/category-tree";
import type { Category } from "@/lib/shared";

type MenuState = { selected: string; activePath: Set<string>; close: () => void };

function CategoryItem({ node, selected, activePath, close }: MenuState & { node: CategoryNode }) {
  const listId = useId();
  const [expanded,setExpanded] = useState<boolean>();
  const open = expanded ?? activePath.has(node.id);
  const hasChildren = node.children.length > 0;
  return <li>
    <div className="store-category-row">
      <Link href={`/?category=${encodeURIComponent(node.id)}#products`} onClick={close}
        aria-current={node.id === selected ? "page" : undefined}>{node.name}</Link>
      {hasChildren && <button type="button" aria-expanded={open} aria-controls={listId}
        aria-label={`${open ? "بستن" : "باز کردن"} زیردسته‌های ${node.name}`} onClick={() => setExpanded(!open)}>
        <ChevronDown size={17} aria-hidden="true"/>
      </button>}
    </div>
    {hasChildren && <ul id={listId} className="store-category-children" hidden={!open}>
      {node.children.map(child => <CategoryItem key={child.id} node={child} selected={selected} activePath={activePath} close={close}/>)}
    </ul>}
  </li>;
}

export function StoreCategories({ groups }: { groups: Category[] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const selected = useSearchParams().get("category") ?? "";
  const activePath = new Set(categoryPath(groups,selected).map(node => node.id));

  function close() {
    if (menu.current) menu.current.open = false;
  }

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) close();
    }
    document.addEventListener("pointerdown",closeOutside);
    return () => document.removeEventListener("pointerdown",closeOutside);
  }, []);

  return <details ref={menu} className="store-categories" onKeyDown={event => {
    if (event.key === "Escape" && menu.current?.open) {
      event.preventDefault();
      close();
      trigger.current?.focus();
    }
  }}>
    <summary ref={trigger}><Menu size={19} aria-hidden="true"/> دسته‌بندی‌ها <ChevronDown size={15} aria-hidden="true"/></summary>
    <nav aria-label="دسته‌بندی‌های فروشگاه">
      <Link className="store-category-all" href="/#products" onClick={close}>
        <LayoutGrid size={17} aria-hidden="true"/> همهٔ کالاها
      </Link>
      {groups.length > 0 && <ul className="store-category-roots" key={selected}>
        {categoryTree(groups).map(node => <CategoryItem key={node.id} node={node} selected={selected} activePath={activePath} close={close}/>)}
      </ul>}
    </nav>
  </details>;
}
