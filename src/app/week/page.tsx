import type { Metadata } from "next";
import { WeekView } from "@/components/WeekView";

export const metadata: Metadata = {
  title: "Your week",
  description: "Seven days of energy, focus and burnout pressure as a climate chart, with one sentence about the pattern.",
};

export default function WeekPage() {
  return <WeekView />;
}
