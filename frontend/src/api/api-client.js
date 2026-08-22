import { API_BASE, request, setUnauthorizedHandler } from './core.js';
import * as auth from './auth.js';
import * as crm from './crm.js';
import * as jobs from './jobs.js';
import * as finance from './finance.js';
import * as inventory from './inventory.js';
import * as materials from './materials.js';
import * as superadmin from './superadmin.js';
import { loadWorkspace, useWorkspace } from './workspace.js';

setUnauthorizedHandler(auth.logout);

window.MolarisAPI = {
  // Domain namespaces — new structured API
  crm,
  jobs,
  finance,
  inventory,
  materials,
  superadmin,

  // Flat backward-compatible API — all pages still use these directly
  API_BASE,
  request,
  login: auth.login,
  logout: auth.logout,
  savedUser: auth.savedUser,
  isAuthenticated: auth.isAuthenticated,
  authUrl: auth.authUrl,
  isTotpRequiredError: auth.isTotpRequiredError,
  isTotpInvalidError: auth.isTotpInvalidError,
  fetchMe: auth.fetchMe,
  updateMe: auth.updateMe,
  updateLab: auth.updateLab,
  fetchLabMembers: auth.fetchLabMembers,
  fetchPermissionsMatrix: auth.fetchPermissionsMatrix,
  fetchLabRolePermissions: auth.fetchLabRolePermissions,
  saveLabRolePermission: auth.saveLabRolePermission,
  fetchNotifications: auth.fetchNotifications,
  fetchUnreadCount: auth.fetchUnreadCount,
  markNotificationRead: auth.markNotificationRead,
  markAllNotificationsRead: auth.markAllNotificationsRead,
  searchGlobal: auth.searchGlobal,
  fetchTwoFactorStatus: auth.fetchTwoFactorStatus,
  setupTwoFactor: auth.setupTwoFactor,
  verifyTwoFactor: auth.verifyTwoFactor,
  disableTwoFactor: auth.disableTwoFactor,
  fetchSessions: auth.fetchSessions,
  revokeSession: auth.revokeSession,
  revokeAllSessions: auth.revokeAllSessions,
  createJob: jobs.createJob,
  fetchJobs: jobs.fetchJobs,
  updateJob: jobs.updateJob,
  deleteJob: jobs.deleteJob,
  downloadJobsExport: jobs.downloadJobsExport,
  downloadWarehouseExport: inventory.downloadWarehouseExport,
  fetchPatientDetail: crm.fetchPatientDetail,
  fetchInsurers: crm.fetchInsurers,
  fetchPatientToothMap: crm.fetchPatientToothMap,
  createRecord: crm.createRecord,
  transitionJobStatus: jobs.transitionJobStatus,
  updateInvoiceStatus: finance.updateInvoiceStatus,
  deleteInvoice: finance.deleteInvoice,
  fetchInvoiceDetail: finance.fetchInvoiceDetail,
  sendInvoiceEmail: finance.sendInvoiceEmail,
  downloadInvoicePdf: finance.downloadInvoicePdf,
  downloadInvoicesExport: finance.downloadInvoicesExport,
  fetchCurrentLab: auth.fetchCurrentLab,
  fetchSuperadminMetrics: superadmin.fetchSuperadminMetrics,
  fetchAllLabs: superadmin.fetchAllLabs,
  fetchAllUsers: superadmin.fetchAllUsers,
  fetchSubscriptions: superadmin.fetchSubscriptions,
  fetchSystemHealth: superadmin.fetchSystemHealth,
  fetchAuditLogs: superadmin.fetchAuditLogs,
  loadWorkspace,
  useWorkspace,
};
