/**
 * @tnfronte/vue-adapter
 *
 * Framework adapter for Vue 3 (SFC — Single File Components).
 *
 * OID Injection:
 *   Uses @vue/compiler-sfc to extract the <template> block, then
 *   parse5 to walk the template DOM and inject data-oid attributes.
 *
 * Code Modification:
 *   Locates the target element by OID, applies the CodeAction
 *   (style / prop / text changes), and serialises back to SFC.
 */
