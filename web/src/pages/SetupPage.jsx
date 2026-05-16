import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white font-bold">
            G
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">
            GradeBuddy
          </span>
        </div>
        <p className="hidden text-sm text-gray-500 sm:block">
          AI grading co-pilot for code assignments
        </p>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// File upload card
// ---------------------------------------------------------------------------
function FileUploadCard({ title, accept, hint, file, onChange, id }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) onChange(dropped)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={[
        'group cursor-pointer rounded-lg border border-dashed bg-white p-5 transition-colors',
        dragOver
          ? 'border-indigo-500 bg-indigo-50'
          : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">{hint}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onChange(f)
        }}
      />

      {file && (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-xs">
          <svg
            className="h-4 w-4 flex-none text-green-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="truncate font-medium text-green-700">
            {file.name}
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recent assignments sidebar
// ---------------------------------------------------------------------------
function RecentAssignments() {
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    api
      .get('/assignments')
      .then((list) => alive && setAssignments(list || []))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          Recent Assignments
        </h2>
      </div>
      <p className="mb-5 text-sm text-gray-500">
        Jump back into any course you&rsquo;ve already set up.
      </p>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Couldn&rsquo;t load assignments: {error}
        </div>
      )}

      {!error && assignments === null && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-md border border-gray-100 bg-gray-50"
            />
          ))}
        </div>
      )}

      {!error && Array.isArray(assignments) && assignments.length === 0 && (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-gray-700">
            No assignments yet.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Create one to get started.
          </p>
        </div>
      )}

      {!error && Array.isArray(assignments) && assignments.length > 0 && (
        <ul className="space-y-2">
          {assignments.map((a) => (
            <li key={a.assignment_id}>
              <button
                type="button"
                onClick={() => navigate(`/grade/${a.assignment_id}`)}
                className="group flex w-full items-start justify-between rounded-md border border-gray-200 bg-white p-3 text-left transition-shadow hover:border-indigo-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {a.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {a.course}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                      {a.student_count}{' '}
                      {a.student_count === 1 ? 'student' : 'students'}
                    </span>
                  </div>
                </div>
                <span className="ml-3 flex-none translate-x-0 self-center text-xs font-medium text-gray-400 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-indigo-600">
                  Open →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SetupPage
// ---------------------------------------------------------------------------
export default function SetupPage() {
  const navigate = useNavigate()

  const [course, setCourse] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mdFile, setMdFile] = useState(null)
  const [jsonFile, setJsonFile] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const ready =
    course.trim().length > 0 &&
    name.trim().length > 0 &&
    mdFile !== null &&
    jsonFile !== null &&
    !submitting

  async function handleSubmit(e) {
    e.preventDefault()
    if (!ready) return
    setError(null)
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('course', course.trim())
      fd.append('name', name.trim())
      fd.append('description', description.trim())
      fd.append('assignment_md', mdFile)
      fd.append('collection_json', jsonFile)
      const res = await api.postForm('/assignments', fd)
      if (!res?.assignment_id) {
        throw new Error('Server returned no assignment_id')
      }
      navigate(`/grade/${res.assignment_id}`)
    } catch (err) {
      setError(err.message || 'Failed to create assignment')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-6 lg:grid-cols-5">
          {/* LEFT: Setup form (60% on lg+) */}
          <section className="lg:col-span-3">
            <form
              onSubmit={handleSubmit}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <h1 className="text-xl font-semibold text-gray-900">
                Course &amp; Assignment Setup
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Define an assignment once. Reuse for all students.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  <span className="font-semibold">Error:</span> {error}
                </div>
              )}

              <div className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="course"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Course name
                  </label>
                  <input
                    id="course"
                    type="text"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="CS 493 — Cloud Application Development"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Assignment name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Assignment 3 — Businesses REST API"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of what students are building..."
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <p className="block text-sm font-medium text-gray-700">
                    Source files
                  </p>
                  <div className="mt-2 grid gap-4 sm:grid-cols-2">
                    <FileUploadCard
                      id="assignment-md"
                      title="Assignment & Rubric (.md)"
                      accept=".md,.markdown"
                      file={mdFile}
                      onChange={setMdFile}
                      hint="Markdown file with problem description and a ## Rubric section with point values"
                    />
                    <FileUploadCard
                      id="collection-json"
                      title="Postman Collection (.json)"
                      accept=".json,application/json"
                      file={jsonFile}
                      onChange={setJsonFile}
                      hint="Postman v2.1 collection with pm.test assertions and {{base_url}} variable"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-end gap-3 border-t border-gray-100 pt-6">
                <button
                  type="submit"
                  disabled={!ready}
                  className={[
                    'inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
                    ready
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'cursor-not-allowed bg-indigo-300',
                  ].join(' ')}
                >
                  {submitting && (
                    <svg
                      className="h-4 w-4 animate-spin text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                  )}
                  <span>
                    {submitting ? 'Creating…' : 'Create Assignment →'}
                  </span>
                </button>
              </div>
            </form>
          </section>

          {/* RIGHT: Recent assignments (40% on lg+) */}
          <aside className="lg:col-span-2">
            <RecentAssignments />
          </aside>
        </div>
      </main>
    </div>
  )
}
