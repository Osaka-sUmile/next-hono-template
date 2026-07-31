import config from "./eslint.config.js"
import { createTypeAwareConfig } from "@workspace/eslint-config/type-aware"

/** @type {import("eslint").Linter.Config[]} */
export default [...config, ...createTypeAwareConfig(import.meta.dirname)]
