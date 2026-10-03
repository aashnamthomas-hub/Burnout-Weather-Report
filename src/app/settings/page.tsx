import type { Metadata } from "next";
import { SettingsView } from "@/components/SettingsView";

export const metadata: Metadata = {
  title: "Settings",
  description: "Choose whether to factor in your cycle, and remove what is saved in this browser.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
