'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import RGL, { WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { WIDGET_REGISTRY, DEFAULT_WIDGETS, WidgetType } from '@/lib/widgetRegistry'

const GridLayout = WidthProvider(RGL)

export default function AccountingDashboard({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [widgets, setWidgets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [firmUserId, setFirmUserId] = useState('')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [saveTimeout, setSaveTimeout] = useState<any>(null)

  useEffect(() => { fetchWidgets() }, [clientId])

  async function fetchWidgets() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('id').eq('user_id', user!.id).single()
    if (!firmUser) { setLoading(false); return }
    setFirmUserId(firmUser.id)

    const { data } = await supabase.from('dashboard_widgets').select('*').eq('firm_user_id', firmUser.id).eq('client_id', clientId)

    if (!data || data.length === 0) {
      // First time this user views this client's dashboard - seed sensible defaults
      const seeded = DEFAULT_WIDGETS.map((w) => ({
        firm_user_id: firmUser.id,
        client_id: clientId,
        widget_type: w.widget_type,
        position_x: w.x,
        position_y: w.y,
        width: w.w,
        height: w.h,
      }))
      const { data: inserted } = await supabase.from('dashboard_widgets').insert(seeded).select()
      setWidgets(inserted || [])
    } else {
      setWidgets(data)
    }
    setLoading(false)
  }

  const layout = widgets.map((w) => ({ i: w.id, x: w.position_x, y: w.position_y, w: w.width, h: w.height, minW: 3, minH: 4 }))

  function handleLayoutChange(newLayout: any[]) {
    // Debounced save - dragging/resizing fires this continuously, only persist once things settle
    if (saveTimeout) clearTimeout(saveTimeout)
    const t = setTimeout(async () => {
      for (const item of newLayout) {
        await supabase.from('dashboard_widgets').update({ position_x: item.x, position_y: item.y, width: item.w, height: item.h }).eq('id', item.i)
      }
    }, 600)
    setSaveTimeout(t)
  }

  async function handleAddWidget(widgetType: WidgetType) {
    const def = WIDGET_REGISTRY[widgetType]
    const maxY = widgets.reduce((max, w) => Math.max(max, w.position_y + w.height), 0)
    const { data: inserted } = await supabase
      .from('dashboard_widgets')
      .insert({ firm_user_id: firmUserId, client_id: clientId, widget_type: widgetType, position_x: 0, position_y: maxY, width: def.defaultW, height: def.defaultH })
      .select()
      .single()
    if (inserted) setWidgets((prev) => [...prev, inserted])
    setShowAddMenu(false)
  }

  async function handleRemoveWidget(id: string) {
    await supabase.from('dashboard_widgets').delete().eq('id', id)
    setWidgets((prev) => prev.filter((w) => w.id !== id))
  }

  const usedTypes = new Set(widgets.map((w) => w.widget_type))
  const availableToAdd = (Object.keys(WIDGET_REGISTRY) as WidgetType[]).filter((t) => !usedTypes.has(t))

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading your dashboard...</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Drag to rearrange, drag the corner to resize — your layout is saved automatically</p>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            disabled={availableToAdd.length === 0}
            className="bg-brand-dark text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition disabled:opacity-40"
          >
            + Add Widget
          </button>
          {showAddMenu && availableToAdd.length > 0 && (
            <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 py-2 w-64 z-10">
              {availableToAdd.map((t) => (
                <button
                  key={t}
                  onClick={() => handleAddWidget(t)}
                  className="w-full text-left px-4 py-2 text-sm text-brand-dark hover:bg-brand-light transition"
                >
                  {WIDGET_REGISTRY[t].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <GridLayout
        layout={layout}
        cols={12}
        rowHeight={30}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-drag-handle"
        margin={[16, 16]}
      >
        {widgets.map((w) => {
          const def = WIDGET_REGISTRY[w.widget_type as WidgetType]
          if (!def) return <div key={w.id} />
          const WidgetComponent = def.component
          return (
            <div key={w.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              <div className="widget-drag-handle bg-gray-50 px-3 py-1.5 flex items-center justify-between cursor-move border-b border-gray-100">
                <span className="text-xs text-gray-400">⠿⠿ drag</span>
                <button onClick={() => handleRemoveWidget(w.id)} className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
              </div>
              <div className="flex-1 p-3 overflow-hidden">
                <WidgetComponent clientId={clientId} />
              </div>
            </div>
          )
        })}
      </GridLayout>
    </div>
  )
}
