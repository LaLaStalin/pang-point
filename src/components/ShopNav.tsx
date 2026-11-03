import Link from "next/link";

const LINKS = [
  { href: "/", label: "ขาย" },
  { href: "/adjust", label: "ตัด stock" },
];

export function ShopNav({ active }: { active: string }) {
  return (
    <nav className="border-b border-stone-100 bg-white shadow-[0_4px_16px_-8px_rgba(120,53,15,0.15)]">
      <div className="mx-auto flex max-w-3xl gap-1 px-4 py-2">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex-1 rounded-full px-3.5 py-2 text-center whitespace-nowrap transition-colors ${
              active === l.href
                ? "bg-amber-500 font-semibold text-white shadow-sm shadow-amber-500/30"
                : "font-medium text-stone-500 hover:bg-amber-50 hover:text-amber-800"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
