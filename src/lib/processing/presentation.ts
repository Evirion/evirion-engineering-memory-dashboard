import type { ProcessingPage } from "@contracts/console"

import {
  costCompletenessLabel,
  costViewFromBlock,
  type CostView,
} from "@/lib/settings/cost"

/**
 * How one processing row reads on screen.
 *
 * Nothing here decides anything. Status, authorization, cost completeness and
 * every label arrive from the backend projection and are only rendered. In
 * particular retryability is never derived: the processing surface is read-only
 * and no recovery action exists on a live extraction job.
 */

export type ProcessingRow = ProcessingPage["items"][number]
export type ProcessingState = ProcessingRow["processingState"]
export type PaidAuthorizationStatus = ProcessingRow["paidAuthorizationStatus"]
export type JobStatus = ProcessingRow["jobStatus"]
export type SourceStatus = ProcessingRow["sourceStatus"]
export type AdmissionDisposition = ProcessingRow["admissionDisposition"]

export type AuthorizationView = {
  readonly label: string
  readonly detail: string
  readonly waitingOn: "customer" | "evirion" | "nobody"
}

/**
 * The states where the backend moves the job on its own.
 *
 * Waits on a person or on Evirion operational authorization are excluded, so
 * polling does not discard work the customer is reading.
 */
export const isProgressing = (state: ProcessingState): boolean =>
  state === "COLLECTING_SOURCE" || state === "EXTRACTING"

export const isInfrastructureFailure = (state: ProcessingState): boolean =>
  state === "FAILED" || state === "SOURCE_FAILED"

export const isAdmissionRejected = (
  disposition: AdmissionDisposition,
  state: ProcessingState,
): boolean => disposition === "REJECTED" || state === "REJECTED"

export const isAdmissionQuarantined = (
  disposition: AdmissionDisposition,
  state: ProcessingState,
): boolean => disposition === "QUARANTINED" || state === "QUARANTINED"

export const processingStateLabel = (state: ProcessingState): string => {
  switch (state) {
    case "ACCEPTED":
      return "Accepted"
    case "REJECTED":
      return "Rejected by admission"
    case "QUARANTINED":
      return "Quarantined"
    case "FAILED":
      return "Infrastructure failure"
    case "SOURCE_FAILED":
      return "Source collection failed"
    case "COLLECTING_SOURCE":
      return "Collecting source"
    case "AWAITING_APPROVAL":
      return "Awaiting approval"
    case "NOT_AUTHORIZED":
      return "Not authorized"
    case "AWAITING_EVIRION_AUTHORIZATION":
      return "Waiting for Evirion authorization"
    case "AWAITING_CUSTOMER_CONSENT":
      return "Waiting for your approval"
    case "EXTRACTING":
      return "Extracting Engineering Memory"
    case "UNSUPPORTED_SERVER_RESPONSE":
      return "Unsupported state"
    default: {
      const exhaustive: never = state
      throw new Error(`unhandled processing state: ${String(exhaustive)}`)
    }
  }
}

export const paidAuthorizationView = (
  status: PaidAuthorizationStatus,
): AuthorizationView => {
  switch (status) {
    case "NOT_REQUIRED":
      return {
        label: "No paid extraction required",
        detail: "This job needs no model call authorization.",
        waitingOn: "nobody",
      }
    case "AWAITING_CUSTOMER_CONSENT":
      return {
        label: "Waiting for your approval",
        detail:
          "Customer consent has not been recorded yet. The processing surface is read-only and offers no approval control here.",
        waitingOn: "customer",
      }
    case "AWAITING_OPERATIONAL_AUTHORIZATION":
      return {
        label: "Waiting for Evirion authorization",
        detail:
          "Your approval may be recorded. Evirion operational authorization is a separate gate that only Evirion can grant.",
        waitingOn: "evirion",
      }
    case "AUTHORIZED":
      return {
        label: "Authorized",
        detail:
          "Customer consent and Evirion operational authorization are both in place.",
        waitingOn: "nobody",
      }
    case "EXPIRED":
      return {
        label: "Authorization expired",
        detail: "Operational authorization expired before this job completed.",
        waitingOn: "evirion",
      }
    case "REVOKED":
      return {
        label: "Authorization revoked",
        detail: "Operational authorization was revoked before this job completed.",
        waitingOn: "evirion",
      }
    case "UNSUPPORTED_SERVER_RESPONSE":
      return {
        label: "Unsupported authorization state",
        detail: "The paid authorization state could not be recognized.",
        waitingOn: "nobody",
      }
    default: {
      const exhaustive: never = status
      throw new Error(`unhandled paid authorization status: ${String(exhaustive)}`)
    }
  }
}

export const jobStatusLabel = (status: JobStatus): string => {
  switch (status) {
    case "PENDING":
      return "Queued"
    case "CLAIMED":
      return "Running"
    case "RETRY_WAIT":
      return "Waiting to retry internally"
    case "COMPLETED":
      return "Completed"
    case "DEAD_LETTER":
      return "Dead letter"
    case "UNSUPPORTED_SERVER_RESPONSE":
      return "Unsupported"
    default: {
      const exhaustive: never = status
      throw new Error(`unhandled job status: ${String(exhaustive)}`)
    }
  }
}

export const sourceStatusLabel = (status: SourceStatus): string => {
  switch (status) {
    case "PENDING":
      return "Source queued"
    case "CLAIMED":
      return "Source running"
    case "RETRY_WAIT":
      return "Source waiting to retry internally"
    case "READY":
      return "Source ready"
    case "DEAD_LETTER":
      return "Source dead letter"
    case "UNSUPPORTED_SERVER_RESPONSE":
      return "Unsupported"
    default: {
      const exhaustive: never = status
      throw new Error(`unhandled source status: ${String(exhaustive)}`)
    }
  }
}

export type RowView = {
  readonly processingLabel: string
  readonly authorization: AuthorizationView
  readonly jobLabel: string
  readonly sourceLabel: string
  readonly admissionLabel: string
  readonly cost: CostView | null
  readonly costCompleteness: string | null
  readonly latency: string | null
  readonly isProgressing: boolean
  readonly isInfrastructureFailure: boolean
  readonly isRejected: boolean
  readonly isQuarantined: boolean
  readonly supportCopy: string
}

export const STATIC_PROCESSING_SUPPORT_COPY =
  "If this outcome looks wrong, contact Evirion support with the reference below. Evirion operates the pipeline; customer retry is not available on live extraction."

export const rowView = (row: ProcessingRow): RowView => ({
  processingLabel: processingStateLabel(row.processingState),
  authorization: paidAuthorizationView(row.paidAuthorizationStatus),
  jobLabel: jobStatusLabel(row.jobStatus),
  sourceLabel: sourceStatusLabel(row.sourceStatus),
  admissionLabel:
    row.admissionDisposition === null
      ? "No terminal admission yet"
      : row.admissionDisposition === "ACCEPTED"
        ? "Accepted"
        : row.admissionDisposition === "REJECTED"
          ? "Rejected"
          : row.admissionDisposition === "QUARANTINED"
            ? "Quarantined"
            : "Unsupported",
  cost: row.cost === undefined ? null : costViewFromBlock(row.cost),
  costCompleteness:
    row.cost === undefined ? null : costCompletenessLabel(row.cost.completeness),
  latency:
    row.latencyMs === undefined || row.latencyMs === null
      ? null
      : `${row.latencyMs} ms`,
  isProgressing: isProgressing(row.processingState),
  isInfrastructureFailure: isInfrastructureFailure(row.processingState),
  isRejected: isAdmissionRejected(row.admissionDisposition, row.processingState),
  isQuarantined: isAdmissionQuarantined(row.admissionDisposition, row.processingState),
  supportCopy: STATIC_PROCESSING_SUPPORT_COPY,
})
