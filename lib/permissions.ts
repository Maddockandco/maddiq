export type Role =
  | 'practice_owner'
  | 'practice_manager'
  | 'client_manager'
  | 'bookkeeper'
  | 'admin_staff'
  | 'payroll_manager'

export const permissions = {
  canViewAllClients: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  canAddClient: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  canEditClientDetails: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff', 'payroll_manager'].includes(role),

  canDeleteClient: (role: Role) =>
    ['practice_owner', 'practice_manager'].includes(role),

  canViewTaxInfo: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'bookkeeper', 'admin_staff', 'payroll_manager'].includes(role),

  canEditTaxInfo: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  canEditPayrollInfo: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff', 'payroll_manager'].includes(role),

  canEditCIS: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff', 'payroll_manager'].includes(role),

  canManageEngagements: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager'].includes(role),

  canUploadDocuments: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'bookkeeper', 'admin_staff', 'payroll_manager'].includes(role),

  canShareDocuments: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  canCreateTasks: (role: Role) => true,

  canAssignTasks: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager'].includes(role),

  canAddNotes: (role: Role) => true,

  canGenerateDeadlines: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  canInviteToPortal: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  canBill: (role: Role, canBillFlag: boolean) =>
    ['practice_owner', 'practice_manager'].includes(role) || canBillFlag,

  canManageTeam: (role: Role) =>
    ['practice_owner', 'practice_manager'].includes(role),

  canManageSettings: (role: Role) =>
    ['practice_owner', 'practice_manager'].includes(role),

  canRefreshFromCH: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  canManagePipeline: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager'].includes(role),

  canAddDirectors: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  // Payroll deadline types
  payrollDeadlineTypes: ['vat_return', 'payroll', 'paye', 'cis'],
}
