import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <>
      <h1 className="text-[2rem] leading-tight font-medium tracking-tight">Page not found</h1>
      <Link to="/beans" className="mt-4 inline-flex h-11 items-center rounded-full bg-accent-soft px-5 text-accent">
        Back to beans
      </Link>
    </>
  )
}
