import type { Page } from "@playwright/test"

const openDisclosure = async (page: Page, testId: string): Promise<void> => {
  const details = page.getByTestId(testId)
  if ((await details.count()) === 0) return
  if ((await details.getAttribute("open")) === null) {
    await details.locator("summary").first().click()
  }
}

/** Opens the ancestor disclosure of a memory form or panel when it is collapsed. */
const openAncestorDetails = async (
  page: Page,
  testId: string,
): Promise<void> => {
  const target = page.getByTestId(testId)
  const details = target.locator("xpath=ancestor::details[1]")
  if ((await details.count()) === 0) return
  if ((await details.getAttribute("open")) === null) {
    await details.locator("summary").first().click()
  }
}

export const clickMemorySubmit = async (
  page: Page,
  formTestId: string,
  name: string,
): Promise<void> => {
  await openAncestorDetails(page, formTestId)
  await page.getByTestId(formTestId).getByRole("button", { name, exact: true }).click()
}

export const openReviewForm = async (page: Page, formTestId: string): Promise<void> =>
  openAncestorDetails(page, formTestId)

export const openLifecycleForm = async (page: Page, formTestId: string): Promise<void> =>
  openAncestorDetails(page, formTestId)

export const openKnowledgePayload = async (page: Page): Promise<void> =>
  openDisclosure(page, "knowledge-payload-disclosure")

export const openKnowledgeSource = async (page: Page): Promise<void> =>
  openDisclosure(page, "knowledge-source-disclosure")

export const openReviewHistorySection = async (page: Page): Promise<void> =>
  openDisclosure(page, "review-history-disclosure")

export const openCorrectionRequestsSection = async (page: Page): Promise<void> =>
  openDisclosure(page, "correction-requests-disclosure")
