import type { AlgorithmMeta } from "../core/types";

export function renderSources(container: HTMLElement, metas: AlgorithmMeta[]): void {
  container.innerHTML = "";

  const list = document.createElement("ul");
  list.className = "sources-list";

  for (const meta of metas) {
    const li = document.createElement("li");

    const link = document.createElement("a");
    link.href = meta.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = meta.name;

    const attribution = document.createElement("div");
    attribution.className = "sources-meta";
    attribution.textContent = `${meta.authors}. ${meta.venue}, ${meta.year}.`;

    li.appendChild(link);
    li.appendChild(attribution);

    if (meta.note) {
      const note = document.createElement("div");
      note.className = "sources-note";
      note.textContent = meta.note;
      li.appendChild(note);
    }

    list.appendChild(li);
  }

  container.appendChild(list);
}
