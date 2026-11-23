import Link from "next/link";
import { fa } from "@/lib/shared";

export function ProductPagination({ page, hasNext, href }: {
  page: number;
  hasNext: boolean;
  href: (page: number) => string;
}) {
  if (page === 1 && !hasNext) return null;

  return <nav className="product-pagination" aria-label="صفحه‌بندی کالاها">
    {page > 1 && <Link className="button" href={href(page - 1)} rel="prev">صفحهٔ قبل</Link>}
    <span aria-current="page">صفحهٔ {fa(page)}</span>
    {hasNext && <Link className="button" href={href(page + 1)} rel="next">صفحهٔ بعد</Link>}
  </nav>;
}
