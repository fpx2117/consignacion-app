function matchingParenthesis(content, openingIndex) {
  let depth = 0;
  let quote = "";
  for (let index = openingIndex; index < content.length; index += 1) {
    const character = content[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if ("\"'`".includes(character)) {
      quote = character;
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

export function findFunctionCalls(content, names) {
  const calls = [];
  for (let index = 0; index < content.length; index += 1) {
    if (index > 0 && /[\w-]/.test(content[index - 1])) continue;
    const name = content.slice(index).match(/^[a-z][\w-]*/i)?.[0];
    if (!name || !names.has(name.toLowerCase())) continue;
    const openingIndex = index + name.length;
    if (content[openingIndex] !== "(") continue;
    const closingIndex = matchingParenthesis(content, openingIndex);
    if (closingIndex < 0) continue;
    calls.push({
      0: content.slice(index, closingIndex + 1),
      index,
      args: content.slice(openingIndex + 1, closingIndex),
    });
  }
  return calls;
}

export function isTokenDerivedColor(args) {
  const normalized = args.replace(/var\(\s*--[\w-]+\s*\)/gi, "<token>").trim();
  return /^(?:[a-z][\w-]+\s+)?<token>(?:\s*[,/]\s*(?:0(?:\.\d+)?|1(?:\.0+)?)%?)?$/i.test(
    normalized,
  );
}

export function structuralSlot(value, endIndex) {
  const slots = [0];
  for (let index = 0; index < endIndex; index += 1) {
    if (value[index] === "(") slots.push(0);
    else if (value[index] === ")" && slots.length > 1) slots.pop();
    else if (value[index] === ",") slots[slots.length - 1] += 1;
  }
  return slots.join(".");
}

export function openBraceStack(content, endIndex) {
  const stack = [];
  let quote = "";
  let comment = "";
  for (let index = 0; index < endIndex; index += 1) {
    const pair = content.slice(index, index + 2);
    const character = content[index];
    if (comment === "line" && character === "\n") comment = "";
    else if (comment === "block" && pair === "*/") {
      comment = "";
      index += 1;
    } else if (comment) continue;
    else if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
    } else if (pair === "//" || pair === "/*") {
      comment = pair === "//" ? "line" : "block";
      index += 1;
    } else if ("\"'".includes(character)) quote = character;
    else if (character === "{") stack.push(index);
    else if (character === "}") stack.pop();
  }
  return stack;
}

function blockLabel(content, openingBrace) {
  const prefix = content
    .slice(Math.max(0, openingBrace - 200), openingBrace)
    .trimEnd();
  const segment =
    prefix
      .split(/[\n;}]/)
      .at(-1)
      ?.trim() ?? "";
  const assignment = segment.match(/([a-z_$][\w$-]*)\s*(?::|=)\s*$/i);
  if (assignment) return assignment[1];
  if (!segment || /^(?:else|for|function|if|switch|while)\b/.test(segment)) {
    return "";
  }
  return segment.slice(-64);
}

export function enclosingIdentity(content, index) {
  return openBraceStack(content, index)
    .map((openingBrace) => blockLabel(content, openingBrace))
    .filter(Boolean)
    .join("/");
}
