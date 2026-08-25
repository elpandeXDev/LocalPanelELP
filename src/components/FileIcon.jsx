import {
  Folder, FileText, Image, Video, Music, FileCode, FileArchive,
  FileSpreadsheet, File, FileType, Presentation, FileJson, Settings, Coffee,
} from 'lucide-react'

const iconMap = {
  folder: { Icon: Folder, color: 'text-panel-400' },
  image: { Icon: Image, color: 'text-purple-400' },
  video: { Icon: Video, color: 'text-pink-400' },
  audio: { Icon: Music, color: 'text-amber-400' },
  pdf: { Icon: FileType, color: 'text-red-400' },
  archive: { Icon: FileArchive, color: 'text-yellow-400' },
  document: { Icon: FileText, color: 'text-blue-400' },
  spreadsheet: { Icon: FileSpreadsheet, color: 'text-green-400' },
  presentation: { Icon: Presentation, color: 'text-orange-400' },
  code: { Icon: FileCode, color: 'text-cyan-400' },
  text: { Icon: FileText, color: 'text-slate-400' },
  executable: { Icon: FileJson, color: 'text-rose-400' },
  java: { Icon: Coffee, color: 'text-orange-500' },
  config: { Icon: Settings, color: 'text-slate-300' },
  file: { Icon: File, color: 'text-slate-400' },
}

export default function FileIcon({ type, className = 'w-5 h-5' }) {
  const { Icon, color } = iconMap[type] || iconMap.file
  return <Icon className={`${className} ${color}`} />
}
