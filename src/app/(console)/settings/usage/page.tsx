import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import { UsageMetricsPanel } from "@/components/settings/usage-metrics-panel"
import { readUsageSettings } from "@/server/queries/settings"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

const UsageSettingsPage = async () => {
  const view = await readUsageSettings()

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Usage and metrics</h1>
        <p className="text-sm text-slate-600">
          Operational usage and Alpha metrics use separate windows. Neither is an
          invoice.
        </p>
      </div>

      {view.status === "unavailable" ? (
        <ConsoleUnavailable
          failure={view.failure}
          heading="Usage and metrics are not available right now"
        />
      ) : (
        <UsageMetricsPanel usage={view.usage} metrics={view.metrics} />
      )}
    </section>
  )
}

export default UsageSettingsPage
