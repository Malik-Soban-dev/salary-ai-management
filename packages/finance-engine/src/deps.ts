/**
 * Shared re-exports so each engine module has one import site.
 * (Keeps individual engine files focused on their calculation.)
 */
export * from "@salary-ai/domain";
import { createHash } from "node:crypto";
export { createHash };
