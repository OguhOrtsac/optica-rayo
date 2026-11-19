/**
 * Canonical role model for Óptica Rayo.
 *
 * The business roles are intentionally small and explicit. `dev` is kept
 * only as a legacy alias for `super_admin` while old records are migrated;
 * new code and new accounts must use the canonical values below.
 */

export const USER_ROLES = [
  'super_admin',
  'owner',
  'optometrist',
  'seller',
  'customer',
] as const

export type UserRole = (typeof USER_ROLES)[number]
export type AccessRole = UserRole | 'guest'

export type AppSection =
  | 'accounts'
  | 'business_settings'
  | 'finance'
  | 'catalog_management'
  | 'pos'
  | 'payments'
  | 'customers'
  | 'clinical'
  | 'reminders'
  | 'own_account'
  | 'public_catalog'

export interface RoleDefinition {
  label: string
  shortLabel: string
  description: string
  dashboardHref: string
  sections: readonly AppSection[]
}

const STAFF_CLINICAL: readonly AppSection[] = [
  'customers',
  'clinical',
  'reminders',
  'own_account',
  'public_catalog',
]

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  super_admin: {
    label: 'Super Administrador',
    shortLabel: 'Super Admin',
    description:
      'Equipo desarrollador. Mantiene la plataforma, crea cuentas privilegiadas y apoya al negocio; no opera la óptica en el día a día.',
    dashboardHref: '/dashboard/admin',
    sections: [
      'accounts',
      'business_settings',
      'finance',
      'catalog_management',
      'pos',
      'payments',
      'customers',
      'clinical',
      'reminders',
      'own_account',
      'public_catalog',
    ],
  },
  owner: {
    label: 'Administrador / Dueño',
    shortLabel: 'Administrador',
    description:
      'Responsable del negocio. Administra personal operativo, catálogo, precios, finanzas, clientes y recordatorios.',
    dashboardHref: '/dashboard/admin',
    sections: [
      'accounts',
      'business_settings',
      'finance',
      'catalog_management',
      'pos',
      'payments',
      'customers',
      'clinical',
      'reminders',
      'own_account',
      'public_catalog',
    ],
  },
  optometrist: {
    label: 'Optometrista',
    shortLabel: 'Optometrista',
    description:
      'Personal clínico. Consulta expedientes completos, registra exámenes y graduaciones, atiende la Agenda y da seguimiento a revisiones. Sin dinero: no vende, no cobra y no ve finanzas.',
    dashboardHref: '/customers',
    sections: STAFF_CLINICAL,
  },
  seller: {
    label: 'Vendedor POS / Cajero',
    shortLabel: 'Vendedor',
    description:
      'Personal de mostrador y apoyo del administrador. Registra ventas y abonos, da de alta clientes y productos, ajusta precios y ve y agenda citas; no entra a finanzas, gastos, reportes ni cuentas.',
    dashboardHref: '/dashboard/seller',
    sections: [
      'pos',
      'payments',
      'customers',
      'catalog_management',
      'reminders',
      'own_account',
      'public_catalog',
    ],
  },
  customer: {
    label: 'Cliente / Paciente',
    shortLabel: 'Cliente',
    description:
      'Persona registrada. Ve únicamente su cuenta, compras, recetas, promociones y precios de cliente.',
    dashboardHref: '/dashboard/customer',
    sections: ['own_account', 'public_catalog'],
  },
}

export const GUEST_ROLE_DEFINITION = {
  label: 'Invitado',
  shortLabel: 'Invitado',
  description:
    'Visitante sin sesión. Solo puede explorar el catálogo público y consultar por WhatsApp; no ve precios de cliente ni datos internos.',
  dashboardHref: '/catalog',
  sections: ['public_catalog'] as readonly AppSection[],
}

/** Converts legacy or unknown values into the canonical model. */
export function normalizeRole(role?: string | null): AccessRole {
  if (!role) return 'guest'
  if (role === 'dev') return 'super_admin'
  return (USER_ROLES as readonly string[]).includes(role)
    ? (role as UserRole)
    : 'guest'
}

export function roleLabel(role?: string | null): string {
  const normalized = normalizeRole(role)
  return normalized === 'guest'
    ? GUEST_ROLE_DEFINITION.label
    : ROLE_DEFINITIONS[normalized].label
}

export function roleDescription(role?: string | null): string {
  const normalized = normalizeRole(role)
  return normalized === 'guest'
    ? GUEST_ROLE_DEFINITION.description
    : ROLE_DEFINITIONS[normalized].description
}

export function dashboardHrefForRole(role?: string | null): string {
  const normalized = normalizeRole(role)
  return normalized === 'guest'
    ? GUEST_ROLE_DEFINITION.dashboardHref
    : ROLE_DEFINITIONS[normalized].dashboardHref
}

export function canAccess(role: string | null | undefined, section: AppSection): boolean {
  const normalized = normalizeRole(role)
  const sections =
    normalized === 'guest'
      ? GUEST_ROLE_DEFINITION.sections
      : ROLE_DEFINITIONS[normalized].sections
  return sections.includes(section)
}

export function isStaffRole(role?: string | null): boolean {
  return ['super_admin', 'owner', 'optometrist', 'seller'].includes(normalizeRole(role))
}

export function isAdminRole(role?: string | null): boolean {
  return ['super_admin', 'owner'].includes(normalizeRole(role))
}
