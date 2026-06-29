export type Role =
  | 'practice_owner'
  | 'practice_manager'
  | 'client_manager'
  | 'bookkeeper'
  | 'admin_staff'
  | 'payroll_manager'

export const permissions = {
  // Client management
  canViewAllClients: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  canAddClient: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  canEditClientDetails: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff', 'payroll_manager'].includes(role),

  canDeleteClient: (role: Role) =>
    ['practice_owner', 'practice_manager'].includes(role),

  // Tax info
  canViewTaxInfo: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'bookkeeper', 'admin_staff', 'payroll_manager'].includes(role),

  canEditTaxInfo: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  canEditPayrollInfo: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff', 'payroll_manager'].includes(role),

  canEditCIS: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff', 'payroll_manager'].includes(role),

  // Engagements
  canManageEngagements: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager'].includes(role),

  // Documents
  canUploadDocuments: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'bookkeeper', 'admin_staff', 'payroll_manager'].includes(role),

  canShareDocuments: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  // Tasks
  canCreateTasks: (role: Role) => true,

  canAssignTasks: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager'].includes(role),

  // Notes
  canAddNotes: (role: Role) => true,

  // Deadlines
  canGenerateDeadlines: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  // Portal
  canInviteToPortal: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  // Billing
  canBill: (role: Role, canBillFlag: boolean) =>
    ['practice_owner', 'practice_manager'].includes(role) || canBillFlag,

  // Team management
  canManageTeam: (role: Role) =>
    ['practice_owner', 'practice_manager'].includes(role),

  canManageSettings: (role: Role) =>
    ['practice_owner', 'practice_manager'].includes(role),

  // Companies House
  canRefreshFromCH: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager', 'admin_staff'].includes(role),

  // Pipeline
  canManagePipeline: (role: Role) =>
    ['practice_owner', 'practice_manager', 'client_manager'].includes(role),
}
