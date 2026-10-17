import { Link, useParams } from 'react-router'
import { PourRing } from '../components/PourRing'
import { sampleBeans } from './sampleBeans'

// Placeholder recipe (18 g, 1:16.7) until recipes exist (build step 6).
const pours = [
  { atS: 0, toG: 70 },
  { atS: 44, toG: 120 },
  { atS: 80, toG: 180 },
  { atS: 120, toG: 240 },
  { atS: 173, toG: 300 },
]
const specs = ['18 g', '96°', '1:16.7', '62 clicks']
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function BeanPage() {
  const { id } = useParams()
  const bean = sampleBeans.find((item) => item.id === id)
  const current = 3

  return (
    <>
      <div className="flex items-center gap-3">
        <Link
          to="/beans"
          aria-label="Back to beans"
          className="grid size-11 place-items-center rounded-full bg-soft text-lg"
        >
          ←
        </Link>
        <div>
          <h1 className="text-lg leading-tight font-medium">{bean?.name ?? 'Bean'}</h1>
          <p className="text-xs text-muted">V60 · sample recipe</p>
        </div>
      </div>

      <div className="mt-6">
        <PourRing pours={pours} current={current} />
      </div>

      <ul className="mt-4 flex flex-wrap justify-center gap-1.5">
        {specs.map((spec) => (
          <li key={spec} className="num rounded-full bg-soft px-3 py-1.5 text-xs">
            {spec}
          </li>
        ))}
      </ul>

      <ol className="mt-5 space-y-1">
        {pours.map((pour, index) => (
          <li
            key={pour.atS}
            className={`flex items-center gap-3 rounded-full py-2 pr-5 pl-2 ${
              index === current ? 'bg-accent-soft' : ''
            }`}
          >
            <span
              className={`grid size-8 place-items-center rounded-full text-xs ${
                index < current ? 'bg-accent text-accent-ink' : index === current ? 'bg-bg' : 'bg-soft'
              }`}
            >
              {index + 1}
            </span>
            <span className="num flex-1 text-sm">{clock(pour.atS)}</span>
            <span className="num text-sm">{pour.toG} g</span>
          </li>
        ))}
      </ol>
    </>
  )
}
