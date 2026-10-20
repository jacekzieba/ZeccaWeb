import { describe, expect, it } from "vitest";
import cases from "../fixtures/native-golden/sync_admission_cases.json";
import { validateTransactionPayload } from "@/sync/records/transaction-validator";

// Ten sam sędzia co natywny `TransactionSyncAdmissionFixtureTests`: rekord,
// którego natywny TransactionValidator nie przyjmie, aplikacja odkłada przy
// pullu do kwarantanny. Web nie może go więc zapisać.
describe("walidator zapisu transakcji = natywny TransactionValidator", () => {
  it.each(cases.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    expect(validateTransactionPayload(testCase.payload)).toEqual(testCase.expectedIssues);
  });
});
