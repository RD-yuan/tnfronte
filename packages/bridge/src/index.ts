/**
 * @tnfronte/bridge
 *
 * Communication bridge script injected into the user project's iframe.
 * Captures user interactions (click, drag, hover) and relays them to
 * the editor UI via postMessage.
 *
 * This package is compiled to a standalone JS bundle and injected via
 * the Vite / Webpack plugin at dev-server time.
 */

export { Bridge } from './bridge';
