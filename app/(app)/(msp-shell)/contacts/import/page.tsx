import type { Metadata } from "next";

import { ImportWizard } from "@/components/contacts/import-wizard";

export const metadata: Metadata = { title: "Import Contacts — GrowthOS" };

export default function ImportContactsPage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <h1 className="mb-6 text-h1 text-primary-900">Import Contacts</h1>
      <ImportWizard />
    </main>
  );
}
