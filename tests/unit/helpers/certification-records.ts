// Single source of truth for the certification scenario lives in
// `src/sync/dev/certification-scenario.ts` (so the fake-sync e2e dataset and the
// unit test share one dataset). Re-exported here for the unit test's import path.
export {
  ASOF,
  CPI,
  FX,
  IKE_ID,
  IKZE_ID,
  TAXABLE_ID,
  buildCertificationRecords,
} from "@/sync/dev/certification-scenario";
