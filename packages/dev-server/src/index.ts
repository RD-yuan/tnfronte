/**
 * @tnfronte/dev-server
 *
 * Vite plugin that integrates TNFronte into any Vite-powered user project:
 *
 *  1. transform hook   — injects data-oid via the React/Vue/HTML adapter
 *  2. transformIndexHtml — injects the Bridge script + editing-mode flag
 *  3. configureServer   — serves the Bridge bundle + OID Index API
 */

export { tnfronteVitePlugin } from './vite-plugin';
