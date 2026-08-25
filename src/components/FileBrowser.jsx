import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api.js'
import FileIcon from './FileIcon.jsx'
import UploadZone from './UploadZone.jsx'
import FileEditor from './FileEditor.jsx'
import {
  ChevronRight, Home, FolderPlus, Download, Trash2, Edit3,
  Search, MoreVertical, ArrowLeft, RefreshCw, X, FilePlus,
  LayoutGrid, List, ArrowUp, ArrowDown, HardDrive, Folder, File,
} from 'lucide-react'

export default function FileBrowser() {
  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [showMenu, setShowMenu] = useState(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showRename, setShowRename] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [showDelete, setShowDelete] = useState(null)
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [editingFile, setEditingFile] = useState(null)
  const [mount, setMount] = useState('internal')
  const [mounts, setMounts] = useState([])
  const [viewMode, setViewMode] = useState('list')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [checkedItems, setCheckedItems] = useState(new Set())
  const [showBatchDelete, setShowBatchDelete] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)

  const loadFiles = useCallback(async (path = '', mnt = mount) => {
    setLoading(true)
    setSearchQuery('')
    setSearchResults(null)
    setCheckedItems(new Set())
    try {
      const data = await api.files.list(path, mnt)
      setItems(data.items)
      setCurrentPath(data.path)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [mount])

  useEffect(() => {
    api.linked.list().then((data) => setMounts(data.dirs))
    loadFiles('', 'internal')
  }, [])

  const handleMountChange = (mnt) => {
    setMount(mnt)
    loadFiles('', mnt)
  }

  const breadcrumbs = currentPath
    ? currentPath.split('/').filter(Boolean)
    : []

  const navigateTo = (path) => {
    loadFiles(path)
    setSelectedItem(null)
  }

  const navigateToBreadcrumb = (index) => {
    const path = breadcrumbs.slice(0, index + 1).join('/')
    navigateTo(path)
  }

  const handleItemClick = (item) => {
    if (item.type === 'directory') {
      navigateTo(item.path)
    } else {
      setSelectedItem(selectedItem?.path === item.path ? null : item)
    }
  }

  const handleItemDoubleClick = (item) => {
    if (item.type === 'file' && item.editable) {
      setEditingFile({ path: item.path, mount })
    }
  }

  const handleSearch = async (e) => {
    const q = e.target.value
    setSearchQuery(q)
    if (!q.trim()) {
      setSearchResults(null)
      return
    }
    try {
      const data = await api.files.search(q, mount)
      setSearchResults(data.results)
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await api.files.mkdir(newFolderName, currentPath, mount)
      setShowNewFolder(false)
      setNewFolderName('')
      loadFiles(currentPath, mount)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return
    try {
      await api.files.createFile(newFileName, currentPath, mount)
      setShowNewFile(false)
      setNewFileName('')
      loadFiles(currentPath, mount)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleRename = async () => {
    if (!renameValue.trim()) return
    try {
      await api.files.rename(showRename.path, renameValue, mount)
      setShowRename(null)
      setRenameValue('')
      loadFiles(currentPath, mount)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDelete = async () => {
    try {
      await api.files.delete(showDelete.path, mount)
      setShowDelete(null)
      setSelectedItem(null)
      loadFiles(currentPath, mount)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleBatchDelete = async () => {
    setBatchDeleting(true)
    try {
      for (const p of checkedItems) {
        await api.files.delete(p, mount)
      }
      setShowBatchDelete(false)
      setCheckedItems(new Set())
      loadFiles(currentPath, mount)
    } catch (err) {
      alert(err.message)
    } finally {
      setBatchDeleting(false)
    }
  }

  const toggleChecked = (item, e) => {
    e.stopPropagation()
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(item.path)) next.delete(item.path)
      else next.add(item.path)
      return next
    })
  }

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const displayItems = searchQuery ? (searchResults || []) : items

  const sortedItems = useMemo(() => {
    const arr = [...displayItems]
    arr.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortBy === 'size') cmp = (a.size || 0) - (b.size || 0)
      else cmp = new Date(a.modified) - new Date(b.modified)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [displayItems, sortBy, sortDir])

  const stats = useMemo(() => {
    const dirs = displayItems.filter((i) => i.type === 'directory').length
    const files = displayItems.filter((i) => i.type === 'file')
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }
    return { dirs, files: files.length, totalSize: formatBytes(totalSize) }
  }, [displayItems])

  const allChecked = sortedItems.length > 0 && checkedItems.size === sortedItems.length

  const toggleCheckAll = () => {
    if (allChecked) setCheckedItems(new Set())
    else setCheckedItems(new Set(sortedItems.map((i) => i.path)))
  }

  const SortHeader = ({ field, label, className = '' }) => (
    <button
      onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors ${
        sortBy === field ? 'text-panel-400' : 'text-slate-500 hover:text-slate-300'
      } ${className}`}
    >
      {label}
      {sortBy === field && (
        sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
      )}
    </button>
  )

  return (
    <div className="space-y-4 fade-in" onClick={() => setShowMenu(null)}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestor de Archivos</h1>
          <p className="text-slate-400 mt-1">Almacena y gestiona todo tipo de archivos</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-panel-600/30 text-panel-400' : 'text-slate-400 hover:text-slate-200'}`}
              title="Vista de lista"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-panel-600/30 text-panel-400' : 'text-slate-400 hover:text-slate-200'}`}
              title="Vista de cuadricula"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => loadFiles(currentPath, mount)} className="btn-secondary text-sm" title="Actualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowNewFile(true)} className="btn-secondary text-sm">
            <FilePlus className="w-4 h-4" />
            Nuevo Archivo
          </button>
          <button onClick={() => setShowNewFolder(true)} className="btn-secondary text-sm">
            <FolderPlus className="w-4 h-4" />
            Nueva Carpeta
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Buscar archivos..."
            className="input-field pl-10 py-2 text-sm"
          />
        </div>
        <select
          value={mount}
          onChange={(e) => handleMountChange(e.target.value)}
          className="input-field py-2 text-sm w-auto"
        >
          <option value="internal">Interno</option>
          {mounts.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {breadcrumbs.length > 0 && !searchQuery && (
        <div className="flex items-center gap-1 text-sm flex-wrap">
          <button
            onClick={() => navigateTo('')}
            className="flex items-center gap-1 text-slate-400 hover:text-panel-400"
          >
            <Home className="w-4 h-4" />
            Inicio
          </button>
          {breadcrumbs.map((crumb, i) => (
            <div key={i} className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 text-slate-600" />
              <button
                onClick={() => navigateToBreadcrumb(i)}
                className={`hover:text-panel-400 ${i === breadcrumbs.length - 1 ? 'text-slate-200 font-medium' : 'text-slate-400'}`}
              >
                {crumb}
              </button>
            </div>
          ))}
        </div>
      )}

      <UploadZone directory={currentPath} mount={mount} onUploaded={() => loadFiles(currentPath, mount)} />

      {checkedItems.size > 0 && (
        <div className="flex items-center justify-between bg-panel-600/10 border border-panel-500/30 rounded-lg px-4 py-2.5 fade-in">
          <span className="text-sm text-panel-300">
            {checkedItems.size} {checkedItems.size === 1 ? 'elemento seleccionado' : 'elementos seleccionados'}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setCheckedItems(new Set())} className="btn-secondary text-sm py-1.5">
              Deseleccionar
            </button>
            <button onClick={() => setShowBatchDelete(true)} className="btn-danger text-sm py-1.5">
              <Trash2 className="w-4 h-4" />
              Eliminar ({checkedItems.size})
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-panel-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <FolderPlus className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">{searchQuery ? 'No se encontraron resultados' : 'Esta carpeta esta vacia'}</p>
            {!searchQuery && (
              <p className="text-xs mt-1">Sube archivos o crea una carpeta para empezar</p>
            )}
          </div>
        ) : viewMode === 'list' ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleCheckAll}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-panel-500 focus:ring-panel-500 cursor-pointer accent-blue-500"
                  />
                </th>
                <th className="px-2 py-3"><SortHeader field="name" label="Nombre" /></th>
                <th className="px-4 py-3 hidden md:table-cell"><SortHeader field="size" label="Tamano" /></th>
                <th className="px-4 py-3 hidden lg:table-cell"><SortHeader field="modified" label="Modificado" /></th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {breadcrumbs.length > 0 && !searchQuery && (
                <tr
                  onClick={() => navigateTo(breadcrumbs.slice(0, -1).join('/'))}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3" colSpan={5}>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <ArrowLeft className="w-5 h-5" />
                      Volver
                    </div>
                  </td>
                </tr>
              )}
              {sortedItems.map((item) => (
                <tr
                  key={item.path}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  className={`border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors ${
                    selectedItem?.path === item.path || checkedItems.has(item.path) ? 'bg-panel-600/10' : ''
                  }`}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checkedItems.has(item.path)}
                      onChange={(e) => toggleChecked(item, e)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 cursor-pointer accent-blue-500"
                    />
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-3">
                      <FileIcon type={item.icon} />
                      <span className="text-sm text-slate-200 truncate max-w-xs md:max-w-md lg:max-w-2xl">
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400 hidden md:table-cell">
                    {item.sizeFormatted}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400 hidden lg:table-cell">
                    {formatDate(item.modified)}
                  </td>
                  <td className="px-4 py-3 relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setShowMenu(showMenu === item.path ? null : item.path)}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {showMenu === item.path && (
                      <div
                        className="absolute right-0 top-full mt-1 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px] fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.type === 'file' && (
                          <button
                            onClick={() => {
                              api.files.download(item.path, mount)
                              setShowMenu(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                          >
                            <Download className="w-4 h-4" />
                            Descargar
                          </button>
                        )}
                        {item.type === 'file' && item.editable && (
                          <button
                            onClick={() => {
                              setEditingFile({ path: item.path, mount })
                              setShowMenu(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-panel-400 hover:bg-slate-700"
                          >
                            <Edit3 className="w-4 h-4" />
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setShowRename(item)
                            setRenameValue(item.name)
                            setShowMenu(null)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                        >
                          <Edit3 className="w-4 h-4" />
                          Renombrar
                        </button>
                        <button
                          onClick={() => {
                            setShowDelete(item)
                            setShowMenu(null)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-4">
            {breadcrumbs.length > 0 && !searchQuery && (
              <button
                onClick={() => navigateTo(breadcrumbs.slice(0, -1).join('/'))}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-panel-400 mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </button>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {sortedItems.map((item) => (
                <div
                  key={item.path}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  className={`relative group flex flex-col items-center p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedItem?.path === item.path || checkedItems.has(item.path)
                      ? 'bg-panel-600/15 border-panel-500/40'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checkedItems.has(item.path)}
                    onChange={(e) => toggleChecked(item, e)}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute top-2 left-2 w-4 h-4 rounded cursor-pointer accent-blue-500 transition-opacity ${
                      checkedItems.has(item.path) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(showMenu === item.path ? null : item.path)
                    }}
                    className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-opacity"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {showMenu === item.path && (
                    <div
                      className="absolute right-2 top-8 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px] fade-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.type === 'file' && (
                        <button
                          onClick={() => {
                            api.files.download(item.path, mount)
                            setShowMenu(null)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                        >
                          <Download className="w-4 h-4" />
                          Descargar
                        </button>
                      )}
                      {item.type === 'file' && item.editable && (
                        <button
                          onClick={() => {
                            setEditingFile({ path: item.path, mount })
                            setShowMenu(null)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-panel-400 hover:bg-slate-700"
                        >
                          <Edit3 className="w-4 h-4" />
                          Editar
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowRename(item)
                          setRenameValue(item.name)
                          setShowMenu(null)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                      >
                        <Edit3 className="w-4 h-4" />
                        Renombrar
                      </button>
                      <button
                        onClick={() => {
                          setShowDelete(item)
                          setShowMenu(null)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </button>
                    </div>
                  )}
                  <FileIcon type={item.icon} className="w-10 h-10 mb-2" />
                  <span className="text-xs text-slate-200 text-center break-all line-clamp-2 leading-tight">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">{item.sizeFormatted}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && sortedItems.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-800 bg-slate-900/50 text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5" />
                {stats.dirs} carpetas
              </span>
              <span className="flex items-center gap-1.5">
                <File className="w-3.5 h-3.5" />
                {stats.files} archivos
              </span>
            </div>
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" />
              {stats.totalSize}
            </span>
          </div>
        )}
      </div>

      {showNewFile && (
        <Modal title="Nuevo Archivo" onClose={() => setShowNewFile(false)}>
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
            className="input-field"
            placeholder="nombre-archivo.txt"
            autoFocus
          />
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowNewFile(false)} className="btn-secondary flex-1 justify-center">
              Cancelar
            </button>
            <button onClick={handleCreateFile} className="btn-primary flex-1 justify-center">
              Crear
            </button>
          </div>
        </Modal>
      )}

      {showNewFolder && (
        <Modal title="Nueva Carpeta" onClose={() => setShowNewFolder(false)}>
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            className="input-field"
            placeholder="Nombre de la carpeta"
            autoFocus
          />
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowNewFolder(false)} className="btn-secondary flex-1 justify-center">
              Cancelar
            </button>
            <button onClick={handleCreateFolder} className="btn-primary flex-1 justify-center">
              Crear
            </button>
          </div>
        </Modal>
      )}

      {editingFile && (
        <FileEditor
          filePath={editingFile.path}
          mount={editingFile.mount}
          onClose={() => setEditingFile(null)}
          onSaved={() => loadFiles(currentPath, mount)}
        />
      )}

      {showRename && (
        <Modal title="Renombrar" onClose={() => setShowRename(null)}>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            className="input-field"
            autoFocus
          />
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowRename(null)} className="btn-secondary flex-1 justify-center">
              Cancelar
            </button>
            <button onClick={handleRename} className="btn-primary flex-1 justify-center">
              Guardar
            </button>
          </div>
        </Modal>
      )}

      {showDelete && (
        <Modal title="Confirmar eliminacion" onClose={() => setShowDelete(null)}>
          <p className="text-slate-300">
            Seguro que quieres eliminar <span className="font-semibold text-white">{showDelete.name}</span>?
            {showDelete.type === 'directory' && ' Esta accion eliminara todo el contenido de la carpeta.'}
          </p>
          <p className="text-xs text-slate-500 mt-2">Esta accion no se puede deshacer.</p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowDelete(null)} className="btn-secondary flex-1 justify-center">
              Cancelar
            </button>
            <button onClick={handleDelete} className="btn-danger flex-1 justify-center">
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          </div>
        </Modal>
      )}

      {showBatchDelete && (
        <Modal title="Eliminar varios elementos" onClose={() => setShowBatchDelete(false)}>
          <p className="text-slate-300">
            Seguro que quieres eliminar <span className="font-semibold text-white">{checkedItems.size} elementos</span>?
          </p>
          <p className="text-xs text-slate-500 mt-2">Esta accion no se puede deshacer. Las carpetas se eliminaran con todo su contenido.</p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowBatchDelete(false)} className="btn-secondary flex-1 justify-center">
              Cancelar
            </button>
            <button onClick={handleBatchDelete} disabled={batchDeleting} className="btn-danger flex-1 justify-center">
              {batchDeleting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Eliminar todo
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
