export const navbarButtonStyles = {
  navItemBase:
    'inline-flex items-center rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]',
  navItemDesktop: 'gap-2 px-3 py-1.5',
  navItemMobile: 'gap-3 px-3 py-2.5',
  navItemActive: 'text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)]',
  navItemInactive:
    'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]',
  iconButtonBase:
    'inline-flex items-center justify-center p-2 rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]',
  iconButtonDefault:
    'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]',
  iconButtonActive: 'text-[var(--color-accent-primary)] bg-[var(--color-bg-secondary)]',
  iconButtonDisabled: 'text-[var(--color-text-disabled)] cursor-not-allowed opacity-50',
  statusButton:
    'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-bg-secondary)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] hover:bg-[var(--color-bg-tertiary)]',
} as const;
