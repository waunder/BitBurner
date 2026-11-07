// Break plain text into lines of at most `width` characters at spaces; pure, no ns.
// Continuation lines get `indent` extra leading spaces. A word longer than a line is cut.

export function wrapText(text, width, indent = 2) {
  const source = String(text)
  if (source.length <= width) return [source]
  const lead = source.match(/^ */)[0]
  const pad = lead + " ".repeat(indent)
  const words = source.slice(lead.length).split(/ +/).filter(Boolean)
  const lines = []
  let line = lead
  let prefix = lead
  for (let word of words) {
    while (word.length > width - pad.length) {
      if (line.trim()) { lines.push(line); line = pad; prefix = pad }
      const room = width - line.length
      lines.push(line + word.slice(0, room))
      word = word.slice(room)
      line = pad
      prefix = pad
    }
    const candidate = line === prefix ? line + word : `${line} ${word}`
    if (candidate.length <= width) line = candidate
    else { lines.push(line); line = pad + word; prefix = pad }
  }
  if (line.trim()) lines.push(line)
  return lines
}
