import { redirect } from "next/navigation";

export default function RootPage() {
  // Arahkan pengunjung root URL langsung ke alur persiapan ujian
  redirect("/setup");
}
