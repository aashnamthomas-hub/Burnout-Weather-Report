import { FEELING_HEADINGS, type Feeling, type Suggestion } from "@/lib/suggestions";

const KIND_LABEL: Record<Suggestion["kind"], string> = {
  watch: "Watch",
  people: "People",
  do: "Try",
  listen: "Listen",
};

type Props = { feeling: Feeling; items: Suggestion[] };

/** Things to watch, people to reach out to and gentle things to do, picked by mood. */
export function MoodSuggestions({ feeling, items }: Props) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="mood-title">
      <h3 id="mood-title" className="text-2xl font-normal">{FEELING_HEADINGS[feeling]}</h3>
      <p className="mt-2 max-w-2xl text-base text-ink-soft text-pretty">
        Small ideas based on how today looks. Take what helps and ignore the rest.
      </p>
      <ul className="mt-4 grid gap-x-12 border-b border-hairline md:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="border-t border-hairline py-4">
            <p className="font-mono text-xs text-ink-soft">
              {KIND_LABEL[item.kind]}
              {item.meta ? ` · ${item.meta}` : ""}
            </p>
            <p className="mt-1 text-xl leading-snug">{item.title}</p>
            <p className="mt-1 text-base text-ink-soft text-pretty">{item.note}</p>
            <p className="mt-2 font-mono text-xs">{item.when}</p>
          </li>
        ))}
      </ul>
      {feeling === "low" && (
        <p className="mt-4 max-w-2xl text-base text-ink-soft text-pretty">
          If low days keep adding up, talking to someone you trust, or a professional, can really help.
        </p>
      )}
    </section>
  );
}
