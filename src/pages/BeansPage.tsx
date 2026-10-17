import { Link } from 'react-router'

// Placeholder data until the beans feature exists (build step 5).
const sample = [
  { id: 'sample-1', name: 'Elto Arbegona', roaster: 'Coffea Circulor', status: 'Locked', tint: 'bg-tint-sand', grams: 142 },
  { id: 'sample-2', name: 'Pink Bourbon', roaster: "Father's", status: 'Dialing in, brew 2', tint: 'bg-tint-rose', grams: 220 },
  { id: 'sample-3', name: 'Tanzania Geisha', roaster: 'Placeholder Roasters', status: 'Not brewed yet', tint: 'bg-tint-sage', grams: 250 },
]

export function BeansPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Beans</h1>
      <p className="mt-1 text-muted">Sample beans for layout only.</p>
      <ul className="mt-6 divide-y divide-hairline">
        {sample.map((bean) => (
          <li key={bean.id}>
            <Link to={`/beans/${bean.id}`} className="flex min-h-16 items-center gap-4 py-3">
              <span className={`size-14 shrink-0 rounded-xl ${bean.tint}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{bean.name}</span>
                <span className="block truncate text-sm text-muted">
                  {bean.roaster} · {bean.status}
                </span>
              </span>
              <span className="num text-sm text-muted">{bean.grams} g</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
