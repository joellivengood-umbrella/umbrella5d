import Link from 'next/link'
import type {
  MachinePartWithLessons,
  MachineLessonSummary,
} from '@/lib/machine-queries'
import { AssignLessonToPart } from './AssignLessonToPart'

const ORDINALS = [
  'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
]
const ordinal = (n: number) => ORDINALS[n - 1] ?? String(n)

function StatusPill({ published }: { published: boolean }) {
  return (
    <span className={`admin-pill ${published ? 'admin-pill--ok' : 'admin-pill--draft'}`}>
      {published ? 'Published' : 'Draft'}
    </span>
  )
}

function LessonActions({ id }: { id: string }) {
  return (
    <span className="mas-lesson__actions">
      <Link href={`/admin/machine/${id}`}>Settings</Link>
      <Link href={`/admin/machine/${id}/blocks`} className="mas-lesson__content">
        Edit content →
      </Link>
    </span>
  )
}

/**
 * The 5D Machine admin home: Parts shown in order with their lessons
 * grouped underneath, plus an unmissable "Unassigned" section so lessons
 * that aren't in a Part (and therefore invisible in the course) are easy
 * to spot and slot in.
 */
export function MachineAdminList({
  parts,
  unassigned,
}: {
  parts: MachinePartWithLessons[]
  unassigned: MachineLessonSummary[]
}) {
  const partOptions = parts.map((p) => ({
    id: p.id,
    sortIndex: p.sortIndex,
    title: p.title,
  }))

  return (
    <>
      <div className="admin-toolbar">
        <Link href="/admin/machine/new" className="btn btn--primary">
          + New lesson
        </Link>
        <Link href="/admin/machine/parts" className="btn btn--secondary">
          Manage Parts
        </Link>
      </div>

      {parts.length === 0 && unassigned.length === 0 && (
        <div className="admin-empty">
          Nothing here yet.{' '}
          <Link href="/admin/machine/parts">Create your first Part</Link>, then
          add lessons to it.
        </div>
      )}

      {parts.map((part) => (
        <section key={part.id} className="mas-part">
          <header className="mas-part__head">
            <div>
              <span className="mas-part__eyebrow">Part {ordinal(part.sortIndex)}</span>
              <h2 className="mas-part__title">{part.title}</h2>
            </div>
            <StatusPill published={part.isPublished} />
          </header>

          {part.lessons.length === 0 ? (
            <p className="mas-empty">
              No lessons yet.{' '}
              <Link href="/admin/machine/new">Add one</Link> and choose this Part.
            </p>
          ) : (
            <ul className="mas-lessons">
              {part.lessons.map((l) => (
                <li key={l.id} className="mas-lesson">
                  <span className="mas-lesson__num">
                    {part.sortIndex}.{l.partSortIndex ?? '?'}
                  </span>
                  <Link href={`/admin/machine/${l.id}`} className="mas-lesson__title">
                    {l.title || <span className="admin-muted">(untitled)</span>}
                  </Link>
                  <StatusPill published={l.isPublished} />
                  <LessonActions id={l.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {unassigned.length > 0 && (
        <section className="mas-part mas-unassigned">
          <header className="mas-part__head">
            <div>
              <span className="mas-part__eyebrow mas-part__eyebrow--warn">
                Unassigned
              </span>
              <h2 className="mas-part__title">Lessons not in a Part</h2>
            </div>
          </header>
          <p className="mas-unassigned__note">
            These won&apos;t appear in the course until they&apos;re in a Part.
            Pick one below to slot it in.
          </p>
          <ul className="mas-lessons">
            {unassigned.map((l) => (
              <li key={l.id} className="mas-lesson mas-lesson--unassigned">
                <Link href={`/admin/machine/${l.id}`} className="mas-lesson__title">
                  {l.title || <span className="admin-muted">(untitled)</span>}
                </Link>
                <StatusPill published={l.isPublished} />
                {partOptions.length > 0 ? (
                  <AssignLessonToPart lessonId={l.id} parts={partOptions} />
                ) : (
                  <span className="admin-muted mas-nopart">Create a Part first</span>
                )}
                <LessonActions id={l.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
