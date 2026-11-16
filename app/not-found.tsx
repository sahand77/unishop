import Link from "next/link";

export default function NotFound() {
  return <main className="wrap narrow flow"><section className="panel flow">
    <h1>صفحه پیدا نشد</h1><p>ممکن است نشانی تغییر کرده باشد.</p>
    <Link className="button primary" href="/">بازگشت به فروشگاه</Link>
  </section></main>;
}