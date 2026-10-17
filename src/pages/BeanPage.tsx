import { Link, useParams } from 'react-router'

export function BeanPage() {
  const { id } = useParams()
  return (
    <>
      <Link to="/beans" className="inline-flex min-h-11 items-center text-sm text-muted">
        ← Beans
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Bean</h1>
      <p className="num mt-1 text-muted">{id}</p>
    </>
  )
}
