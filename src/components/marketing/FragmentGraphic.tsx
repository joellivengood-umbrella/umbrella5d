/**
 * Decorative hero graphic for the 5D Machine page: a scatter of nodes
 * on the left, loosely connected, that funnel through the middle and
 * converge into one bright focal node on the right. A visual for the
 * move from fragmentation to a single profit focus.
 *
 * Pure SVG + CSS animation, no dependencies. Decorative, so it is
 * aria-hidden; motion is suppressed under prefers-reduced-motion.
 */

const NODES = [
  { x: 44, y: 64, r: 5 },    // 0
  { x: 96, y: 132, r: 6 },   // 1
  { x: 58, y: 214, r: 5 },   // 2
  { x: 128, y: 292, r: 4 },  // 3
  { x: 162, y: 74, r: 5 },   // 4
  { x: 188, y: 188, r: 6 },  // 5
  { x: 250, y: 120, r: 6 },  // 6
  { x: 256, y: 256, r: 5 },  // 7
  { x: 312, y: 190, r: 7 },  // 8
  { x: 110, y: 200, r: 5 },  // 9
  { x: 205, y: 104, r: 4 },  // 10
  { x: 210, y: 300, r: 4 },  // 11
  { x: 305, y: 92, r: 5 },   // 12
  { x: 322, y: 286, r: 5 },  // 13
]

// Edges between scattered nodes (index pairs).
const EDGES: ReadonlyArray<[number, number]> = [
  [0, 1], [0, 4], [1, 2], [1, 5], [2, 3], [4, 6], [5, 6], [5, 7], [3, 7], [6, 8], [7, 8],
  [1, 9], [2, 9], [5, 9], [4, 10], [6, 10], [5, 11], [7, 11], [6, 12], [8, 12], [7, 13], [8, 13], [10, 12],
]

// Nodes that funnel into the focal point.
const FOCAL = { x: 372, y: 190 }
const FOCAL_EDGES = [6, 7, 8, 12, 13]

export function FragmentGraphic() {
  return (
    <svg
      className="frag"
      viewBox="0 0 420 360"
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fragGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fc6ff" />
          <stop offset="1" stopColor="#b56bff" />
        </linearGradient>
        <radialGradient id="fragGlow">
          <stop offset="0" stopColor="#8a7bff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#8a7bff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* loose connections */}
      {EDGES.map(([a, b], i) => (
        <line
          key={`e${i}`}
          className="frag-line"
          x1={NODES[a].x}
          y1={NODES[a].y}
          x2={NODES[b].x}
          y2={NODES[b].y}
          stroke="url(#fragGrad)"
          strokeWidth="1.2"
        />
      ))}

      {/* funnel lines into the focal node */}
      {FOCAL_EDGES.map((a, i) => (
        <line
          key={`f${i}`}
          className="frag-line frag-line--main"
          x1={NODES[a].x}
          y1={NODES[a].y}
          x2={FOCAL.x}
          y2={FOCAL.y}
          stroke="url(#fragGrad)"
          strokeWidth="1.6"
        />
      ))}

      {/* scattered nodes */}
      {NODES.map((n, i) => (
        <circle
          key={`n${i}`}
          className="frag-node"
          cx={n.x}
          cy={n.y}
          r={n.r}
          fill="url(#fragGrad)"
          style={{ animationDelay: `${(i % 5) * 0.45}s` }}
        />
      ))}

      {/* focal point */}
      <circle className="frag-focalglow" cx={FOCAL.x} cy={FOCAL.y} r="26" fill="url(#fragGlow)" />
      <circle cx={FOCAL.x} cy={FOCAL.y} r="11" fill="url(#fragGrad)" />
      <circle cx={FOCAL.x} cy={FOCAL.y} r="4.5" fill="#ffffff" />
    </svg>
  )
}
