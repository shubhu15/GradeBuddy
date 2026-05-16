import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'

// ===========================================================================
// Helpers
// ===========================================================================

// Minimal inline-markdown renderer: handles **bold** and `code` spans only.
// Returns an array of React nodes. No HTML allowed through.
function renderInline(text) {
  if (text == null) return null
  const str = String(text)
  const out = []
  const re = /(\*\*[^*]+?\*\*|`[^`]+?`)/g
  let last = 0
  let m
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) {
      out.push(<span key={out.length}>{str.slice(last, m.index)}</span>)
    }
    const tok = m[0]
    if (tok.startsWith('**')) {
      out.push(
        <strong key={out.length} className="font-semibold text-gray-900">
          {tok.slice(2, -2)}
        </strong>,
      )
    } else {
      out.push(
        <code
          key={out.length}
          className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12px] text-gray-800"
        >
          {tok.slice(1, -1)}
        </code>,
      )
    }
    last = m.index + tok.length
  }
  if (last < str.length) {
    out.push(<span key={out.length}>{str.slice(last)}</span>)
  }
  return out
}

function classNames(...xs) {
  return xs.filter(Boolean).join(' ')
}

function progressColor(pct) {
  if (pct >= 90) return 'bg-green-500'
  if (pct >= 70) return 'bg-amber-500'
  return 'bg-red-500'
}

// ===========================================================================
// Status badge
// ===========================================================================
function StatusBadge({ status, score }) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium'

  if (status === 'pending') {
    return (
      <span className={`${base} bg-gray-100 text-gray-600`}>
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Pending
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className={`${base} bg-amber-100 text-amber-800`}>
        <svg
          className="h-3 w-3 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-25"
          />
          <path
            d="M4 12a8 8 0 018-8"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-75"
          />
        </svg>
        Grading…
      </span>
    )
  }
  if (status === 'complete') {
    return (
      <span className={`${base} bg-green-100 text-green-800`}>
        <svg
          className="h-3 w-3"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
            clipRule="evenodd"
          />
        </svg>
        {score ? `Graded · ${score}` : 'Graded'}
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className={`${base} bg-red-100 text-red-700`}>
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Error
      </span>
    )
  }
  return null
}

// ===========================================================================
// Roster — add student form
// ===========================================================================
function AddStudentForm({ onSubmit, onCancel, submitting, error }) {
  const [studentId, setStudentId] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [mockVariant, setMockVariant] = useState('alice')

  const ready = studentId.trim() && repoUrl.trim() && !submitting

  function handle(e) {
    e.preventDefault()
    if (!ready) return
    onSubmit({
      student_id: studentId.trim(),
      repo_url: repoUrl.trim(),
      mock_variant: mockVariant,
    })
  }

  return (
    <form
      onSubmit={handle}
      className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3"
    >
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-2.5">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Student ID
          </label>
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="alice"
            className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wide text-gray-500">
            GitHub Repo URL
          </label>
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/alice/businesses"
            className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 font-mono text-xs shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Mock Variant
          </label>
          <select
            value={mockVariant}
            onChange={(e) => setMockVariant(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="alice">alice — perfect</option>
            <option value="bob">bob — status code bugs</option>
            <option value="charlie">charlie — 404 + pagination bugs</option>
          </select>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!ready}
          className={classNames(
            'rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
            ready ? 'bg-indigo-600 hover:bg-indigo-700' : 'cursor-not-allowed bg-indigo-300',
          )}
        >
          {submitting ? 'Adding…' : 'Add Student'}
        </button>
      </div>
    </form>
  )
}

// ===========================================================================
// Roster — student row
// ===========================================================================
function StudentRow({ student, selected, onSelect, onGrade }) {
  const score =
    student.status === 'complete' && student.scorecard
      ? `${student.scorecard.total_awarded}/${student.scorecard.total_possible}`
      : null

  const clickable = student.status === 'complete'

  return (
    <li
      onClick={() => clickable && onSelect(student.student_id)}
      className={classNames(
        'relative rounded-md border bg-white p-3 transition-all',
        selected
          ? 'border-indigo-300 bg-indigo-50 shadow-sm'
          : 'border-gray-200 hover:border-gray-300',
        clickable && 'cursor-pointer hover:shadow-sm',
      )}
    >
      {selected && (
        <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-indigo-500" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {student.student_id}
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-gray-500">
            {student.repo_url}
          </p>
          <div className="mt-2">
            <StatusBadge status={student.status} score={score} />
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-2">
          {student.status === 'pending' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onGrade(student.student_id)
              }}
              className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Grade →
            </button>
          )}
          {student.status === 'complete' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSelect(student.student_id)
              }}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              View
            </button>
          )}
          {student.status === 'error' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onGrade(student.student_id)
              }}
              className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

// ===========================================================================
// Scorecard — feedback card
// ===========================================================================
function FeedbackCard({ label, body, iconPath }) {
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-purple-600 shadow-sm">
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={iconPath}
            />
          </svg>
        </div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-purple-900">
          {label}
        </h4>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-gray-800">
        {body || <span className="italic text-gray-400">No feedback.</span>}
      </p>
    </div>
  )
}

// ===========================================================================
// Scorecard — rubric table row
// ===========================================================================
function RubricRow({ idx, item, override, onOverrideChange }) {
  const awarded = override != null ? override : item.points_awarded ?? 0
  const max = item.points_possible ?? 0
  const partial = awarded < max
  return (
    <tr
      className={classNames(
        'border-b border-gray-100 align-top last:border-b-0',
        partial ? 'bg-red-50/60' : 'bg-white',
      )}
    >
      <td className="w-8 px-3 py-3 text-xs text-gray-400">{idx + 1}</td>
      <td className="px-3 py-3">
        <p className="text-sm font-medium leading-snug text-gray-900">
          {renderInline(item.name)}
        </p>
        {item.deduction_reason && (
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            {renderInline(item.deduction_reason)}
          </p>
        )}
      </td>
      <td className="w-20 px-3 py-3">
        <input
          type="number"
          min={0}
          max={max}
          value={awarded}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') {
              onOverrideChange(0)
              return
            }
            const n = Math.max(0, Math.min(max, Number(raw)))
            if (!Number.isNaN(n)) onOverrideChange(n)
          }}
          className={classNames(
            'block w-16 rounded-md border px-2 py-1 text-center text-sm font-semibold shadow-sm focus:outline-none focus:ring-1',
            partial
              ? 'border-red-300 bg-white text-red-700 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 bg-white text-gray-900 focus:border-indigo-500 focus:ring-indigo-500',
          )}
        />
      </td>
      <td className="w-12 px-3 py-3 text-center text-sm font-medium text-gray-500">
        {max}
      </td>
    </tr>
  )
}

// ===========================================================================
// Scorecard panel
// ===========================================================================
function ScorecardPanel({
  student,
  overrides,
  onOverrideChange,
  onPublish,
  onRegrade,
}) {
  // ---- empty state ----
  if (!student) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5h6a2 2 0 012 2v12a2 2 0 01-2 2H9a2 2 0 01-2-2V7a2 2 0 012-2z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5a2 2 0 012-2h2a2 2 0 012 2v1H9V5z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 12h4M10 16h4"
            />
          </svg>
        </div>
        <p className="mt-4 text-sm font-medium text-gray-700">
          Select a student to view their scorecard
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Add students on the left and run grading to see results here.
        </p>
      </div>
    )
  }

  // ---- running state ----
  if (student.status === 'running' || student.status === 'pending') {
    const isPending = student.status === 'pending'
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-12 w-12 items-center justify-center">
          <svg
            className="h-10 w-10 animate-spin text-indigo-500"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              className="opacity-20"
            />
            <path
              d="M4 12a8 8 0 018-8"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="opacity-90"
            />
          </svg>
        </div>
        <p className="mt-4 text-sm font-medium text-gray-800">
          {isPending
            ? `Queued: ${student.student_id}`
            : `Running tests for ${student.student_id}…`}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Cloning repo → Docker spin-up → Newman tests → Claude grading
        </p>
      </div>
    )
  }

  // ---- error state ----
  if (student.status === 'error') {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3m0 4h.01M10.29 3.86l-7.4 12.79A1 1 0 003.76 18h16.48a1 1 0 00.87-1.35l-7.4-12.79a1 1 0 00-1.73 0z"
            />
          </svg>
        </div>
        <p className="mt-4 text-sm font-semibold text-gray-900">
          Grading failed for {student.student_id}
        </p>
        {student.error && (
          <pre className="mt-3 max-w-md overflow-x-auto rounded-md bg-gray-100 px-3 py-2 text-left text-[11px] text-gray-700">
            {student.error}
          </pre>
        )}
        <button
          type="button"
          onClick={() => onRegrade(student.student_id)}
          className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Retry grading
        </button>
      </div>
    )
  }

  // ---- complete state — render scorecard ----
  const sc = student.scorecard
  if (!sc || !Array.isArray(sc.rubric_items)) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="text-sm font-medium text-gray-800">
          Scorecard parse error
        </p>
        <p className="mt-1 text-xs text-gray-500">
          The grader returned an unexpected payload.
        </p>
        <button
          type="button"
          onClick={() => onRegrade(student.student_id)}
          className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Retry grading
        </button>
      </div>
    )
  }

  const items = sc.rubric_items
  const maxTotal = Number(sc.total_possible) || items.reduce(
    (a, it) => a + (Number(it.points_possible) || 0),
    0,
  )
  const liveTotal = items.reduce((acc, it, idx) => {
    const override = overrides[idx]
    const v = override != null ? override : Number(it.points_awarded) || 0
    return acc + v
  }, 0)
  const pct = maxTotal > 0 ? Math.round((liveTotal / maxTotal) * 100) : 0
  const cq = sc.code_quality_feedback || {}

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 pb-28">
        {/* Big score */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Total Score
              </p>
              <p className="mt-1 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                {liveTotal}
                <span className="ml-1 text-2xl font-medium text-gray-400">
                  / {maxTotal}
                </span>
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {student.student_id} · graded by Claude
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-gray-900 sm:text-5xl">
                {pct}
                <span className="text-2xl text-gray-400">%</span>
              </p>
            </div>
          </div>
          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={classNames(
                'h-full rounded-full transition-all duration-500',
                progressColor(pct),
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </section>

        {/* Summary */}
        {sc.summary && (
          <section>
            <h3 className="text-sm font-semibold text-gray-900">Summary</h3>
            <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-sm leading-relaxed text-gray-800">
                {renderInline(sc.summary)}
              </p>
            </div>
          </section>
        )}

        {/* Rubric */}
        <section>
          <h3 className="text-sm font-semibold text-gray-900">
            Rubric Breakdown
          </h3>
          <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="w-8 px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Criterion</th>
                  <th className="w-20 px-3 py-2 text-center font-medium">
                    Awarded
                  </th>
                  <th className="w-12 px-3 py-2 text-center font-medium">
                    Max
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <RubricRow
                    key={idx}
                    idx={idx}
                    item={it}
                    override={overrides[idx]}
                    onOverrideChange={(v) => onOverrideChange(idx, v)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Code quality feedback */}
        <section>
          <h3 className="text-sm font-semibold text-gray-900">
            Code Quality Feedback{' '}
            <span className="font-normal text-gray-500">(from Claude)</span>
          </h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <FeedbackCard
              label="Error Handling"
              body={cq.error_handling}
              iconPath="M12 9v3m0 4h.01M10.29 3.86l-7.4 12.79A1 1 0 003.76 18h16.48a1 1 0 00.87-1.35l-7.4-12.79a1 1 0 00-1.73 0z"
            />
            <FeedbackCard
              label="REST Conventions"
              body={cq.rest_conventions}
              iconPath="M4 7h16M4 12h16M4 17h10"
            />
            <FeedbackCard
              label="Code Structure"
              body={cq.code_structure}
              iconPath="M4 6h6v6H4zM14 6h6v6h-6zM4 16h6v4H4zM14 16h6v4h-6z"
            />
            <FeedbackCard
              label="Naming"
              body={cq.naming}
              iconPath="M5 4h14M5 12h14M5 20h14"
            />
          </div>
        </section>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-gray-200 bg-white/90 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
              Final Total
            </p>
            <p className="text-lg font-bold text-gray-900">
              {liveTotal}
              <span className="ml-1 text-sm font-medium text-gray-400">
                / {maxTotal}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onRegrade(student.student_id)}
              className="text-xs font-medium text-gray-500 underline-offset-2 transition-colors hover:text-indigo-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Re-grade
            </button>
            <button
              type="button"
              onClick={() => onPublish(student.student_id)}
              className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Publish Grade
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// Header
// ===========================================================================
function Header({ course, name }) {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <Link to="/" className="flex flex-none items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white font-bold">
            G
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">
            GradeBuddy
          </span>
        </Link>
        <div className="hidden min-w-0 flex-1 text-center sm:block">
          {course && (
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-gray-500">
              {course}
            </p>
          )}
          {name && (
            <p className="truncate text-sm font-semibold text-gray-900">
              {name}
            </p>
          )}
        </div>
        <Link
          to="/"
          className="flex-none text-sm font-medium text-gray-600 transition-colors hover:text-indigo-600"
        >
          ← Back to setup
        </Link>
      </div>
    </header>
  )
}

// ===========================================================================
// Toast
// ===========================================================================
function Toast({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-green-200 bg-white px-4 py-2.5 shadow-lg">
        <svg
          className="h-5 w-5 flex-none text-green-600"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-sm font-medium text-gray-900">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-1 text-gray-400 transition-colors hover:text-gray-600"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ===========================================================================
// Main page
// ===========================================================================
export default function DashboardPage() {
  const { assignment_id } = useParams()

  const [assignment, setAssignment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState(null)

  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  // Per-student per-rubric-index overrides:
  //   overrides[student_id] = { [idx]: number }
  const [overrides, setOverrides] = useState({})

  // ---- initial load ----------------------------------------------------
  async function loadAssignment({ silent = false } = {}) {
    if (!silent) setLoading(true)
    try {
      const data = await api.get(`/assignments/${assignment_id}`)
      setAssignment(data)
      setLoadError(null)
    } catch (e) {
      setLoadError(e.message || 'Failed to load assignment')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadAssignment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment_id])

  // ---- background polling while anyone is running ---------------------
  const anyRunning = useMemo(() => {
    const ss = assignment?.students || []
    return ss.some((s) => s.status === 'running' || s.status === 'pending')
  }, [assignment])

  useEffect(() => {
    if (!anyRunning) return undefined
    const id = setInterval(() => {
      loadAssignment({ silent: true })
    }, 2500)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyRunning, assignment_id])

  // ---- toast helper ---------------------------------------------------
  function showToast(msg) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), [])

  // ---- actions --------------------------------------------------------
  async function handleAddStudent(payload) {
    setAddSubmitting(true)
    setAddError(null)
    // Optimistic: tack onto the in-memory list immediately.
    setAssignment((prev) => {
      if (!prev) return prev
      const existing = (prev.students || []).find(
        (s) => s.student_id === payload.student_id,
      )
      const optimistic = {
        student_id: payload.student_id,
        repo_url: payload.repo_url,
        mock_variant: payload.mock_variant,
        status: 'pending',
        scorecard: null,
      }
      const students = existing
        ? prev.students.map((s) =>
            s.student_id === payload.student_id ? optimistic : s,
          )
        : [...(prev.students || []), optimistic]
      return { ...prev, students }
    })
    try {
      await api.post(`/assignments/${assignment_id}/students`, payload)
      setShowAdd(false)
      // Reconcile from source of truth.
      loadAssignment({ silent: true })
    } catch (e) {
      setAddError(e.message || 'Failed to add student')
      // Roll back to server state.
      loadAssignment({ silent: true })
    } finally {
      setAddSubmitting(false)
    }
  }

  async function handleGrade(studentId) {
    // Optimistic: flip to running immediately.
    setAssignment((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        students: (prev.students || []).map((s) =>
          s.student_id === studentId
            ? { ...s, status: 'running', scorecard: null, error: null }
            : s,
        ),
      }
    })
    // Drop any prior overrides for this student so the new scorecard is clean.
    setOverrides((prev) => ({ ...prev, [studentId]: {} }))
    try {
      await api.post(
        `/assignments/${assignment_id}/students/${studentId}/grade`,
        {},
      )
      loadAssignment({ silent: true })
    } catch (e) {
      setAssignment((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          students: (prev.students || []).map((s) =>
            s.student_id === studentId
              ? { ...s, status: 'error', error: e.message || 'Grade failed' }
              : s,
          ),
        }
      })
    }
  }

  async function handleRunAllPending() {
    const pending = (assignment?.students || []).filter(
      (s) => s.status === 'pending' || s.status === 'error',
    )
    for (const s of pending) {
      await handleGrade(s.student_id)
    }
  }

  function handleOverrideChange(studentId, idx, value) {
    setOverrides((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [idx]: value },
    }))
  }

  function handlePublish(studentId) {
    showToast(`Grade published for ${studentId}`)
  }

  // ---- derived --------------------------------------------------------
  const students = useMemo(
    () => assignment?.students || [],
    [assignment],
  )
  const selected = students.find((s) => s.student_id === selectedStudentId) || null
  const selectedOverrides =
    (selectedStudentId && overrides[selectedStudentId]) || {}

  // Auto-select the most recently completed student if none is selected.
  useEffect(() => {
    if (selectedStudentId) return
    const firstComplete = students.find((s) => s.status === 'complete')
    if (firstComplete) setSelectedStudentId(firstComplete.student_id)
  }, [students, selectedStudentId])

  // ---- render ---------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-7xl px-6 py-10">
          <div className="grid gap-6 lg:grid-cols-10">
            <div className="space-y-3 lg:col-span-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-lg border border-gray-100 bg-white"
                />
              ))}
            </div>
            <div className="lg:col-span-6">
              <div className="h-96 animate-pulse rounded-lg border border-gray-100 bg-white" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-semibold text-red-700">
              Couldn&rsquo;t load assignment
            </p>
            <p className="mt-2 text-xs text-red-600">{loadError}</p>
            <button
              type="button"
              onClick={() => loadAssignment()}
              className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header course={assignment?.course} name={assignment?.name} />

      {/* Assignment summary strip */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
          {assignment?.course && (
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
              {assignment.course}
            </span>
          )}
          {assignment?.name && (
            <span className="text-sm font-semibold text-gray-900">
              {assignment.name}
            </span>
          )}
          {assignment?.description && (
            <span className="min-w-0 flex-1 truncate text-xs text-gray-500">
              {assignment.description}
            </span>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-10">
          {/* ----- Roster (35% ≈ 4/10 cols) ------------------------- */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-20">
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                    Students
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      {students.length}
                    </span>
                  </h2>
                  {!showAdd && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddError(null)
                        setShowAdd(true)
                      }}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      + Add Student
                    </button>
                  )}
                </div>

                {showAdd && (
                  <AddStudentForm
                    onSubmit={handleAddStudent}
                    onCancel={() => {
                      setShowAdd(false)
                      setAddError(null)
                    }}
                    submitting={addSubmitting}
                    error={addError}
                  />
                )}

                <div className="mt-4">
                  {students.length === 0 ? (
                    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
                      <p className="text-sm font-medium text-gray-700">
                        No students yet
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Add a student to start grading.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {students.map((s) => (
                        <StudentRow
                          key={s.student_id}
                          student={s}
                          selected={selectedStudentId === s.student_id}
                          onSelect={setSelectedStudentId}
                          onGrade={handleGrade}
                        />
                      ))}
                    </ul>
                  )}
                </div>

                {students.some(
                  (s) => s.status === 'pending' || s.status === 'error',
                ) && (
                  <button
                    type="button"
                    onClick={handleRunAllPending}
                    className="mt-4 w-full rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    ▶ Run All Pending
                  </button>
                )}
              </div>
            </div>
          </aside>

          {/* ----- Scorecard (65% ≈ 6/10 cols) ---------------------- */}
          <section className="lg:col-span-6">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <ScorecardPanel
                student={selected}
                overrides={selectedOverrides}
                onOverrideChange={(idx, v) =>
                  handleOverrideChange(selectedStudentId, idx, v)
                }
                onPublish={handlePublish}
                onRegrade={handleGrade}
              />
            </div>
          </section>
        </div>
      </main>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
