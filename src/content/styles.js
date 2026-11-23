/**
 * Encapsulated Shadow DOM stylesheets for badges and the singleton popover.
 * Calm monochrome/graphite aesthetic that blends naturally into any page.
 * Shared via adoptedStyleSheets for zero per-instance CSS parsing overhead.
 */

export const BADGE_CSS = `
:host {
  all: initial;
  display: inline-flex;
  align-items: center;
  vertical-align: baseline;
  margin-inline-start: 0.28em;
  line-height: 1;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
  -webkit-font-smoothing: antialiased;
  color-scheme: light dark;
  pointer-events: auto !important;
  position: relative;
  z-index: 1;

  --cl-bg-light: rgba(17, 17, 19, 0.055);
  --cl-bg-dark: rgba(255, 255, 255, 0.075);
  --cl-bg-hover-light: rgba(17, 17, 19, 0.11);
  --cl-bg-hover-dark: rgba(255, 255, 255, 0.15);
  --cl-border-light: rgba(17, 17, 19, 0.1);
  --cl-border-dark: rgba(255, 255, 255, 0.11);
  --cl-border-hover-light: rgba(17, 17, 19, 0.22);
  --cl-border-hover-dark: rgba(255, 255, 255, 0.24);
  --cl-text-light: #3f3f46;
  --cl-text-dark: #d4d4d8;
  --cl-text-strong-light: #111113;
  --cl-text-strong-dark: #fafafa;
  --cl-muted-light: #71717a;
  --cl-muted-dark: #a1a1aa;
  --cl-inline-bg-light: rgba(17, 17, 19, 0.06);
  --cl-inline-bg-dark: rgba(255, 255, 255, 0.085);
  --cl-error-bg-light: rgba(217, 119, 6, 0.1);
  --cl-error-bg-dark: rgba(245, 158, 11, 0.14);
  --cl-error-text-light: #b45309;
  --cl-error-text-dark: #fbbf24;
  --cl-error-border-light: rgba(217, 119, 6, 0.28);
  --cl-error-border-dark: rgba(251, 191, 36, 0.3);

  --cl-bg: var(--cl-bg-light);
  --cl-bg-hover: var(--cl-bg-hover-light);
  --cl-border: var(--cl-border-light);
  --cl-border-hover: var(--cl-border-hover-light);
  --cl-text: var(--cl-text-light);
  --cl-text-strong: var(--cl-text-strong-light);
  --cl-muted: var(--cl-muted-light);
  --cl-inline-bg: var(--cl-inline-bg-light);
  --cl-error-bg: var(--cl-error-bg-light);
  --cl-error-text: var(--cl-error-text-light);
  --cl-error-border: var(--cl-error-border-light);
}

@media (prefers-color-scheme: dark) {
  :host(:not([data-theme="light"])) {
    --cl-bg: var(--cl-bg-dark);
    --cl-bg-hover: var(--cl-bg-hover-dark);
    --cl-border: var(--cl-border-dark);
    --cl-border-hover: var(--cl-border-hover-dark);
    --cl-text: var(--cl-text-dark);
    --cl-text-strong: var(--cl-text-strong-dark);
    --cl-muted: var(--cl-muted-dark);
    --cl-inline-bg: var(--cl-inline-bg-dark);
    --cl-error-bg: var(--cl-error-bg-dark);
    --cl-error-text: var(--cl-error-text-dark);
    --cl-error-border: var(--cl-error-border-dark);
  }
}

:host([data-theme="dark"]) {
  color-scheme: dark;
  --cl-bg: var(--cl-bg-dark);
  --cl-bg-hover: var(--cl-bg-hover-dark);
  --cl-border: var(--cl-border-dark);
  --cl-border-hover: var(--cl-border-hover-dark);
  --cl-text: var(--cl-text-dark);
  --cl-text-strong: var(--cl-text-strong-dark);
  --cl-muted: var(--cl-muted-dark);
  --cl-inline-bg: var(--cl-inline-bg-dark);
  --cl-error-bg: var(--cl-error-bg-dark);
  --cl-error-text: var(--cl-error-text-dark);
  --cl-error-border: var(--cl-error-border-dark);
}

:host([data-theme="light"]) {
  color-scheme: light;
}

@supports (color: light-dark(white, black)) {
  :host {
    --cl-bg: light-dark(var(--cl-bg-light), var(--cl-bg-dark));
    --cl-bg-hover: light-dark(var(--cl-bg-hover-light), var(--cl-bg-hover-dark));
    --cl-border: light-dark(var(--cl-border-light), var(--cl-border-dark));
    --cl-border-hover: light-dark(var(--cl-border-hover-light), var(--cl-border-hover-dark));
    --cl-text: light-dark(var(--cl-text-light), var(--cl-text-dark));
    --cl-text-strong: light-dark(var(--cl-text-strong-light), var(--cl-text-strong-dark));
    --cl-muted: light-dark(var(--cl-muted-light), var(--cl-muted-dark));
    --cl-inline-bg: light-dark(var(--cl-inline-bg-light), var(--cl-inline-bg-dark));
    --cl-error-bg: light-dark(var(--cl-error-bg-light), var(--cl-error-bg-dark));
    --cl-error-text: light-dark(var(--cl-error-text-light), var(--cl-error-text-dark));
    --cl-error-border: light-dark(var(--cl-error-border-light), var(--cl-error-border-dark));
  }
}

:host(:hover) {
  z-index: 2;
}

:host([data-inline-replace="true"]) {
  margin-inline-start: 0;
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  font-style: inherit;
  font-stretch: inherit;
  font-variant: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  word-spacing: inherit;
  color: inherit;
  text-transform: inherit;
  text-decoration: inherit;
  text-shadow: inherit;
  vertical-align: baseline;
}

.badge {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 0.24em;
  padding: 0.14em 0.42em;
  border-radius: 6px;
  border: 1px solid var(--cl-border);
  background: var(--cl-bg);
  color: var(--cl-text);
  font-family: inherit;
  font-size: max(11px, 0.72em);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
  letter-spacing: -0.01em;
  white-space: nowrap;
  user-select: none;
  vertical-align: middle;
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* Mode: hover */
.badge[data-mode="hover"] {
  cursor: default;
}

.badge[data-mode="hover"]:hover,
.badge[data-mode="hover"].is-hovered,
.badge[data-mode="hover"][aria-expanded="true"] {
  background: var(--cl-bg-hover);
  border-color: var(--cl-border-hover);
  color: var(--cl-text-strong);
}

/* Mode: click */
.badge[data-mode="click"] {
  cursor: pointer;
}

.badge[data-mode="click"]:hover,
.badge[data-mode="click"].is-hovered,
.badge[data-mode="click"][aria-expanded="true"] {
  background: var(--cl-bg-hover);
  border-color: var(--cl-border-hover);
  color: var(--cl-text-strong);
}

.badge[data-mode="click"]:active {
  transform: scale(0.96);
}

/* Mode: inline (beside) */
.badge[data-mode="inline"] {
  cursor: pointer;
  background: var(--cl-inline-bg);
  border-color: var(--cl-border);
  color: var(--cl-text-strong);
  font-weight: 500;
}

.badge[data-mode="inline"]:hover,
.badge[data-mode="inline"][aria-expanded="true"] {
  background: var(--cl-bg-hover);
  border-color: var(--cl-border-hover);
}

/* Mode: inline (replace — native typography with subtle dashed underline) */
.badge[data-inline-replace="true"] {
  display: inline;
  padding: 0 0.03em 0.04em;
  border: none;
  border-bottom: 1.5px dashed color-mix(in srgb, currentColor 42%, transparent);
  border-radius: 3px 3px 0 0;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  font-style: inherit;
  font-variant-numeric: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  text-decoration: inherit;
  text-shadow: inherit;
  vertical-align: baseline;
  user-select: text;
}

.badge[data-inline-replace="true"][data-strikethrough="true"] {
  text-decoration: line-through;
}

.badge[data-inline-replace="true"]:hover,
.badge[data-inline-replace="true"][aria-expanded="true"] {
  background: color-mix(in srgb, currentColor 11%, transparent);
  border-bottom-style: solid;
  border-bottom-color: color-mix(in srgb, currentColor 70%, transparent);
}

/* State: loading */
.badge[data-state="loading"] {
  opacity: 0.72;
  cursor: progress;
}

/* State: error */
.badge[data-state="error"] {
  background: var(--cl-error-bg);
  border-color: var(--cl-error-border);
  color: var(--cl-error-text);
  cursor: pointer;
}

.badge:focus-visible {
  outline: 1.5px solid var(--cl-text-strong);
  outline-offset: 2px;
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.95em;
  height: 0.95em;
  flex-shrink: 0;
  color: var(--cl-muted);
  transition: color 140ms ease;
}

.badge:hover .icon,
.badge.is-hovered .icon,
.badge[aria-expanded="true"] .icon {
  color: var(--cl-text-strong);
}

.badge[data-state="error"] .icon {
  color: var(--cl-error-text);
}

.spinner {
  width: 0.8em;
  height: 0.8em;
  border: 1.5px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: cl-spin 0.75s linear infinite;
}

.click-dot {
  width: 0.3em;
  height: 0.3em;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.4;
  transition: opacity 140ms ease, transform 140ms ease;
}

.badge[data-mode="click"]:hover .click-dot,
.badge[data-mode="click"][aria-expanded="true"] .click-dot {
  opacity: 0.85;
  transform: scale(1.15);
}

@keyframes cl-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .badge,
  .icon,
  .click-dot {
    transition: none;
  }
  .spinner {
    animation-duration: 1.5s;
  }
}
`;

export const POPOVER_CSS = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
  -webkit-font-smoothing: antialiased;
  color-scheme: light dark;

  --cl-surface-light: #ffffff;
  --cl-surface-dark: #161618;
  --cl-surface-2-light: #f6f6f7;
  --cl-surface-2-dark: #1d1d20;
  --cl-row-hover-light: rgba(0, 0, 0, 0.045);
  --cl-row-hover-dark: rgba(255, 255, 255, 0.055);
  --cl-row-primary-light: rgba(0, 0, 0, 0.06);
  --cl-row-primary-dark: rgba(255, 255, 255, 0.085);
  --cl-border-light: rgba(0, 0, 0, 0.09);
  --cl-border-dark: rgba(255, 255, 255, 0.09);
  --cl-text-light: #111113;
  --cl-text-dark: #f4f4f5;
  --cl-muted-light: #71717a;
  --cl-muted-dark: #8e8e93;
  --cl-pill-bg-light: #18181b;
  --cl-pill-bg-dark: #f4f4f5;
  --cl-pill-text-light: #ffffff;
  --cl-pill-text-dark: #111113;
  --cl-success-light: #16a34a;
  --cl-success-dark: #4ade80;
  --cl-shadow-light: 0 14px 36px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.06);
  --cl-shadow-dark: 0 18px 44px rgba(0, 0, 0, 0.65), 0 2px 8px rgba(0, 0, 0, 0.4);

  --cl-surface: var(--cl-surface-light);
  --cl-surface-2: var(--cl-surface-2-light);
  --cl-row-hover: var(--cl-row-hover-light);
  --cl-row-primary: var(--cl-row-primary-light);
  --cl-border: var(--cl-border-light);
  --cl-text: var(--cl-text-light);
  --cl-muted: var(--cl-muted-light);
  --cl-pill-bg: var(--cl-pill-bg-light);
  --cl-pill-text: var(--cl-pill-text-light);
  --cl-success: var(--cl-success-light);
  --cl-shadow: var(--cl-shadow-light);
}

@media (prefers-color-scheme: dark) {
  :host(:not([data-theme="light"])) {
    --cl-surface: var(--cl-surface-dark);
    --cl-surface-2: var(--cl-surface-2-dark);
    --cl-row-hover: var(--cl-row-hover-dark);
    --cl-row-primary: var(--cl-row-primary-dark);
    --cl-border: var(--cl-border-dark);
    --cl-text: var(--cl-text-dark);
    --cl-muted: var(--cl-muted-dark);
    --cl-pill-bg: var(--cl-pill-bg-dark);
    --cl-pill-text: var(--cl-pill-text-dark);
    --cl-success: var(--cl-success-dark);
    --cl-shadow: var(--cl-shadow-dark);
  }
}

:host([data-theme="dark"]) {
  color-scheme: dark;
  --cl-surface: var(--cl-surface-dark);
  --cl-surface-2: var(--cl-surface-2-dark);
  --cl-row-hover: var(--cl-row-hover-dark);
  --cl-row-primary: var(--cl-row-primary-dark);
  --cl-border: var(--cl-border-dark);
  --cl-text: var(--cl-text-dark);
  --cl-muted: var(--cl-muted-dark);
  --cl-pill-bg: var(--cl-pill-bg-dark);
  --cl-pill-text: var(--cl-pill-text-dark);
  --cl-success: var(--cl-success-dark);
  --cl-shadow: var(--cl-shadow-dark);
}

:host([data-theme="light"]) {
  color-scheme: light;
}

@supports (color: light-dark(white, black)) {
  :host {
    --cl-surface: light-dark(var(--cl-surface-light), var(--cl-surface-dark));
    --cl-surface-2: light-dark(var(--cl-surface-2-light), var(--cl-surface-2-dark));
    --cl-row-hover: light-dark(var(--cl-row-hover-light), var(--cl-row-hover-dark));
    --cl-row-primary: light-dark(var(--cl-row-primary-light), var(--cl-row-primary-dark));
    --cl-border: light-dark(var(--cl-border-light), var(--cl-border-dark));
    --cl-text: light-dark(var(--cl-text-light), var(--cl-text-dark));
    --cl-muted: light-dark(var(--cl-muted-light), var(--cl-muted-dark));
    --cl-pill-bg: light-dark(var(--cl-pill-bg-light), var(--cl-pill-bg-dark));
    --cl-pill-text: light-dark(var(--cl-pill-text-light), var(--cl-pill-text-dark));
    --cl-success: light-dark(var(--cl-success-light), var(--cl-success-dark));
  }
}

.card {
  position: fixed;
  margin: 0;
  padding: 0;
  inset: auto;
  min-width: 248px;
  max-width: 310px;
  border-radius: 16px;
  border: 1px solid var(--cl-border);
  background: var(--cl-surface);
  color: var(--cl-text);
  box-shadow: var(--cl-shadow);
  overflow: hidden;
  font-size: 13px;
  line-height: 1.4;
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}

.card:popover-open {
  opacity: 1;
  transform: translateY(0) scale(1);
}

@starting-style {
  .card:popover-open {
    opacity: 0;
    transform: translateY(-6px) scale(0.96);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .card {
    transition: opacity 160ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1), display 160ms, overlay 160ms;
    transition-behavior: allow-discrete;
  }
}

.card[data-compact="true"] {
  min-width: 248px;
  max-width: 340px;
}

.compact-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 12px;
  white-space: nowrap;
}

.compact-orig {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  color: var(--cl-muted);
}

.compact-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--cl-muted);
  opacity: 0.65;
  flex-shrink: 0;
}

.compact-target {
  appearance: none;
  border: none;
  background: var(--cl-row-primary);
  color: var(--cl-text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.015em;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 120ms ease, transform 100ms ease;
}

.compact-target:hover {
  background: var(--cl-row-hover);
}

.compact-target:active {
  transform: scale(0.98);
}

.compact-target .copy-icon {
  opacity: 0.55;
}

.compact-target:hover .copy-icon,
.compact-target:focus-visible .copy-icon,
.compact-target[data-copied="true"] .copy-icon {
  opacity: 1;
}

.compact-target[data-copied="true"] .copy-icon {
  color: var(--cl-success);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 13px;
  background: var(--cl-surface-2);
  border-bottom: 1px solid var(--cl-border);
}

.orig-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.orig-label {
  font-size: 10.5px;
  font-weight: 500;
  color: var(--cl-muted);
}

.orig-value {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.015em;
  color: var(--cl-text);
  display: flex;
  align-items: center;
  gap: 6px;
}

.close-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--cl-muted);
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  flex-shrink: 0;
  transition: background-color 120ms ease, color 120ms ease;
}

.close-btn:hover {
  background: var(--cl-row-hover);
  color: var(--cl-text);
}

.close-btn:focus-visible {
  outline: 1.5px solid var(--cl-text);
  outline-offset: 1px;
}

.rows {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--cl-border) transparent;
}

@supports not (scrollbar-color: auto) {
  .rows {
    scrollbar-width: auto;
  }
  .rows::-webkit-scrollbar {
    width: 6px;
  }
  .rows::-webkit-scrollbar-thumb {
    background: var(--cl-border);
    border-radius: 999px;
  }
}

.row {
  appearance: none;
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: background-color 130ms ease, transform 100ms ease;
}

.row:hover {
  background: var(--cl-row-hover);
}

.row:active {
  transform: scale(0.99);
}

.row[data-primary="true"] {
  background: var(--cl-row-primary);
}

.row:focus-visible {
  outline: 1.5px solid var(--cl-text);
  outline-offset: -2px;
}

.row-left {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.flag {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.code-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.code {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--cl-text);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.star {
  display: inline-flex;
  align-items: center;
  color: var(--cl-muted);
}

.name {
  font-size: 11px;
  color: var(--cl-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 108px;
}

.row-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.amount {
  font-size: 13.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  color: var(--cl-text);
}

.copy-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--cl-muted);
  opacity: 0;
  transition: opacity 120ms ease, color 120ms ease;
}

.row:hover .copy-icon,
.row:focus-visible .copy-icon,
.row[data-copied="true"] .copy-icon {
  opacity: 1;
}

.row[data-copied="true"] .copy-icon {
  color: var(--cl-success);
}

.status-box {
  padding: 18px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  color: var(--cl-muted);
  font-size: 12.5px;
}

.retry-btn {
  appearance: none;
  border: none;
  background: var(--cl-pill-bg);
  color: var(--cl-pill-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 999px;
  cursor: pointer;
}

.retry-btn:hover {
  opacity: 0.88;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 13px;
  background: var(--cl-surface-2);
  border-top: 1px solid var(--cl-border);
  font-size: 11px;
  color: var(--cl-muted);
  font-variant-numeric: tabular-nums;
}
`;
