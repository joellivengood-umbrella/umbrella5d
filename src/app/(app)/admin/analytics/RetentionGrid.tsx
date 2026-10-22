'use client'

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { RetentionCohort } from '@/lib/admin-analytics'
import { addDays, formatCount, formatDay } from './format'

const WEEKS = 8

/**
 * Retention as a share of each cohort, binned into five ordered classes on
 * a one-hue violet ramp (validated with the dataviz ordinal checks: monotone
 * lightness, >=0.06 steps, light end >=2:1 on white; cell text meets 4.5:1).
 * 0% gets a neutral gray so "nobody came back" never reads as a light violet.
 */
const LEGEND = [
  { cls: 'analytics-heat--0', label: '0%' },
  { cls: 'analytics-heat--1', label: 'Under 20%' },
  { cls: 'analytics-heat--2', label: '20–39%' },
  { cls: 'analytics-heat--3', label: '40–59%' },
  { cls: 'analytics-heat--4', label: '60–79%' },
  { cls: 'analytics-heat--5', label: '80–100%' },
]

/**
 * A cell's percentage, rounded once so its color and its printed number
 * always agree with the legend (19.6% prints "20%" and is colored 20–39%).
 * Anyone at all reads at least "<1%", never a gray-looking "0%".
 */
function retentionPct(active: number, size: number): { pct: number; text: string; any: boolean } {
  const ratio = size > 0 ? active / size : 0
  const pct = Math.round(ratio * 100)
  const any = ratio > 0
  return { pct, any, text: any && pct === 0 ? '<1%' : `${pct}%` }
}

function heatClass({ pct, any }: { pct: number; any: boolean }): string {
  if (!any) return 'analytics-heat--0'
  if (pct < 20) return 'analytics-heat--1'
  if (pct < 40) return 'analytics-heat--2'
  if (pct < 60) return 'analytics-heat--3'
  if (pct < 80) return 'analytics-heat--4'
  return 'analytics-heat--5'
}

type Tip = { r: number; k: number }

/**
 * Weekly cohort retention: one row per first-active week (oldest first),
 * one column per week since. Each cell shows its percentage; hover or focus
 * adds the underlying counts. One Tab stop — arrow keys move cell to cell.
 */
export function RetentionGrid({ cohorts }: { cohorts: RetentionCohort[] }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [focusCell, setFocusCell] = useState({ r: 0, k: 0 })
  const [tip, setTip] = useState<Tip | null>(null)

  // Place the tooltip just above its cell, centered and clamped inside the
  // frame (the card clips anything that spills out) — measured before paint
  // and again whenever the grid scrolls sideways or the frame resizes, so it
  // never labels the wrong column. Hidden while most of its cell is
  // scrolled out of view (a clamped tip would sit over another column).
  useLayoutEffect(() => {
    const frame = frameRef.current
    const scroller = scrollRef.current
    const el = tipRef.current
    if (!tip || !frame || !scroller || !el) return
    const place = () => {
      const cell = tableRef.current?.querySelector<HTMLElement>(
        `[data-r="${tip.r}"][data-k="${tip.k}"]`
      )
      if (!cell) return
      const fr = frame.getBoundingClientRect()
      const cr = cell.getBoundingClientRect()
      const w = el.offsetWidth
      const cx = cr.left - fr.left + cr.width / 2
      el.style.top = `${cr.top - fr.top}px`
      el.style.left = `${Math.min(Math.max(0, frame.clientWidth - w), Math.max(0, cx - w / 2))}px`
      const inView = Math.min(cr.right, fr.right) - Math.max(cr.left, fr.left)
      el.style.visibility = inView < cr.width / 2 ? 'hidden' : ''
    }
    place()
    scroller.addEventListener('scroll', place, { passive: true })
    const ro = new ResizeObserver(place)
    ro.observe(frame)
    return () => {
      scroller.removeEventListener('scroll', place)
      ro.disconnect()
    }
  }, [tip])

  // Touch has no hover to leave: a press outside the grid puts a tapped
  // cell's tooltip away even when the tap didn't focus the cell.
  useEffect(() => {
    const onDown = (e: globalThis.PointerEvent) => {
      if (!tableRef.current?.contains(e.target as Node)) setTip(null)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [])

  // Oldest cohort first, so the grid reads as the familiar triangle.
  const rows = [...cohorts].sort((a, b) => (a.start < b.start ? -1 : 1))

  if (rows.length === 0) {
    return (
      <div className="analytics-empty">
        No cohorts yet — a member joins a cohort the first week they&apos;re
        active.
      </div>
    )
  }

  const available = (r: number) => Math.min(WEEKS, rows[r]?.weeks.length ?? 0)

  // The roving Tab stop, clamped in case a filter change shrank the grid.
  const tabR = Math.min(focusCell.r, rows.length - 1)
  const tabK = Math.min(focusCell.k, Math.max(0, available(tabR) - 1))

  function showTip(r: number, k: number) {
    setTip({ r, k })
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableElement>) {
    const el = e.target as HTMLElement
    const r = Number(el.dataset.r)
    const k = Number(el.dataset.k)
    if (Number.isNaN(r) || Number.isNaN(k)) return
    let nr = r
    let nk = k
    if (e.key === 'ArrowRight') nk = k + 1
    else if (e.key === 'ArrowLeft') nk = k - 1
    else if (e.key === 'ArrowDown') nr = r + 1
    else if (e.key === 'ArrowUp') nr = r - 1
    else if (e.key === 'Home') nk = 0
    else if (e.key === 'End') nk = available(r) - 1
    else return
    e.preventDefault()
    nr = Math.min(rows.length - 1, Math.max(0, nr))
    nk = Math.min(available(nr) - 1, Math.max(0, nk))
    setFocusCell({ r: nr, k: nk })
    tableRef.current
      ?.querySelector<HTMLElement>(`[data-r="${nr}"][data-k="${nk}"]`)
      ?.focus()
  }

  // A focused cell (by Tab, tap or arrow) is brought fully into the grid's
  // own sideways scroll, so its tooltip shows. focus() alone leaves a
  // barely-visible cell where it is; the page's vertical scroll is left to
  // focus() (scrollIntoView would fight it and the fixed header).
  function reveal(cell: HTMLElement) {
    const sc = scrollRef.current
    if (!sc) return
    const fr = sc.getBoundingClientRect()
    const cr = cell.getBoundingClientRect()
    if (cr.left < fr.left) sc.scrollLeft -= fr.left - cr.left
    else if (cr.right > fr.right) sc.scrollLeft += cr.right - fr.right
  }

  const tipRow = tip ? rows[tip.r] : null
  const tipWeek = tipRow && tip ? tipRow.weeks[tip.k] : null

  return (
    <div className="analytics-retention">
      <div ref={frameRef} className="analytics-retention__frame">
        <div ref={scrollRef} className="analytics-scroll">
          <table ref={tableRef} className="analytics-cohort" onKeyDown={onKeyDown}>
            <thead>
              <tr>
                <th scope="col" className="analytics-cohort__corner">First active week</th>
                <th scope="col" className="analytics-num">Members</th>
                {Array.from({ length: WEEKS }, (_, k) => (
                  <th key={k} scope="col" className="analytics-cohort__wk">
                    Week {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c, r) => (
                <tr key={c.start}>
                  <th scope="row" className="analytics-cohort__label">
                    {formatDay(c.start)}
                  </th>
                  <td className="analytics-num">{formatCount(c.size)}</td>
                  {Array.from({ length: WEEKS }, (_, k) => {
                    const w = c.weeks[k]
                    if (!w || k >= available(r)) {
                      return <td key={k} className="analytics-heat analytics-heat--future" />
                    }
                    const share = retentionPct(w.active, c.size)
                    const partial = k === c.weeks.length - 1
                    const label =
                      `Week ${k} for the ${formatDay(c.start)} cohort: ` +
                      `${formatCount(w.active)} of ${formatCount(c.size)} members active ` +
                      `(${share.text})${partial ? ', week still in progress' : ''}`
                    return (
                      <td
                        key={k}
                        data-r={r}
                        data-k={k}
                        tabIndex={tabR === r && tabK === k ? 0 : -1}
                        aria-label={label}
                        className={`analytics-heat ${heatClass(share)}${partial ? ' is-partial' : ''}${
                          tip && tip.r === r && tip.k === k ? ' is-hot' : ''
                        }`}
                        onPointerEnter={() => showTip(r, k)}
                        // A lifted finger also "leaves": a touch keeps its tip
                        // (until a tap elsewhere or a blur); a mouse or a
                        // hovering pen moving off hides it.
                        onPointerLeave={(e) => {
                          if (e.pointerType !== 'touch') setTip(null)
                        }}
                        onPointerCancel={() => setTip(null)}
                        onFocus={(e) => {
                          setFocusCell({ r, k })
                          reveal(e.currentTarget)
                          showTip(r, k)
                        }}
                        onBlur={() => setTip(null)}
                      >
                        {share.text}
                        {partial && <span aria-hidden="true">*</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tip && tipRow && tipWeek && (
          <div
            ref={tipRef}
            className="analytics-tip analytics-tip--cell"
            aria-hidden="true"
          >
            <span className="analytics-tip__value">
              {retentionPct(tipWeek.active, tipRow.size).text}
            </span>
            <span className="analytics-tip__label">
              {formatCount(tipWeek.active)} of {formatCount(tipRow.size)} active
            </span>
            <span className="analytics-tip__sub">
              Week {tip.k} · week of {formatDay(addDays(tipRow.start, tip.k * 7))}
              {tip.k === tipRow.weeks.length - 1 ? ' · in progress' : ''}
            </span>
          </div>
        )}
      </div>

      <div className="analytics-legend" aria-label="Retention scale">
        {LEGEND.map((l) => (
          <span key={l.cls} className="analytics-legend__item">
            <span className={`analytics-legend__swatch ${l.cls}`} aria-hidden="true" />
            {l.label}
          </span>
        ))}
        <span className="analytics-legend__item analytics-legend__note">
          * this week, still in progress
        </span>
      </div>
    </div>
  )
}
