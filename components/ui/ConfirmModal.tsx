'use client'

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirming = false,
  onConfirm,
  onCancel,
  danger = false,
}: {
  isOpen: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  confirming?: boolean
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-brand-dark">{title}</h3>
          {message && <p className="text-sm text-gray-500 mt-1">{message}</p>}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={confirming}
            className={`flex-1 font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-50 ${
              danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-brand-dark text-white hover:bg-opacity-90'
            }`}
          >
            {confirming ? 'Saving...' : confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
