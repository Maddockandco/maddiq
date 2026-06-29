'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Role, permissions } from '@/lib/permissions'

export function useRole() {
  const [role, setRole] = useState<Role | null>(null)
  const [canBillFlag, setCanBillFlag] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('role, can_bill')
        .eq('user_id', user.id)
        .single()

      if (firmUser) {
        setRole(firmUser.role as Role)
        setCanBillFlag(firmUser.can_bill || false)
      }
      setLoading(false)
    }
    fetchRole()
  }, [])

  const isPayrollOnly = role === 'payroll_manager'

  return {
    role,
    loading,
    isPayrollOnly,
    can: {
      viewAllClients: role ? permissions.canViewAllClients(role) : false,
      addClient: role ? permissions.canAddClient(role) : false,
      editClientDetails: role ? permissions.canEditClientDetails(role) : false,
      deleteClient: role ? permissions.canDeleteClient(role) : false,
      viewTaxInfo: role ? permissions.canViewTaxInfo(role) : false,
      editTaxInfo: role ? permissions.canEditTaxInfo(role) : false,
      editPayrollInfo: role ? permissions.canEditPayrollInfo(role) : false,
      editCIS: role ? permissions.canEditCIS(role) : false,
      manageEngagements: role ? permissions.canManageEngagements(role) : false,
      uploadDocuments: role ? permissions.canUploadDocuments(role) : false,
      shareDocuments: role ? permissions.canShareDocuments(role) : false,
      createTasks: role ? permissions.canCreateTasks(role) : false,
      assignTasks: role ? permissions.canAssignTasks(role) : false,
      addNotes: role ? permissions.canAddNotes(role) : false,
      generateDeadlines: role ? permissions.canGenerateDeadlines(role) : false,
      inviteToPortal: role ? permissions.canInviteToPortal(role) : false,
      bill: role ? permissions.canBill(role, canBillFlag) : false,
      manageTeam: role ? permissions.canManageTeam(role) : false,
      manageSettings: role ? permissions.canManageSettings(role) : false,
      refreshFromCH: role ? permissions.canRefreshFromCH(role) : false,
      managePipeline: role ? permissions.canManagePipeline(role) : false,
      addDirectors: role ? permissions.canAddDirectors(role) : false,
    }
  }
}
