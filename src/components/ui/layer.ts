'use client';
import { createContext, useContext } from 'react';

/**
 * True inside a dialog. Popovers and selects opened from a dialog must sit above it (and its
 * backdrop), so they take the layer just above `--z-dialog` instead of `--z-dropdown`.
 */
export const InDialogContext = createContext(false);

export function useDropdownLayer(): string {
  return useContext(InDialogContext) ? 'z-[calc(var(--z-dialog)+1)]' : 'z-[var(--z-dropdown)]';
}
