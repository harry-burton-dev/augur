/**
 * Common: what both of AUGUR's kits stand on. Aerie (`@augur/shell-kit`) is the
 * shell's own kit and Quill (`@augur/app-kit`) is the kit apps build with; both
 * read these tokens and use these controls (ADR 0015). Behaviour and
 * accessibility come from React Aria Components; the look comes from
 * `@augur/kit-common/kit.css`, which the shell loads once for the page.
 */
export { tokens, token, type TokenName } from './generated/tokens.js';
export { ms } from './timing.js';
export { cx } from './cx.js';
export { Icon, icons, iconNames, type IconName, type IconProps } from './icon.js';
export { Button, type ButtonKind, type ButtonProps } from './button.js';
export { IconButton, type IconButtonProps } from './icon-button.js';
export { useReason, kitDev } from './reason.js';
