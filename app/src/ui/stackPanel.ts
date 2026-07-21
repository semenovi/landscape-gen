import type { AlgorithmMeta, ParamSpec } from "../core/types";

export function buildParamRow(spec: ParamSpec, values: Record<string, number | boolean>, onChange: () => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "param-row";

  if (spec.type === "boolean") {
    const label = document.createElement("label");
    label.className = "param-checkbox";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = values[spec.key] as boolean;
    input.addEventListener("change", () => {
      values[spec.key] = input.checked;
      onChange();
    });

    label.appendChild(input);
    label.append(spec.label);
    row.appendChild(label);
    return row;
  }

  const label = document.createElement("label");
  label.className = "param-label";
  label.textContent = spec.label;

  const controls = document.createElement("div");
  controls.className = "param-controls";

  const min = String(spec.min ?? 0);
  const max = String(spec.max ?? 1);
  const step = String(spec.step ?? 1);

  const range = document.createElement("input");
  range.type = "range";
  range.min = min;
  range.max = max;
  range.step = step;
  range.value = String(values[spec.key]);

  const number = document.createElement("input");
  number.type = "number";
  number.className = "param-number";
  number.min = min;
  number.max = max;
  number.step = step;
  number.value = range.value;
  number.addEventListener("wheel", () => number.blur());

  range.addEventListener("input", () => {
    number.value = range.value;
    values[spec.key] = Number(range.value);
    onChange();
  });
  number.addEventListener("change", () => {
    range.value = number.value;
    values[spec.key] = Number(number.value);
    onChange();
  });

  controls.appendChild(range);
  controls.appendChild(number);
  row.appendChild(label);
  row.appendChild(controls);
  return row;
}

export interface StackCardOptions {
  meta: AlgorithmMeta;
  specs: ParamSpec[];
  values: Record<string, number | boolean>;
  onChange: () => void;
  enabled?: { value: boolean; onToggle: (enabled: boolean) => void };
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  note?: string;
  startExpanded?: boolean;
}

export function buildStackCard(options: StackCardOptions): HTMLElement {
  const card = document.createElement("div");
  card.className = "stack-card";

  const header = document.createElement("div");
  header.className = "stack-card-header";

  if (options.enabled) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "stack-enable";
    checkbox.checked = options.enabled.value;
    checkbox.addEventListener("change", () => options.enabled?.onToggle(checkbox.checked));
    header.appendChild(checkbox);
  }

  const titles = document.createElement("div");
  titles.className = "stack-titles";

  const name = document.createElement("div");
  name.className = "stack-name";
  name.textContent = options.meta.name;

  const author = document.createElement("div");
  author.className = "stack-author";
  author.append(`by ${options.meta.authors}, ${options.meta.year} (`);
  const link = document.createElement("a");
  link.href = options.meta.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "источник";
  author.appendChild(link);
  author.append(")");

  titles.appendChild(name);
  titles.appendChild(author);
  header.appendChild(titles);

  const controls = document.createElement("div");
  controls.className = "stack-controls";

  if (options.onMoveUp) {
    const up = document.createElement("button");
    up.type = "button";
    up.className = "stack-btn";
    up.textContent = "▲";
    up.title = "Переместить выше";
    up.addEventListener("click", options.onMoveUp);
    controls.appendChild(up);
  }
  if (options.onMoveDown) {
    const down = document.createElement("button");
    down.type = "button";
    down.className = "stack-btn";
    down.textContent = "▼";
    down.title = "Переместить ниже";
    down.addEventListener("click", options.onMoveDown);
    controls.appendChild(down);
  }

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "stack-btn stack-expand";
  controls.appendChild(toggle);
  header.appendChild(controls);
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "stack-card-body";
  for (const spec of options.specs) {
    body.appendChild(buildParamRow(spec, options.values, options.onChange));
  }
  if (options.note) {
    const note = document.createElement("div");
    note.className = "stack-note";
    note.textContent = options.note;
    body.appendChild(note);
  }
  card.appendChild(body);

  let expanded = options.startExpanded ?? true;
  const applyExpanded = () => {
    body.style.display = expanded ? "flex" : "none";
    toggle.textContent = expanded ? "▾" : "▸";
  };
  applyExpanded();

  const toggleExpanded = () => {
    expanded = !expanded;
    applyExpanded();
  };

  const HEADER_CLICK_EXCLUDE = [".stack-enable", ".stack-controls", ".stack-author a"];
  header.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (HEADER_CLICK_EXCLUDE.some((selector) => target.closest(selector))) return;
    toggleExpanded();
  });
  toggle.addEventListener("click", toggleExpanded);

  return card;
}

export function buildSectionHeading(text: string): HTMLElement {
  const heading = document.createElement("div");
  heading.className = "stack-section-heading";
  heading.textContent = text;
  return heading;
}
