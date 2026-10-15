'use client'
import { useState, useEffect, useRef } from 'react'

type Entry = {
  id: string
  title: string
  content: string
  category: string | null
  folder: string | null
  source: string | null
  created_at: string
}

type Folder = {
  id: string
  name: string
  category: string
}

type View = 'root' | 'category' | 'folder' | 'add' | 'pdf' | 'new-category'

const CATEGORY_ICONS: Record<string, string> = {
  'HR': '👥',
  'Økonomi': '💰',
  'Drift': '⚙️',
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'HR':      { bg: '#EEF2FF', border: '#C7D2FE', text: '#4338CA' },
  'Økonomi': { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' },
  'Drift':   { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },
}

function catColor(name: string) {
  return CATEGORY_COLORS[name] ?? { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' }
}

const FIXED_CATEGORIES = ['HR', 'Økonomi', 'Drift']

export default function AdminPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('root')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', content: '', category: '', folder: '' })
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [addingFolder, setAddingFolder] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfMeta, setPdfMeta] = useState({ category: '', folder: '' })
  const [pdfUploading, setPdfUploading] = useState(false)
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null)
  const [deleteFolderName, setDeleteFolderName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [entriesRes, foldersRes] = await Promise.all([
      fetch('/api/knowledge'),
      fetch('/api/knowledge/folders'),
    ])
    const entriesData = await entriesRes.json()
    const foldersData = await foldersRes.json()
    setEntries(entriesData.entries ?? [])
    setFolders(foldersData.folders ?? [])
    setLoading(false)
  }

  function showFeedback(type: 'ok' | 'err', msg: string) {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 3000)
  }

  async function saveEntry() {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    const res = await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, folder: form.folder || null }),
    })
    if (res.ok) {
      showFeedback('ok', 'Lagt til!')
      const cat = form.category
      const fol = form.folder
      setForm({ title: '', content: '', category: '', folder: '' })
      await fetchAll()
      if (fol) { setActiveCategory(cat); setActiveFolder(fol); setView('folder') }
      else if (cat) { setActiveCategory(cat); setView('category') }
      else setView('root')
    } else {
      showFeedback('err', 'Noe gikk galt.')
    }
    setSaving(false)
  }

  async function uploadPdf() {
    if (!pdfFile) return
    setPdfUploading(true)
    const fd = new FormData()
    fd.append('file', pdfFile)
    fd.append('category', pdfMeta.category)
    fd.append('folder', pdfMeta.folder)
    const res = await fetch('/api/knowledge/upload', { method: 'POST', body: fd })
    if (res.ok) {
      const data = await res.json()
      showFeedback('ok', `PDF lastet opp (${data.pages} sider)`)
      const cat = pdfMeta.category
      const fol = pdfMeta.folder
      setPdfFile(null)
      setPdfMeta({ category: '', folder: '' })
      if (fileRef.current) fileRef.current.value = ''
      await fetchAll()
      if (fol) { setActiveCategory(cat); setActiveFolder(fol); setView('folder') }
      else if (cat) { setActiveCategory(cat); setView('category') }
      else setView('root')
    } else {
      showFeedback('err', 'Opplasting feilet.')
    }
    setPdfUploading(false)
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
    setDeleteEntryId(null)
    fetchAll()
  }

  async function createFolder(name: string, category: string) {
    const res = await fetch('/api/knowledge/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category }),
    })
    if (res.ok) {
      await fetchAll()
      showFeedback('ok', `Mappe "${name}" opprettet`)
    } else {
      showFeedback('err', 'Kunne ikke opprette mappe')
    }
  }

  async function deleteFolder(name: string, category: string) {
    const res = await fetch('/api/knowledge/folders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category }),
    })
    if (res.ok) {
      setDeleteFolderName(null)
      await fetchAll()
      setView('category')
      showFeedback('ok', `Mappe "${name}" slettet`)
    } else {
      showFeedback('err', 'Kunne ikke slette mappe')
    }
  }

  // Build structure
  const categoryMap: Record<string, { direct: Entry[] }> = {}
  for (const e of entries) {
    const cat = e.category?.trim() || 'Ukategorisert'
    if (!categoryMap[cat]) categoryMap[cat] = { direct: [] }
    if (!e.folder) categoryMap[cat].direct.push(e)
  }

  const allCategories = Array.from(new Set([
    ...FIXED_CATEGORIES,
    ...Object.keys(categoryMap),
    ...folders.map(f => f.category),
  ]))

  function foldersInCategory(cat: string) {
    return folders.filter(f => f.category === cat)
  }

  function entriesInFolder(cat: string, folderName: string) {
    return entries.filter(e => e.category === cat && e.folder === folderName)
  }

  function countInCategory(cat: string) {
    return entries.filter(e => e.category === cat).length
  }

  const currentFolders = activeCategory ? foldersInCategory(activeCategory) : []
  const currentFolderEntries = activeCategory && activeFolder ? entriesInFolder(activeCategory, activeFolder) : []
  const currentDirectEntries = activeCategory ? (categoryMap[activeCategory]?.direct ?? []) : []

  return (
    <div style={{ fontFamily: "'Georgia', serif", minHeight: '100vh', background: '#F7F5F0' }}>

      {/* Header */}
      <div style={{ background: '#1a1a1a', color: '#F7F5F0', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>Toast Restaurantgruppen</div>
          <div style={{ fontSize: 20, fontWeight: 400 }}>Kunnskapsbase — Admin</div>
        </div>
        <a href="/chat" style={{ fontSize: 12, color: '#aaa', textDecoration: 'none', letterSpacing: '0.08em' }}>← Til chat</a>
      </div>

      {feedback && (
        <div style={{ margin: '16px 32px 0', padding: '10px 16px', borderRadius: 6, fontSize: 13,
          background: feedback.type === 'ok' ? '#ecfdf5' : '#fef2f2',
          color: feedback.type === 'ok' ? '#065f46' : '#991b1b',
          border: `1px solid ${feedback.type === 'ok' ? '#a7f3d0' : '#fecaca'}` }}>
          {feedback.msg}
        </div>
      )}

      <div style={{ padding: '28px 32px', maxWidth: 960 }}>

        {/* Breadcrumb */}
        {view !== 'root' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#888', marginBottom: 20 }}>
            <button onClick={() => setView('root')} style={crumbBtn}>Kunnskapsbase</button>
            {activeCategory && (
              <>
                <span>/</span>
                <button onClick={() => setView('category')} style={crumbBtn}>{activeCategory}</button>
              </>
            )}
            {activeFolder && view === 'folder' && (
              <>
                <span>/</span>
                <span style={{ color: '#1a1a1a' }}>{activeFolder}</span>
              </>
            )}
            {(view === 'add' || view === 'pdf') && (
              <>
                <span>/</span>
                <span style={{ color: '#1a1a1a' }}>{view === 'add' ? 'Legg til tekst' : 'Last opp PDF'}</span>
              </>
            )}
          </div>
        )}

        {/* ROOT */}
        {view === 'root' && (
          <>
            {loading ? <div style={{ color: '#888', fontSize: 14 }}>Laster...</div> : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 16, marginBottom: 24 }}>
                  {allCategories.map(cat => {
                    const colors = catColor(cat)
                    const icon = CATEGORY_ICONS[cat] ?? '📁'
                    const count = countInCategory(cat)
                    const folderCount = foldersInCategory(cat).length
                    return (
                      <button key={cat} onClick={() => { setActiveCategory(cat); setView('category') }} style={{
                        background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 12,
                        padding: '20px 20px 16px', cursor: 'pointer', textAlign: 'left',
                        fontFamily: 'inherit', transition: 'transform 0.1s',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 4 }}>{cat}</div>
                        <div style={{ fontSize: 12, color: colors.text, opacity: 0.7 }}>{count} dok. · {folderCount} mapper</div>
                      </button>
                    )
                  })}
                  <button onClick={() => setView('new-category')} style={{
                    background: '#fff', border: '1px dashed #ccc', borderRadius: 12,
                    padding: '20px 20px 16px', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit', color: '#aaa',
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>＋</div>
                    <div style={{ fontSize: 14 }}>Ny kategori</div>
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setForm({ title: '', content: '', category: '', folder: '' }); setView('add') }} style={btnStyle(false)}>+ Legg til tekst</button>
                  <button onClick={() => { setPdfMeta({ category: '', folder: '' }); setView('pdf') }} style={{ ...btnStyle(false), background: '#fff', color: '#1a1a1a', border: '1px solid #ddd' }}>+ Last opp PDF</button>
                </div>
              </>
            )}
          </>
        )}

        {/* NY KATEGORI */}
        {view === 'new-category' && (
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: 24, maxWidth: 400 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Ny kategori</div>
            <label style={labelStyle}>Navn</label>
            <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
              placeholder="F.eks. Marked, IT, Ledelse"
              style={{ ...inputStyle, marginBottom: 16 }}
              onKeyDown={e => {
                if (e.key === 'Enter' && newCategoryName.trim()) {
                  setActiveCategory(newCategoryName.trim())
                  setNewCategoryName('')
                  setView('category')
                }
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => {
                if (!newCategoryName.trim()) return
                setActiveCategory(newCategoryName.trim())
                setNewCategoryName('')
                setView('category')
              }} disabled={!newCategoryName.trim()} style={btnStyle(!newCategoryName.trim())}>Opprett</button>
              <button onClick={() => setView('root')} style={{ ...btnStyle(false), background: '#fff', color: '#555', border: '1px solid #ddd' }}>Avbryt</button>
            </div>
          </div>
        )}

        {/* KATEGORI */}
        {view === 'category' && activeCategory && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: '#999' }}>{countInCategory(activeCategory)} dokumenter</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setForm({ title: '', content: '', category: activeCategory, folder: '' }); setView('add') }} style={btnStyle(false)}>+ Legg til tekst</button>
                <button onClick={() => { setPdfMeta({ category: activeCategory, folder: '' }); setView('pdf') }} style={{ ...btnStyle(false), background: '#fff', color: '#1a1a1a', border: '1px solid #ddd' }}>+ Last opp PDF</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 28 }}>
              {currentFolders.map(fol => {
                const count = entriesInFolder(activeCategory, fol.name).length
                const isDeleting = deleteFolderName === fol.name
                return (
                  <div key={fol.id} style={{ position: 'relative' }}>
                    <button onClick={() => { if (!isDeleting) { setActiveFolder(fol.name); setView('folder') } }} style={{
                      width: '100%', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
                      padding: '14px 16px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      transition: 'transform 0.1s', opacity: isDeleting ? 0.5 : 1,
                    }}
                      onMouseEnter={e => { if (!isDeleting) e.currentTarget.style.transform = 'translateY(-2px)' }}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      <div style={{ fontSize: 22, marginBottom: 8 }}>📂</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>{fol.name}</div>
                      <div style={{ fontSize: 11, color: '#aaa' }}>{count} dok.</div>
                    </button>
                    {isDeleting ? (
                      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                        <button onClick={() => deleteFolder(fol.name, activeCategory)} style={{ fontSize: 11, padding: '3px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Slett</button>
                        <button onClick={() => setDeleteFolderName(null)} style={{ fontSize: 11, padding: '3px 8px', background: '#e5e7eb', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Avbryt</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteFolderName(fol.name)} style={{
                        position: 'absolute', top: 8, right: 8, background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: 12, color: '#ccc', padding: '2px 4px',
                      }}>✕</button>
                    )}
                  </div>
                )
              })}

              {/* Ny mappe */}
              {addingFolder ? (
                <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Mappenavn..."
                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', background: 'transparent', marginBottom: 8, boxSizing: 'border-box' }}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && newFolderName.trim()) {
                        await createFolder(newFolderName.trim(), activeCategory)
                        setNewFolderName('')
                        setAddingFolder(false)
                      }
                      if (e.key === 'Escape') { setNewFolderName(''); setAddingFolder(false) }
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={async () => {
                      if (!newFolderName.trim()) return
                      await createFolder(newFolderName.trim(), activeCategory)
                      setNewFolderName('')
                      setAddingFolder(false)
                    }} style={{ fontSize: 11, padding: '4px 10px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>OK</button>
                    <button onClick={() => { setNewFolderName(''); setAddingFolder(false) }} style={{ fontSize: 11, padding: '4px 10px', background: '#f3f4f6', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Avbryt</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingFolder(true)} style={{
                  background: '#fff', border: '1px dashed #ccc', borderRadius: 10,
                  padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit', color: '#aaa',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>＋</div>
                  <div style={{ fontSize: 13 }}>Ny mappe</div>
                </button>
              )}
            </div>

            {currentDirectEntries.length > 0 && (
              <>
                <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#aaa', marginBottom: 10 }}>Uten mappe</div>
                <EntryList entries={currentDirectEntries} deleteId={deleteEntryId} setDeleteId={setDeleteEntryId} onDelete={deleteEntry} />
              </>
            )}

            {currentFolders.length === 0 && currentDirectEntries.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#aaa', fontSize: 14 }}>
                Ingen dokumenter ennå. Opprett en mappe eller legg til direkte.
              </div>
            )}
          </>
        )}

        {/* MAPPE */}
        {view === 'folder' && activeCategory && activeFolder && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: '#999' }}>{currentFolderEntries.length} dokumenter</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setForm({ title: '', content: '', category: activeCategory, folder: activeFolder }); setView('add') }} style={btnStyle(false)}>+ Legg til tekst</button>
                <button onClick={() => { setPdfMeta({ category: activeCategory, folder: activeFolder }); setView('pdf') }} style={{ ...btnStyle(false), background: '#fff', color: '#1a1a1a', border: '1px solid #ddd' }}>+ Last opp PDF</button>
              </div>
            </div>
            {currentFolderEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#aaa', fontSize: 14 }}>Ingen dokumenter ennå.</div>
            ) : (
              <EntryList entries={currentFolderEntries} deleteId={deleteEntryId} setDeleteId={setDeleteEntryId} onDelete={deleteEntry} />
            )}
          </>
        )}

        {/* LEGG TIL TEKST */}
        {view === 'add' && (
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: 24, maxWidth: 640 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Tittel *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="F.eks. Rutine for sykemelding" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Kategori</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value, folder: '' }))} style={inputStyle}>
                    <option value="">Ingen</option>
                    {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Undermappe</label>
                  <select value={form.folder} onChange={e => setForm(p => ({ ...p, folder: e.target.value }))} style={inputStyle} disabled={!form.category}>
                    <option value="">Ingen</option>
                    {foldersInCategory(form.category).map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Innhold *</label>
                <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Skriv inn kunnskapen her..." rows={8} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={saveEntry} disabled={saving || !form.title.trim() || !form.content.trim()} style={btnStyle(saving || !form.title.trim() || !form.content.trim())}>
                  {saving ? 'Lagrer...' : 'Lagre'}
                </button>
                <button onClick={() => setView(activeFolder ? 'folder' : activeCategory ? 'category' : 'root')} style={{ ...btnStyle(false), background: '#fff', color: '#555', border: '1px solid #ddd' }}>Avbryt</button>
              </div>
            </div>
          </div>
        )}

        {/* PDF */}
        {view === 'pdf' && (
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: 24, maxWidth: 640 }}>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>Teksten ekstraheres automatisk fra PDF-en.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>PDF-fil *</label>
                <div style={{ border: '2px dashed #ddd', borderRadius: 8, padding: 32, textAlign: 'center', cursor: 'pointer', background: pdfFile ? '#f0fdf4' : '#fafafa' }}
                  onClick={() => fileRef.current?.click()}>
                  {pdfFile ? (
                    <>
                      <div style={{ fontSize: 28 }}>📄</div>
                      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 8 }}>{pdfFile.name}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{(pdfFile.size / 1024).toFixed(0)} KB</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 28 }}>📂</div>
                      <div style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Klikk for å velge PDF</div>
                    </>
                  )}
                  <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setPdfFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Kategori</label>
                  <select value={pdfMeta.category} onChange={e => setPdfMeta(p => ({ ...p, category: e.target.value, folder: '' }))} style={inputStyle}>
                    <option value="">Ingen</option>
                    {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Undermappe</label>
                  <select value={pdfMeta.folder} onChange={e => setPdfMeta(p => ({ ...p, folder: e.target.value }))} style={inputStyle} disabled={!pdfMeta.category}>
                    <option value="">Ingen</option>
                    {foldersInCategory(pdfMeta.category).map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={uploadPdf} disabled={pdfUploading || !pdfFile} style={btnStyle(pdfUploading || !pdfFile)}>
                  {pdfUploading ? 'Laster opp...' : 'Last opp PDF'}
                </button>
                <button onClick={() => setView(activeFolder ? 'folder' : activeCategory ? 'category' : 'root')} style={{ ...btnStyle(false), background: '#fff', color: '#555', border: '1px solid #ddd' }}>Avbryt</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function EntryList({ entries, deleteId, setDeleteId, onDelete }: {
  entries: Entry[]
  deleteId: string | null
  setDeleteId: (id: string | null) => void
  onDelete: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entries.map(e => (
        <div key={e.id} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</span>
              {e.source && <span style={{ fontSize: 11, color: '#888' }}>📄 {e.source}</span>}
            </div>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5, maxHeight: 60, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent)' }}>
              {e.content}
            </div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>
              {new Date(e.created_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          {deleteId === e.id ? (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => onDelete(e.id)} style={{ fontSize: 12, padding: '5px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>Slett</button>
              <button onClick={() => setDeleteId(null)} style={{ fontSize: 12, padding: '5px 12px', background: '#f3f4f6', border: 'none', borderRadius: 5, cursor: 'pointer' }}>Avbryt</button>
            </div>
          ) : (
            <button onClick={() => setDeleteId(e.id)} style={{ fontSize: 12, color: '#ccc', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '4px 8px' }}>✕</button>
          )}
        </div>
      ))}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: '#555', marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #ddd',
  borderRadius: 6, fontFamily: 'inherit', boxSizing: 'border-box',
  background: '#fafafa', outline: 'none',
}

const btnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '11px 24px', fontSize: 13, fontFamily: 'inherit', letterSpacing: '0.06em',
  background: disabled ? '#ccc' : '#1a1a1a', color: '#fff', border: 'none',
  borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
})

const crumbBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#888',
  fontSize: 13, fontFamily: 'inherit', padding: 0, textDecoration: 'underline',
}