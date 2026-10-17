import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/beans" className="mt-4 inline-flex min-h-11 items-center text-accent">
        Back to beans
      </Link>
    </>
  )
}
