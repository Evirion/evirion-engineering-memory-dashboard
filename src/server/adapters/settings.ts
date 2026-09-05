import "server-only"

import {
  type GithubSettingsSummary,
  type InvitationReceipt,
  type Member,
  type MembershipReceipt,
  type OffboardingReceipt,
  type OrganizationInvitations,
  type OrganizationMetrics,
  type OrganizationOffboarding,
  type OrganizationUsage,
  isGithubSettingsSummary,
  isInvitationReceipt,
  isMember,
  isMembershipReceipt,
  isOffboardingReceipt,
  isOrganizationInvitations,
  isOrganizationMetrics,
  isOrganizationOffboardingStatus,
  isOrganizationUsage,
} from "@contracts/console"

import {
  type ConsoleResult,
  type ConsoleTransport,
  callConsoleApi,
} from "./console-api"
import { type RepositoryScope, isUuid } from "./repositories"

const identifier = (value: string, label: string): string => {
  if (!isUuid(value)) throw new Error(`${label} must be a UUID identifier`)
  return value
}

const organizationPath = (scope: RepositoryScope, suffix: string): string =>
  `/v1/organizations/${identifier(scope.organizationId, "organization")}${suffix}`

const read = <T>(
  scope: RepositoryScope,
  path: string,
  isExpected: (value: unknown) => value is T,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<T>> =>
  callConsoleApi<T>(
    scope.baseUrl,
    {
      method: "GET",
      path,
      accessToken: scope.accessToken,
      correlationId: scope.correlationId,
    },
    isExpected,
    transport,
  )

const isMemberArray = (value: unknown): value is Member[] =>
  Array.isArray(value) && value.every((entry) => isMember(entry))

export type UsageQuery = {
  readonly periodStart?: string
  readonly periodEnd?: string
}

export type MetricsQuery = {
  readonly asOf?: string
  readonly repositoryId?: string
}

export const fetchGithubSettingsSummary = (
  scope: RepositoryScope,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<GithubSettingsSummary>> =>
  read(
    scope,
    organizationPath(scope, "/settings/github"),
    isGithubSettingsSummary,
    transport,
  )

export const fetchOrganizationUsage = (
  scope: RepositoryScope,
  query: UsageQuery = {},
  transport?: ConsoleTransport,
): Promise<ConsoleResult<OrganizationUsage>> => {
  const search = new URLSearchParams()
  if (query.periodStart !== undefined) search.set("periodStart", query.periodStart)
  if (query.periodEnd !== undefined) search.set("periodEnd", query.periodEnd)
  const suffix = search.size > 0 ? `?${search.toString()}` : ""
  return read(
    scope,
    organizationPath(scope, `/usage${suffix}`),
    isOrganizationUsage,
    transport,
  )
}

export const fetchOrganizationMetrics = (
  scope: RepositoryScope,
  query: MetricsQuery = {},
  transport?: ConsoleTransport,
): Promise<ConsoleResult<OrganizationMetrics>> => {
  const search = new URLSearchParams()
  if (query.asOf !== undefined) search.set("asOf", query.asOf)
  if (query.repositoryId !== undefined) {
    search.set("repositoryId", identifier(query.repositoryId, "repository"))
  }
  const suffix = search.size > 0 ? `?${search.toString()}` : ""
  return read(
    scope,
    organizationPath(scope, `/metrics${suffix}`),
    isOrganizationMetrics,
    transport,
  )
}

export const fetchOrganizationMembers = (
  scope: RepositoryScope,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<Member[]>> =>
  read(scope, organizationPath(scope, "/members"), isMemberArray, transport)

export const fetchOrganizationInvitations = (
  scope: RepositoryScope,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<OrganizationInvitations>> =>
  read(
    scope,
    organizationPath(scope, "/invitations"),
    isOrganizationInvitations,
    transport,
  )

export const fetchOrganizationOffboarding = (
  scope: RepositoryScope,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<OrganizationOffboarding | null>> =>
  read(
    scope,
    organizationPath(scope, "/offboarding"),
    isOrganizationOffboardingStatus,
    transport,
  ).then((result) => {
    if (!result.ok) return result
    return {
      ok: true as const,
      value: result.value.offboarding,
      requestId: result.requestId,
    }
  })

export type CreateInvitationInput = {
  readonly email: string
  readonly role: "admin" | "reviewer" | "viewer"
  readonly idempotencyKey: string
}

export type VersionedInvitationInput = {
  readonly invitationId: string
  readonly expectedVersion: number
  readonly idempotencyKey: string
}

export type UpdateMembershipInput = {
  readonly membershipId: string
  readonly action: "change_role" | "disable" | "transfer_owner"
  readonly role?: "admin" | "reviewer" | "viewer"
  readonly expectedVersion: number
  readonly idempotencyKey: string
}

export type OffboardingRequestInput = {
  readonly confirmationAccepted: true
  readonly reason?: string
  readonly idempotencyKey: string
}

const command = <T>(
  scope: RepositoryScope,
  input: {
    readonly method: "POST" | "PATCH"
    readonly path: string
    readonly idempotencyKey: string
    readonly body: unknown
  },
  isExpected: (value: unknown) => value is T,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<T>> =>
  callConsoleApi<T>(
    scope.baseUrl,
    {
      method: input.method,
      path: input.path,
      accessToken: scope.accessToken,
      correlationId: scope.correlationId,
      idempotencyKey: identifier(input.idempotencyKey, "idempotency key"),
      body: input.body,
    },
    isExpected,
    transport,
  )

export const createOrganizationInvitation = (
  scope: RepositoryScope,
  input: CreateInvitationInput,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<InvitationReceipt>> =>
  command(
    scope,
    {
      method: "POST",
      path: organizationPath(scope, "/invitations"),
      idempotencyKey: input.idempotencyKey,
      body: { email: input.email, role: input.role },
    },
    isInvitationReceipt,
    transport,
  )

export const resendOrganizationInvitation = (
  scope: RepositoryScope,
  input: VersionedInvitationInput,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<InvitationReceipt>> =>
  command(
    scope,
    {
      method: "POST",
      path: organizationPath(
        scope,
        `/invitations/${identifier(input.invitationId, "invitation")}/resend`,
      ),
      idempotencyKey: input.idempotencyKey,
      body: { expectedVersion: input.expectedVersion },
    },
    isInvitationReceipt,
    transport,
  )

export const revokeOrganizationInvitation = (
  scope: RepositoryScope,
  input: VersionedInvitationInput,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<InvitationReceipt>> =>
  command(
    scope,
    {
      method: "POST",
      path: organizationPath(
        scope,
        `/invitations/${identifier(input.invitationId, "invitation")}/revoke`,
      ),
      idempotencyKey: input.idempotencyKey,
      body: { expectedVersion: input.expectedVersion },
    },
    isInvitationReceipt,
    transport,
  )

export const updateOrganizationMembership = (
  scope: RepositoryScope,
  input: UpdateMembershipInput,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<MembershipReceipt>> =>
  command(
    scope,
    {
      method: "PATCH",
      path: organizationPath(
        scope,
        `/members/${identifier(input.membershipId, "membership")}`,
      ),
      idempotencyKey: input.idempotencyKey,
      body: {
        action: input.action,
        expectedVersion: input.expectedVersion,
        ...(input.role === undefined ? {} : { role: input.role }),
      },
    },
    isMembershipReceipt,
    transport,
  )

export const requestOrganizationOffboarding = (
  scope: RepositoryScope,
  input: OffboardingRequestInput,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<OffboardingReceipt>> =>
  command(
    scope,
    {
      method: "POST",
      path: organizationPath(scope, "/offboarding"),
      idempotencyKey: input.idempotencyKey,
      body: {
        confirmationAccepted: input.confirmationAccepted,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
      },
    },
    isOffboardingReceipt,
    transport,
  )
