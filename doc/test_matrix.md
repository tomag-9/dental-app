# Endpoint Test Matrix

Updated: 2026-05-28

This checklist is the required coverage standard for API endpoints. Each new
endpoint should either add tests for the relevant scenarios or document why a
scenario does not apply.

## Scenario Legend

- `401`: unauthenticated request is rejected.
- `no_lab`: authenticated tenant user without a lab is handled explicitly.
- `user`: regular lab user access.
- `technician`: technician role access.
- `admin`: lab admin access.
- `superadmin`: platform admin access across labs.
- `cross_lab`: tenant cannot read/write another lab's data.
- `invalid`: invalid payload and validation errors.
- `duplicate`: duplicate/idempotent request behavior.
- `empty`: empty list/state response.
- `filter`: search/filter/pagination/limit behavior.
- `side_effect`: create/update/delete domain side effects.
- `audit`: audit log or notification side effects.
- `alias`: root-level and app-scoped aliases have the same scoping and
  serializer contract.

## Current Priority Matrix

| Area | Endpoint family | Existing focused tests | Required scenarios | Priority |
|---|---|---|---|---|
| Core | `/api/users/`, `/api/core/users/` | `CoreUserFlowsApiTests`, `AliasAuthenticationTests` | 401, no_lab, user, technician, admin, superadmin, cross_lab, invalid, side_effect, audit, alias | High |
| Core | `/api/labs/`, `/api/core/labs/` | `LabSettingsValidationTests`, `SchemaDocsPolicyTests` | 401, no_lab, admin, superadmin, cross_lab, invalid, audit, alias | High |
| Core | `/api/core/labs/{id}/permissions/` | `LabRolePermissionTests` | 401, user, technician, admin, superadmin, cross_lab, invalid, duplicate, audit | High |
| Core | `/api/core/audit-logs/`, `/api/audit-logs/` | `AuditLogContractTests` | 401, admin, superadmin, cross_lab, filter, empty, alias | High |
| Core | `/api/core/api-keys/` | `LabApiKeyTests` | 401, user, admin, cross_lab, create/revoke side_effect, audit | High |
| Core | `/api/core/2fa/` | `TwoFactorTests` | 401, user, invalid, enable/disable side_effect, audit | High |
| CRM | `/api/crm/patients/` | `PatientCrudApiTests`, `CrmAdminOnlyWriteTests` | 401, user, technician, admin, superadmin, cross_lab, invalid, filter, empty, side_effect | High |
| CRM | `/api/crm/clinics/` | `ClinicCrudApiTests`, `CrmAdminOnlyWriteTests` | 401, user, technician, admin, superadmin, cross_lab, invalid, filter, empty, side_effect | High |
| CRM | `/api/crm/doctors/` | `DoctorCrudApiTests`, `CrmAdminOnlyWriteTests` | 401, user, technician, admin, superadmin, cross_lab, invalid, filter, empty, side_effect | High |
| Jobs | `/api/jobs/jobs/` | `JobValidationApiTests`, `JobBulkUpdateTests`, `JobStatusChangeAuditLogTests` | 401, user, technician, admin, superadmin, cross_lab, invalid, filter, empty, side_effect, audit | High |
| Jobs | `/api/jobs/jobs/{id}/attachments/` | `JobAttachmentTests` | 401, user, technician, admin, cross_lab, invalid, side_effect | High |
| Jobs | `/api/jobs/technicians/` | `TechnicianApiTests` | 401, user, technician, admin, superadmin, cross_lab, invalid, empty, side_effect | Medium |
| Jobs | `/api/jobs/vacations/`, `/api/vacations/` | `VacationApiTests`, `AliasAuthenticationTests` | 401, user, technician, admin, superadmin, cross_lab, invalid, empty, alias | Medium |
| Jobs | `/api/jobs/calendar-events/`, `/api/calendar-events/` | `CalendarApiTests`, `AliasAuthenticationTests` | 401, user, technician, admin, superadmin, cross_lab, invalid, empty, alias | Medium |
| Finance | `/api/finance/invoices/`, `/api/invoices/` | `InvoiceLifecycleApiTests`, `InvoiceSendEmailTests`, `AliasAuthenticationTests` | 401, user, technician, admin, superadmin, cross_lab, invalid, filter, empty, side_effect, audit, alias | High |
| Finance | `/api/finance/price-list/` | `PriceListCrudApiTests`, `PriceListExportCsvTests` | 401, user, technician, admin, superadmin, cross_lab, invalid, duplicate, empty, side_effect | Medium |
| Finance | `/api/finance/subscriptions/` | `SubscriptionApiTests` | 401, no_lab, admin, superadmin, cross_lab, invalid, empty | Medium |
| Inventory | `/api/inventory/warehouse/`, `/api/warehouse/` | `WarehouseItemCrudApiTests`, `WarehouseBulkImportTests`, `AliasAuthenticationTests` | 401, user, technician, admin, superadmin, cross_lab, invalid, filter, empty, import/export, side_effect, alias | High |

## Helper Standard

Use `apps.core.test_helpers.RoleMatrixTestMixin` for new role-matrix tests. It
creates two labs plus `superadmin`, `admin`, `user`, `technician`, `admin_b`,
and `no_lab` users, and provides `assert_endpoint_matrix()` plus `response_ids()`.

## Alias Standard

For aliased endpoint families, tests must assert more than authentication:

- root and app-scoped list endpoints return the same scoped IDs for a lab admin;
- detail aliases return the same object ID;
- serializer field keys match between aliases;
- cross-lab records do not appear in either alias.
