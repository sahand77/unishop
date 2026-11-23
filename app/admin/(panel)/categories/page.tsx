import Link from "next/link";
import { Folder, FolderTree, Pencil, Plus } from "lucide-react";
import { CategoryForm } from "@/components/admin-forms";
import { categories } from "@/lib/catalog";
import { categoryOptions, categoryTree, type CategoryNode } from "@/lib/category-tree";
import { requireAdmin } from "@/lib/auth";

function CategoryList({ nodes, selectedId }: { nodes: CategoryNode[]; selectedId?: string }) {
  return <ul className="admin-category-tree">{nodes.map(node => <li key={node.id}>
    <Link href={`/admin/categories?edit=${encodeURIComponent(node.id)}#category-editor`}
      aria-current={node.id === selectedId ? "page" : undefined}>
      {node.children.length ? <FolderTree size={17} aria-hidden="true"/> : <Folder size={17} aria-hidden="true"/>}
      <span>{node.name}</span><Pencil className="category-edit-icon" size={15} aria-hidden="true"/>
    </Link>
    {node.children.length > 0 && <CategoryList nodes={node.children} selectedId={selectedId}/>}
  </li>)}</ul>;
}

export default async function Categories({ searchParams }: {
  searchParams: Promise<{ edit?: string | string[]; parent?: string | string[] }>;
}) {
  await requireAdmin();
  const [groups, params] = await Promise.all([categories(), searchParams]);
  const selected = groups.find(group => group.id === params.edit);
  const defaultParent = groups.find(group => group.id === params.parent)?.id;
  return <div className="flow"><h1>دسته‌بندی‌ها</h1><div className="split admin-split">
    <section className="panel flow">
      <div className="section-head"><h2>دسته‌های فروشگاه</h2>
        {selected && <Link href="/admin/categories#category-editor"><Plus size={17} aria-hidden="true"/> افزودن دسته</Link>}
      </div>
      {groups.length ? <CategoryList nodes={categoryTree(groups)} selectedId={selected?.id}/>
        : <p className="muted">هنوز دسته‌ای تعریف نشده است.</p>}
    </section>
    <section className="panel flow" id="category-editor">
      <div className="section-head"><h2>{selected ? "ویرایش دسته" : "افزودن دسته"}</h2>
        {selected && <Link href={`/admin/categories?parent=${encodeURIComponent(selected.id)}#category-editor`}>
          <Plus size={17} aria-hidden="true"/> افزودن زیردسته
        </Link>}
      </div>
      <CategoryForm key={selected?.id ?? `new-${defaultParent ?? ""}`} category={selected}
        parents={categoryOptions(groups,selected?.id)} defaultParent={defaultParent}/>
    </section>
  </div></div>;
}
