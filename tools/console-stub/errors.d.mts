import type { ConsoleError } from "../../generated/console-contract/v1/types"

export type PublicErrorCode = ConsoleError["error"]["code"]

/** code -> [http status, retryable]. */
export declare const ERRORS: Readonly<Record<string, readonly [number, boolean]>>

export declare const MESSAGES: Readonly<Record<string, string>>
