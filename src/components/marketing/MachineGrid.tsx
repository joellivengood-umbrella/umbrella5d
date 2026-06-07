/**
 * The 5D Machine segment grid, the visual centerpiece of the 5D
 * Machine marketing page. Mirrors how the real product lays the
 * program out: thirty numbered segments, grouped into the five
 * dimensions, six per dimension.
 *
 * Segment titles are evocative placeholders for the marketing visual,
 * meant to be refined against the real program content later. Pure
 * presentation, no data fetching.
 */

type Dimension = {
  key: string
  name: string
  tagline: string
  segments: string[]
}

const DIMENSIONS: ReadonlyArray<Dimension> = [
  {
    key: 'core',
    name: 'Core',
    tagline: 'Find the strongest version of your business',
    segments: [
      'Name the real business you are in',
      'Map where the money actually comes from',
      'Cut what quietly drains profit',
      'Define your profit engine',
      'Set the one number that matters',
      'Build your profit baseline',
    ],
  },
  {
    key: 'expansion',
    name: 'Expansion',
    tagline: 'Grow outward with services and alliances',
    segments: [
      'Find the next dollar from current customers',
      'Design a high margin service',
      'Package an offer worth paying more for',
      'Build a strategic alliance',
      'Open a second line of revenue',
      'Price for profit, not for fear',
    ],
  },
  {
    key: 'flow',
    name: 'Flow',
    tagline: 'Remove the friction between you and the sale',
    segments: [
      'Walk your customer’s real journey',
      'Find the friction that costs you sales',
      'Shorten the path to yes',
      'Remove the silent dealbreakers',
      'Make buying effortless',
      'Win back the ones who left',
    ],
  },
  {
    key: 'loyalty',
    name: 'Loyalty',
    tagline: 'Turn customers into people who stay',
    segments: [
      'Learn what your customer truly values',
      'Turn a transaction into a relationship',
      'Build a reason to come back',
      'Create advocates, not just buyers',
      'Handle failure so it builds trust',
      'Make loyalty a system, not luck',
    ],
  },
  {
    key: 'engine',
    name: 'Engine',
    tagline: 'Build a running source of new profit',
    segments: [
      'Build your idea pipeline',
      'Test small before you bet big',
      'Turn your team into a profit radar',
      'Make improvement a weekly habit',
      'Measure what actually moved profit',
      'Lock in the gains and compound them',
    ],
  },
]

export function MachineGrid() {
  // Running start index for each dimension, so segments number 1..30
  // continuously across the five groups. Computed up front (not inside
  // the render callbacks) to keep the render pure.
  const startIndex: number[] = []
  let acc = 0
  for (const dim of DIMENSIONS) {
    startIndex.push(acc)
    acc += dim.segments.length
  }

  return (
    <div className="mg">
      {DIMENSIONS.map((dim, di) => (
        <section key={dim.key} className={`mg-dim mg-dim--${dim.key}`}>
          <header className="mg-dim__head">
            <span className="mg-dim__index">D{di + 1}</span>
            <div>
              <h3 className="mg-dim__name">{dim.name}</h3>
              <p className="mg-dim__tagline">{dim.tagline}</p>
            </div>
          </header>
          <ol className="mg-dim__list">
            {dim.segments.map((title, si) => {
              const n = startIndex[di] + si + 1
              return (
                <li key={n} className="mg-seg">
                  <span className="mg-seg__num">{String(n).padStart(2, '0')}</span>
                  <span className="mg-seg__title">{title}</span>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
