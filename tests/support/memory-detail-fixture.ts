import type { Page } from "@playwright/test"

/** Submits one memory form by name, scoped to that form and no other. */
export const clickMemorySubmit = async (
  page: Page,
  formTestId: string,
  name: string,
): Promise<void> => {
  await page.getByTestId(formTestId).getByRole("button", { name, exact: true }).click()
}
