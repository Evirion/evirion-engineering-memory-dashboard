import "server-only"

import { cookies } from "next/headers"

import type {
  GithubSettingsSummary,
  Member,
  OrganizationInvitations,
  OrganizationMetrics,
  OrganizationOffboarding,
  OrganizationUsage,
} from "@contracts/console"

import { hasCapability } from "@/lib/auth/capabilities"
import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import {
  type ViewFailure,
  UNKNOWN_ERROR,
  describeTreatment,
  mapConsoleError,
} from "@/lib/errors/console-errors"
import type { ConsoleFailure } from "@/server/adapters/console-api"
import { type RepositoryScope } from "@/server/adapters/repositories"
import {
  type MetricsQuery,
  type UsageQuery,
  fetchGithubSettingsSummary,
  fetchOrganizationInvitations,
  fetchOrganizationMembers,
  fetchOrganizationMetrics,
  fetchOrganizationOffboarding,
  fetchOrganizationUsage,
} from "@/server/adapters/settings"
import { requireSessionContext } from "@/server/queries/session-context"

export type SettingsFailureView = {
  readonly status: "unavailable"
  readonly failure: ViewFailure
}

export type GithubSettingsView =
  | { readonly status: "ready"; readonly summary: GithubSettingsSummary }
  | SettingsFailureView

export type UsageSettingsView =
  | {
      readonly status: "ready"
      readonly usage: OrganizationUsage
      readonly metrics: OrganizationMetrics
    }
  | SettingsFailureView

export type MembersSettingsView =
  | {
      readonly status: "ready"
      readonly members: readonly Member[]
      /**
       * Empty for a caller the backend does not let manage membership. The
       * inventory is a manage-only read, so requesting it as a reviewer would
       * turn one capability refusal into a page that will not render at all.
       */
      readonly invitations: OrganizationInvitations
      readonly offboarding: OrganizationOffboarding | null
    }
  | SettingsFailureView

const correlationId = (): string => {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("hex")
}

export const describeFailure = (
  failure: ConsoleFailure,
  requestId?: string,
): ViewFailure => {
  switch (failure.kind) {
    case "error": {
      const mapped = mapConsoleError(failure.error)
      return {
        code: mapped.code,
        treatment: mapped.treatment,
        message: describeTreatment(mapped.treatment),
        retryable: mapped.retryable,
        ...(mapped.requestId === undefined ? {} : { requestId: mapped.requestId }),
      }
    }
    case "unsupported":
      return {
        code: UNKNOWN_ERROR.code,
        treatment: UNKNOWN_ERROR.treatment,
        message: describeTreatment(UNKNOWN_ERROR.treatment),
        retryable: UNKNOWN_ERROR.retryable,
        ...(requestId === undefined ? {} : { requestId }),
      }
    case "unreachable":
      return {
        code: "DEPENDENCY_UNAVAILABLE",
        treatment: "retry-bounded",
        message: describeTreatment("retry-bounded"),
        retryable: true,
      }
    default: {
      const exhaustive: never = failure
      throw new Error(`unhandled console failure: ${JSON.stringify(exhaustive)}`)
    }
  }
}

const resolveScope = async (): Promise<
  { readonly ok: true; readonly scope: RepositoryScope } | { readonly ok: false }
> => {
  const context = await requireSessionContext()
  if (context.status === "unavailable") return { ok: false }

  const jar = await cookies()
  const outcome = readSession(
    Object.fromEntries(jar.getAll().map((cookie) => [cookie.name, cookie.value])),
  )
  if (outcome.status !== "active") return { ok: false }

  const environment = readServerEnvironment()
  return {
    ok: true,
    scope: {
      baseUrl: environment.consoleApiBaseUrl,
      organizationId: context.context.organizationId,
      accessToken: outcome.session.accessToken,
      correlationId: correlationId(),
    },
  }
}

export const readGithubSettings = async (): Promise<GithubSettingsView> => {
  const resolved = await resolveScope()
  if (!resolved.ok) {
    return {
      status: "unavailable",
      failure: {
        code: "AUTHENTICATION_REQUIRED",
        treatment: "sign-in-required",
        message: describeTreatment("sign-in-required"),
        retryable: false,
      },
    }
  }

  const result = await fetchGithubSettingsSummary(resolved.scope)
  if (!result.ok) {
    return { status: "unavailable", failure: describeFailure(result.failure) }
  }

  return { status: "ready", summary: result.value }
}

export const readUsageSettings = async (
  usageQuery: UsageQuery = {},
  metricsQuery: MetricsQuery = {},
): Promise<UsageSettingsView> => {
  const resolved = await resolveScope()
  if (!resolved.ok) {
    return {
      status: "unavailable",
      failure: {
        code: "AUTHENTICATION_REQUIRED",
        treatment: "sign-in-required",
        message: describeTreatment("sign-in-required"),
        retryable: false,
      },
    }
  }

  const [usage, metrics] = await Promise.all([
    fetchOrganizationUsage(resolved.scope, usageQuery),
    fetchOrganizationMetrics(resolved.scope, metricsQuery),
  ])

  if (!usage.ok) {
    return { status: "unavailable", failure: describeFailure(usage.failure) }
  }
  if (!metrics.ok) {
    return { status: "unavailable", failure: describeFailure(metrics.failure) }
  }

  return {
    status: "ready",
    usage: usage.value,
    metrics: metrics.value,
  }
}

export const readMembersSettings = async (): Promise<MembersSettingsView> => {
  const context = await requireSessionContext()
  if (context.status === "unavailable") {
    return {
      status: "unavailable",
      failure: {
        code: "AUTHENTICATION_REQUIRED",
        treatment: "sign-in-required",
        message: context.message,
        retryable: false,
      },
    }
  }

  const resolved = await resolveScope()
  if (!resolved.ok) {
    return {
      status: "unavailable",
      failure: {
        code: "AUTHENTICATION_REQUIRED",
        treatment: "sign-in-required",
        message: describeTreatment("sign-in-required"),
        retryable: false,
      },
    }
  }

  // Reading members and reading pending invitations are two capabilities. A
  // reviewer holds the first and not the second, so the invitation read is not
  // attempted for them: a refusal there would otherwise take the member
  // inventory down with it.
  const canManage = hasCapability(context.context, "organization.members.manage")

  const [members, invitations, offboarding] = await Promise.all([
    fetchOrganizationMembers(resolved.scope),
    canManage ? fetchOrganizationInvitations(resolved.scope) : undefined,
    fetchOrganizationOffboarding(resolved.scope),
  ])

  if (!members.ok) {
    return { status: "unavailable", failure: describeFailure(members.failure) }
  }
  if (invitations !== undefined && !invitations.ok) {
    return { status: "unavailable", failure: describeFailure(invitations.failure) }
  }
  if (!offboarding.ok) {
    return { status: "unavailable", failure: describeFailure(offboarding.failure) }
  }

  return {
    status: "ready",
    members: members.value,
    invitations: invitations?.value ?? [],
    offboarding: offboarding.value,
  }
}
