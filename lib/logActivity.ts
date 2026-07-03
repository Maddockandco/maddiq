import { createClient } from '@/lib/supabase/client'

type LogActivityParams = {
  firmId: string
  clientId?: string | null
  firmUserId?: string | null
  actionType: string
  title: string
  subtitle?: string
  href?: string
  icon?: string
}

export async function logActivity({
  firmId,
  clientId = null,
  firmUserId = null,
  actionType,
  title,
  subtitle,
  href,
  icon,
}: LogActivityParams) {
  const supabase = createClient()

  const { error } = await supabase.from('activity_log').insert({
    firm_id: firmId,
    client_id: clientId,
    firm_user_id: firmUserId,
    action_type: actionType,
    title,
    subtitle: subtitle || null,
    href: href || null,
    icon: icon || null,
  })

  if (error) {
    console.error('Failed to log activity:', error.message)
  }
}
