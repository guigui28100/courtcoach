import { ProfsPlanning } from "../components/ProfsPlanning";
import { Page, PageHead } from "../components/ui";

export default function PlanningProfsPage() {
  return (
    <>
      <PageHead eyebrow="Club" title="Planning des profs" icon="🗓️" />
      <Page><ProfsPlanning /></Page>
    </>
  );
}
