'use client'

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import type { DailyActive } from '@/lib/admin-analytics'
import { formatCount, formatDay, formatDayLong } from './format'

// Single series, so one hue: the brand violet (validated: passes the
// lightness band, chroma floor and >=3:1 contrast on the white card).
const SERIES = '#5b4fff'
const HEIGHT = 240
const M = { top: 18, right: 22, bottom: 30, left: 44 }
/** Px between the crosshair and a tooltip placed beside it. */
const TIP_GAP = 12

/** A clean integer tick step giving ~4 gridlines (counts are whole people). */
function tickStep(max: number): number {
  if (max <= 0) return 1
  const rough = max / 4
  const pow = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow
  return Math.max(1, Math.round(step))
}

type Point = DailyActive & { partial: boolean }

/**
 * Daily active members over the selected range: a 2px line over a 10% wash,
 * hairline gridlines, an end-point label on the last COMPLETE day, and —
 * when given — today as a hollow point on a dashed segment ("today so far"),
 * so an unfinished day never reads as a drop. A crosshair tooltip snaps to
 * the nearest day (pointer hover, a tap, or arrow keys once focused), sits
 * in the half of the plot the point isn't in so it never hides it, and
 * stays inside the card. Every value is also in the "View as table" twin.
 */
export function ActiveMembersChart({
  data,
  today = null,
}: {
  data: DailyActive[]
  today?: DailyActive | null
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  // Same first-render width on server and client (no hydration mismatch);
  // the ResizeObserver then sizes the drawing to the real card width. The
  // drawing never goes below 280 units (it scales down instead), but the
  // tooltip placement follows the real box width.
  const [boxW, setBoxW] = useState(720)
  const width = Math.max(280, boxW)
  // The selected day, tagged with the series it was picked from: a new
  // series (another range or partner, or history back/forward) starts with
  // nothing selected.
  const [sel, setSel] = useState<{ i: number; of: DailyActive[] } | null>(null)
  const active = sel && sel.of === data ? sel.i : null
  const setActive = (i: number | null) => setSel(i === null ? null : { i, of: data })
  // The day a touch or pen press is holding. Its lift (which also fires
  // pointerleave), a later hover pass, or the chart moving out from under
  // the pen falls back to it instead of clearing; a press elsewhere, a
  // gesture the browser takes over, or a blur lets it go.
  const held = useRef<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setBoxW(Math.round(w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Touch has no hover to leave: a press anywhere outside the plot puts a
  // held day away (whether or not the tap also focused the plot).
  useEffect(() => {
    const onDown = (e: globalThis.PointerEvent) => {
      if (held.current !== null && !plotRef.current?.contains(e.target as Node)) {
        held.current = null
        setSel(null)
      }
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [])

  // ...and nothing held: a day held on the old series means nothing now.
  useEffect(() => {
    held.current = null
  }, [data])

  const points: Point[] = useMemo(
    () => [
      ...data.map((d) => ({ ...d, partial: false })),
      ...(today ? [{ ...today, partial: true }] : []),
    ],
    [data, today]
  )
  const n = points.length
  const complete = data.length // index of the last complete day is complete - 1
  const max = points.reduce((m, d) => Math.max(m, d.active), 0)
  const peak = data.reduce<DailyActive | null>((best, d) => (!best || d.active > best.active ? d : best), null)

  const geo = useMemo(() => {
    const step = tickStep(max)
    const top = Math.max(step, Math.ceil(max / step) * step)
    const ticks: number[] = []
    for (let v = 0; v <= top; v += step) ticks.push(v)
    const innerW = width - M.left - M.right
    const innerH = HEIGHT - M.top - M.bottom
    const x = (i: number) => M.left + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1))
    const y = (v: number) => M.top + innerH - (v / top) * innerH
    const path = (from: number, to: number) =>
      points
        .slice(from, to + 1)
        .map((d, j) => `${j ? 'L' : 'M'}${x(from + j).toFixed(1)},${y(d.active).toFixed(1)}`)
        .join('')
    const last = complete - 1
    const line = complete > 0 ? path(0, last) : ''
    const area =
      complete > 0
        ? `${line}L${x(last).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`
        : ''
    const todaySeg = today && complete > 0 ? path(last, complete) : ''
    // X labels: as many as fit (~70px apart), always the first and last day.
    const room = Math.max(2, Math.floor(innerW / 70))
    const every = Math.max(1, Math.ceil(n / room))
    const xTicks: number[] = []
    for (let i = 0; i < n; i += every) {
      // Skip a tick that would crowd the always-shown last label.
      if (n - 1 - i >= every * 0.8 || i === 0) xTicks.push(i)
    }
    if (n > 1) xTicks.push(n - 1)
    return { ticks, innerW, x, y, line, area, todaySeg, xTicks }
  }, [points, max, n, complete, today, width])

  // Place the tooltip once it's measured (before paint): beside the
  // crosshair on the roomier side when it fits, otherwise centered on it —
  // always inside the plot, since the card clips anything that spills out.
  // Its vertical half already keeps it off the point, so centering is safe.
  useLayoutEffect(() => {
    const plot = plotRef.current
    const tip = tipRef.current
    if (active === null || !plot || !tip) return
    const plotW = plot.clientWidth
    const tipW = tip.offsetWidth
    const px = (geo.x(active) / width) * plotW
    const after = px + TIP_GAP
    const before = px - TIP_GAP - tipW
    let left: number
    if (px > plotW / 2 && before >= 0) left = before
    else if (after + tipW <= plotW) left = after
    else if (before >= 0) left = before
    else left = Math.min(Math.max(0, px - tipW / 2), Math.max(0, plotW - tipW))
    tip.style.left = `${left}px`
  }, [active, geo, width, boxW])

  if (n === 0 || max === 0) {
    return (
      <div ref={wrapRef} className="analytics-chart">
        <div className="analytics-empty">
          No member activity in this period yet. Logins, course opens and
          completions will show up here as they happen.
        </div>
      </div>
    )
  }

  function indexAt(clientX: number, svg: SVGSVGElement): number {
    const rect = svg.getBoundingClientRect()
    const vx = ((clientX - rect.left) / rect.width) * width
    if (n <= 1) return 0
    const i = Math.round(((vx - M.left) / geo.innerW) * (n - 1))
    return Math.min(n - 1, Math.max(0, i))
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const i = indexAt(e.clientX, e.currentTarget)
    setActive(i)
    // A finger or pen scrubbing in contact moves the held day with it.
    if (e.pointerType !== 'mouse' && e.buttons !== 0) held.current = i
  }

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    const i = indexAt(e.clientX, e.currentTarget)
    setActive(i)
    held.current = e.pointerType === 'mouse' ? null : i
  }

  function onPointerLeave() {
    // Back to the held day (a lifted finger or pen also "leaves"), or clear.
    setActive(held.current)
  }

  function onPointerCancel() {
    // The browser took the gesture over (a scroll), so drop the day.
    held.current = null
    setActive(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const cur = active ?? n - 1
    let next = cur
    if (e.key === 'ArrowLeft') next = cur - 1
    else if (e.key === 'ArrowRight') next = cur + 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else return
    e.preventDefault()
    const i = Math.min(n - 1, Math.max(0, next))
    setActive(i)
    if (held.current !== null) held.current = i
  }

  const lastDone = complete > 0 ? data[complete - 1] : null
  const point = active !== null ? points[active] : null
  const pointX = active !== null ? geo.x(active) : 0
  const pointY = point ? geo.y(point.active) : 0
  // In the half the point isn't in (left is set once measured, above).
  const tipTop = pointY < HEIGHT / 2 ? '55%' : '.25rem'
  const dayLabel = (p: Point) => (p.partial ? 'Today' : formatDay(p.day))
  const dayLabelLong = (p: Point) => (p.partial ? 'Today so far' : formatDayLong(p.day))
  const summary =
    `Daily active members, ${formatDay(data[0]?.day ?? '')} to ${formatDay(lastDone?.day ?? '')}. ` +
    `Peak ${formatCount(peak?.active ?? 0)} on ${formatDay(peak?.day ?? '')}; ` +
    `${formatCount(lastDone?.active ?? 0)} on the last full day` +
    (today ? `; ${formatCount(today.active)} today so far.` : '.')

  return (
    <div ref={wrapRef} className="analytics-chart">
      <div
        ref={plotRef}
        className="analytics-chart__plot"
        tabIndex={0}
        role="group"
        aria-label="Daily active members chart. Use the left and right arrow keys to read each day."
        onKeyDown={onKeyDown}
        onFocus={() => setSel((s) => (s && s.of === data ? s : { i: n - 1, of: data }))}
        onBlur={() => {
          held.current = null
          setActive(null)
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="analytics-chart__svg"
          role="img"
          aria-label={summary}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerLeave={onPointerLeave}
          onPointerCancel={onPointerCancel}
        >
          {/* Gridlines + y-axis ticks (hairline, recessive) */}
          {geo.ticks.map((v) => (
            <g key={v}>
              <line
                x1={M.left}
                x2={width - M.right}
                y1={geo.y(v)}
                y2={geo.y(v)}
                className={v === 0 ? 'analytics-chart__baseline' : 'analytics-chart__grid'}
              />
              <text x={M.left - 8} y={geo.y(v)} className="analytics-chart__ytick" dy="0.32em">
                {formatCount(v)}
              </text>
            </g>
          ))}

          {/* X-axis day labels */}
          {geo.xTicks.map((i, idx) => (
            <text
              key={i}
              x={geo.x(i)}
              y={HEIGHT - 8}
              className="analytics-chart__xtick"
              textAnchor={idx === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            >
              {dayLabel(points[i])}
            </text>
          ))}

          {/* The series: complete days solid; today dashed (in progress) */}
          <path d={geo.area} fill={SERIES} fillOpacity={0.1} />
          <path
            d={geo.line}
            fill="none"
            stroke={SERIES}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {geo.todaySeg && (
            <path
              d={geo.todaySeg}
              fill="none"
              stroke={SERIES}
              strokeWidth={2}
              strokeDasharray="3 4"
              strokeLinecap="round"
              opacity={0.75}
            />
          )}

          {/* Last complete day: marker + its value (the one direct label) */}
          {lastDone && (
            <>
              <circle
                cx={geo.x(complete - 1)}
                cy={geo.y(lastDone.active)}
                r={4}
                fill={SERIES}
                stroke="#fff"
                strokeWidth={2}
              />
              {active !== complete - 1 && (
                <text
                  x={geo.x(complete - 1) - (today ? 8 : 0)}
                  y={geo.y(lastDone.active) - 10}
                  className="analytics-chart__endlabel"
                  textAnchor="end"
                >
                  {formatCount(lastDone.active)}
                </text>
              )}
            </>
          )}

          {/* Today so far: hollow marker */}
          {today && (
            <circle
              cx={geo.x(n - 1)}
              cy={geo.y(today.active)}
              r={4}
              fill="#fff"
              stroke={SERIES}
              strokeWidth={2}
            />
          )}

          {/* Crosshair */}
          {point && active !== null && (
            <g pointerEvents="none">
              <line
                x1={pointX}
                x2={pointX}
                y1={M.top}
                y2={HEIGHT - M.bottom}
                className="analytics-chart__crosshair"
              />
              <circle
                cx={pointX}
                cy={pointY}
                r={4.5}
                fill={point.partial ? '#fff' : SERIES}
                stroke={point.partial ? SERIES : '#fff'}
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {point && (
          <div
            ref={tipRef}
            className="analytics-tip"
            style={{ top: tipTop }}
            aria-hidden="true"
          >
            <span className="analytics-tip__key" style={{ background: SERIES }} />
            <span className="analytics-tip__value">{formatCount(point.active)}</span>
            <span className="analytics-tip__label">
              active member{point.active === 1 ? '' : 's'}
            </span>
            <span className="analytics-tip__sub">{dayLabelLong(point)}</span>
          </div>
        )}
      </div>

      <p className="analytics-sr" aria-live="polite">
        {point ? `${dayLabelLong(point)}: ${formatCount(point.active)} active members` : ''}
      </p>

      <details className="analytics-tableview">
        <summary>View as table</summary>
        <div className="analytics-tableview__scroll">
          <table className="admin-table analytics-table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col" className="analytics-num">Active members</th>
              </tr>
            </thead>
            <tbody>
              {points.map((d) => (
                <tr key={d.day}>
                  <td>{d.partial ? `${formatDayLong(d.day)} (so far)` : formatDayLong(d.day)}</td>
                  <td className="analytics-num">{formatCount(d.active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
