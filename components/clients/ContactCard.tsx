'use client'

export default function ContactCard({ contact, onEdit }: { contact: any; onEdit?: () => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-dark flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {contact.name?.[0] || '?'}
            </span>
          </div>
          <div>
            <p className="font-semibold text-brand-dark text-sm">{contact.name}</p>
            <p className="text-xs text-gray-500 capitalize">{contact.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {contact.is_primary && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-brand-gold/20 text-brand-dark font-medium">
              Primary
            </span>
          )}
          {onEdit && (
            <button onClick={onEdit} className="text-xs text-brand-dark font-medium hover:underline">
              Edit
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {contact.email && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Email</p>
            <p className="text-sm text-brand-dark mt-0.5">{contact.email}</p>
          </div>
        )}
        {contact.phone && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Phone</p>
            <p className="text-sm text-brand-dark mt-0.5">{contact.phone}</p>
          </div>
        )}
        {contact.date_of_birth && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Date of Birth</p>
            <p className="text-sm text-brand-dark mt-0.5">
              {new Date(contact.date_of_birth).toLocaleDateString('en-GB')}
            </p>
          </div>
        )}
        {contact.national_insurance_number && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">NI Number</p>
            <p className="text-sm text-brand-dark mt-0.5">{contact.national_insurance_number}</p>
          </div>
        )}
        {contact.personal_utr && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Personal UTR</p>
            <p className="text-sm text-brand-dark mt-0.5">{contact.personal_utr}</p>
          </div>
        )}
        {contact.shareholding_percentage && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Shareholding</p>
            <p className="text-sm text-brand-dark mt-0.5">{contact.shareholding_percentage}%</p>
          </div>
        )}
        {contact.appointment_date && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Appointed</p>
            <p className="text-sm text-brand-dark mt-0.5">
              {new Date(contact.appointment_date).toLocaleDateString('en-GB')}
            </p>
          </div>
        )}
        {contact.ch_authentication_code && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">CH Auth Code</p>
            <p className="text-sm text-brand-dark mt-0.5">{contact.ch_authentication_code}</p>
          </div>
        )}
        {contact.ch_identity_verified && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">CH Verified</p>
            <p className="text-sm text-green-600 mt-0.5">✅ Verified</p>
          </div>
        )}
      </div>
    </div>
  )
}
