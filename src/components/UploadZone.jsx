import { useState, useRef, useCallback } from 'react'
import { api } from '../api.js'
import { UploadCloud, X, CheckCircle, AlertCircle } from 'lucide-react'

export default function UploadZone({ directory, mount, onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [uploads, setUploads] = useState([])
  const [showQueue, setShowQueue] = useState(false)
  const fileInputRef = useRef(null)
  const dragCounter = useRef(0)

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList)
    if (!files.length) return

    setShowQueue(true)

    const newUploads = files.map((file) => ({
      id: `${Date.now()}-${file.name}-${Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending',
      error: null,
    }))

    setUploads((prev) => [...prev, ...newUploads])

    const MAX_CONCURRENT = 3
    const queue = [...newUploads]

    async function processQueue() {
      while (queue.length > 0) {
        const entry = queue.shift()
        setUploads((prev) =>
          prev.map((u) => (u.id === entry.id ? { ...u, status: 'uploading' } : u)),
        )

        const formData = new FormData()
        formData.append('directory', directory || '')
        formData.append('mount', mount || 'internal')
        formData.append('files', entry.file)

        try {
          await api.files.upload(formData, (progress) => {
            setUploads((prev) =>
              prev.map((u) => (u.id === entry.id ? { ...u, progress } : u)),
            )
          })
          setUploads((prev) =>
            prev.map((u) =>
              u.id === entry.id ? { ...u, status: 'complete', progress: 100 } : u,
            ),
          )
        } catch (err) {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === entry.id ? { ...u, status: 'error', error: err.message } : u,
            ),
          )
        }
      }
    }

    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, files.length) }, () =>
      processQueue(),
    )
    await Promise.all(workers)

    const allComplete = newUploads.every((u) => u.status === 'complete')
    if (allComplete && onUploaded) {
      setTimeout(() => onUploaded(), 500)
    }
  }, [directory, onUploaded])

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    setDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
  }

  const clearCompleted = () => {
    setUploads((prev) => prev.filter((u) => u.status !== 'complete' && u.status !== 'error'))
    if (uploads.every((u) => u.status === 'complete' || u.status === 'error')) {
      setShowQueue(false)
    }
  }

  return (
    <>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${
          dragging
            ? 'border-panel-500 bg-panel-600/10'
            : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files.length > 0) handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <div className="flex items-center justify-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
            dragging ? 'bg-panel-600/30' : 'bg-slate-800'
          }`}>
            <UploadCloud className={`w-6 h-6 ${dragging ? 'text-panel-400' : 'text-slate-400'}`} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-200">
              {dragging ? 'Suelta los archivos aqui' : 'Arrastra archivos o haz clic para subir'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Cualquier tipo de archivo, hasta 10 GB</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary text-sm"
          >
            Seleccionar
          </button>
        </div>
      </div>

      {showQueue && uploads.length > 0 && (
        <div className="card p-4 mt-3 fade-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-200">Cola de subida</h4>
            <div className="flex items-center gap-2">
              <button
                onClick={clearCompleted}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Limpiar
              </button>
              <button
                onClick={() => setShowQueue(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {uploads.map((u) => (
              <div key={u.id} className="flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-300 truncate">{u.name}</span>
                    <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                      {formatBytes(u.size)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        u.status === 'error'
                          ? 'bg-red-500'
                          : u.status === 'complete'
                            ? 'bg-emerald-500'
                            : 'bg-panel-500'
                      }`}
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {u.status === 'complete' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                  {u.status === 'error' && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="w-4 h-4" />
                    </span>
                  )}
                  {u.status === 'uploading' && (
                    <span className="text-xs text-slate-400">{u.progress}%</span>
                  )}
                  {u.status === 'pending' && (
                    <span className="text-xs text-slate-500">...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
