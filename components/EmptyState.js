'use client'
import Link from 'next/link'

// Tom liste med en forklaring og, hvis der er noget at gøre, en knap: <EmptyState text="..." href="/" action="Gennemse" />
export default function EmptyState({ text, hint, href, action }) {
  return (
    <div className="empty-state">
      <p>{text}</p>
      {hint && <p className="notice">{hint}</p>}
      {href && action && (
        <Link href={href} className="btn ghost">
          {action}
        </Link>
      )}
    </div>
  )
}
