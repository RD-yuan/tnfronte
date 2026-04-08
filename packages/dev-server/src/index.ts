/**
 * @tnfronte/dev-server
 *
 * Vite plugin (and future Webpack plugin) that integrates TNFronte
 * into the user's dev-server lifecycle:
 *
 *  1. transform hook — injects data-oid attributes into JSX / SFC / HTML
 *  2. transformIndexHtml hook — injects the Bridge script
 *  3. configureServer hook — serves the Bridge bundle + OID index API
 *  4. HMR integration — notifies Editor Backend on file changes
 */
