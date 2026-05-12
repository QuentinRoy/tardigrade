import { Suspense } from "react";

import AssessmentsImportForm from "@/import/AssessmentsImportForm";

export default function AssessmentsImportPage() {
  return (
    <Suspense>
      <AssessmentsImportForm />
    </Suspense>
  );
}
