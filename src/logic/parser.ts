export interface CountMarkdownConfig {
  excludeCodeBlocks: boolean;
  excludeComments: boolean;
  excludeNonVisibleLinkPortions: boolean;
  excludeFootnotes: boolean;
}

export interface CountResult {
  charCount: number;
  nonWhitespaceCharCount: number;
  spaceDelimitedWordCount: number;
  cjkWordCount: number;
  newlineCount: number;
}

const cjkRegex = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const allSymbolsRegex = /[\p{S}\p{P}]/gu;
const whitespaceRegex = /\s/g;

function countNonWhitespaceCharacters(content: string): number {
  return content.replace(whitespaceRegex, "").length;
}

function removeNonCountedContent(content: string, config: CountMarkdownConfig): string {
  if (config.excludeCodeBlocks) {
    content = content.replace(/(```.+?```)/gims, "");
  }
  if (config.excludeComments) {
    content = content.replace(/(%%.+?%%|<!--.+?-->)/gims, "");
  }
  if (config.excludeNonVisibleLinkPortions) {
    content = content.replace(/\[([^\]]*?)\]\([^\)]*?\)/gim, "$1");
    content = content.replace(/\[\[(.*?)\]\]/gim, (_, $1: string) => {
      return !$1 ? "" : $1.includes("|") ? $1.slice($1.indexOf("|") + 1) : $1;
    });
  }
  if (config.excludeFootnotes) {
    content = content.replace(/\[\^.+?\]: .*/gim, "");
    content = content.replace(/\[\^.+?\]/gim, "");
  }
  return content;
}

export function countMarkdown(content: string, config: CountMarkdownConfig): CountResult {
  content = removeNonCountedContent(content, config);

  let wordSequences = content
    .replace(cjkRegex, " ")
    .replace(allSymbolsRegex, "")
    .trim()
    .split(/\s+/);
  if (wordSequences.length === 1 && wordSequences[0] === "") {
    wordSequences = [];
  }

  let lineSequences = content.split("\n");
  if (lineSequences.length === 1 && lineSequences[0] === "") {
    lineSequences = [];
  }

  return {
    charCount: content.length,
    nonWhitespaceCharCount: countNonWhitespaceCharacters(content),
    spaceDelimitedWordCount: wordSequences.length,
    cjkWordCount: (content.match(cjkRegex) || []).length,
    newlineCount: lineSequences.length,
  };
}
