/**
 * @tnfronte/svelte-adapter
 *
 * Framework adapter for Svelte components.
 *
 * OID Injection:
 *   Uses svelte/compiler (parse + walk) to traverse the HTML AST
 *   inside a .svelte file and inject data-oid attributes.
 *
 * Code Modification:
 *   Locates the target element and applies the requested CodeAction.
 */
