import { CheckIn } from "@/components/CheckIn";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-12 sm:px-8 lg:py-20">
      <CheckIn />
    </div>
  );
}
