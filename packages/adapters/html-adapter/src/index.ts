/**
 * @tnfronte/html-adapter
 *
 * Framework adapter for vanilla HTML / CSS / JS projects.
 *
 * OID Injection:
 *   Uses parse5 to walk HTML documents and inject data-oid attributes.
 *
 * Code Modification:
 *   Locates the target HTML element by OID or source location and applies
 *   attribute, style, text, insert, and delete mutations directly.
 */

export { HtmlAdapter } from './html-adapter';
export { injectOID } from './inject-oid';
export { applyAction } from './apply-action';
export { extractProps } from './extract-props';
