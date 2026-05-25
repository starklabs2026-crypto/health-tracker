// Design tokens (playbook §3.5). Full design-system pass lands in Phase 3;
// this is the subset the auth/profile screens need now.
export const colors = {
  primary: '#1F4E79',
  surface: '#FFFFFF',
  background: '#F7F9FC',
  textPrimary: '#1A1A1A',
  textSecondary: '#5C6B7A',
  border: '#E4E8EE',
  rangeNormal: '#0F9D58',
  rangeLow: '#4285F4',
  rangeHigh: '#F4B400',
  rangeCritical: '#DB4437',
  danger: '#DB4437',
} as const;

export const radius = { card: 12, input: 10 } as const;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const tapTarget = 44;
