import { Server, LayoutDashboard, FolderTree, Settings, LogOut, Gamepad2, Bot, Link2 } from 'lucide-react'

export default function Layout({ username, page, onPageChange, onLogout, children }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'files', label: 'Archivos', icon: FolderTree },
    { id: 'minecraft', label: 'Minecraft', icon: Gamepad2 },
    { id: 'bots', label: 'Bots Discord', icon: Bot },
    { id: 'dirs', label: 'Directorios', icon: Link2 },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col fixed h-full">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-panel-600/20 border border-panel-500/30 rounded-xl flex items-center justify-center">
              <Server className="w-5 h-5 text-panel-400" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm">LocalPanelELP</h1>
              <p className="text-xs text-slate-500">ELP Studios</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-panel-600/20 text-panel-400 border border-panel-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold text-slate-300">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-300 truncate">{username}</p>
              <p className="text-xs text-slate-500">Administrador</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesion
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
