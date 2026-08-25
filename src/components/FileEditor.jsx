import { useState, useEffect, useRef } from 'react'
import { api } from '../api.js'
import { Save, X, FileText, Check, AlertCircle, Loader2 } from 'lucide-react'

export default function FileEditor({ filePath, mount, onClose, onSaved }) {
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [language, setLanguage] = useState('text')
  const textareaRef = useRef(null)

  const fileName = filePath.split('/').pop()

  useEffect(() => {
    setLoading(true)
    api.files
      .read(filePath, mount)
      .then((data) => {
        setContent(data.content)
        setOriginalContent(data.content)
        setLanguage(detectLanguage(fileName))
      })
      .catch((err) => setMessage({ type: 'error', text: err.message }))
      .finally(() => setLoading(false))
  }, [filePath, mount])

  const dirty = content !== originalContent

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await api.files.save(filePath, content, mount)
      setOriginalContent(content)
      setMessage({ type: 'success', text: 'Guardado correctamente' })
      if (onSaved) onSaved()
      setTimeout(() => setMessage(null), 2000)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (dirty && !saving) handleSave()
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.target.selectionStart
      const end = e.target.selectionEnd
      const newContent = content.substring(0, start) + '  ' + content.substring(end)
      setContent(newContent)
      requestAnimationFrame(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2
      })
    }
  }

  const lineCount = content.split('\n').length
  const charCount = content.length

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 fade-in" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-panel-400 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-white text-sm truncate">{fileName}</h3>
              <p className="text-xs text-slate-500 truncate">{filePath}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {dirty && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-amber-400 rounded-full" />
                Sin guardar
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="btn-primary text-sm py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 text-sm px-5 py-2 border-b ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            } fade-in`}
          >
            {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-panel-500 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex">
            <div className="bg-slate-950/50 text-slate-600 text-xs font-mono py-3 px-3 select-none text-right border-r border-slate-800 overflow-hidden">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="leading-6">{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-slate-900 text-slate-100 font-mono text-sm p-3 outline-none resize-none leading-6 overflow-auto"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-2 border-t border-slate-800 text-xs text-slate-500">
          <span>{language}</span>
          <span>{lineCount} lineas | {charCount} caracteres</span>
        </div>
      </div>
    </div>
  )
}

function detectLanguage(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const map = {
    js: 'JavaScript', jsx: 'JavaScript (JSX)', ts: 'TypeScript', tsx: 'TypeScript (TSX)',
    py: 'Python', java: 'Java', c: 'C', cpp: 'C++', cs: 'C#', php: 'PHP',
    rb: 'Ruby', go: 'Go', rs: 'Rust', sh: 'Shell', bat: 'Batch', ps1: 'PowerShell',
    html: 'HTML', css: 'CSS', scss: 'SCSS', json: 'JSON', xml: 'XML',
    yml: 'YAML', yaml: 'YAML', toml: 'TOML', ini: 'INI', cfg: 'Config',
    conf: 'Config', properties: 'Properties', env: 'Environment',
    sql: 'SQL', md: 'Markdown', txt: 'Text', log: 'Log', vue: 'Vue',
    svelte: 'Svelte', gradle: 'Gradle', csv: 'CSV',
  }
  return map[ext] || 'Text'
}
