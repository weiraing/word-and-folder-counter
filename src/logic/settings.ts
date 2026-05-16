export const CountType = {
  None: "none",
  Word: "word",
  Character: "character",
  Linebreak: "linebreak",
  PercentGoal: "percentgoal",
  Note: "note",
  FileCount: "filecount",
  Created: "created",
  Modified: "modified",
  FileSize: "filesize",
} as const;

export type CountType = (typeof CountType)[keyof typeof CountType];

export const COUNT_TYPES: CountType[] = Object.values(CountType);

export const SESSION_COUNT_TYPES: CountType[] = [
  CountType.Word,
  CountType.Character,
  CountType.Linebreak,
  CountType.Note,
];

export const COUNT_TYPE_DISPLAY_STRINGS: Record<CountType, string> = {
  [CountType.None]: "无",
  [CountType.Word]: "字数",
  [CountType.Character]: "字符数",
  [CountType.Linebreak]: "行数",
  [CountType.PercentGoal]: "目标字数完成度",
  [CountType.Note]: "笔记数",
  [CountType.FileCount]: "文件数",
  [CountType.Created]: "创建日期",
  [CountType.Modified]: "更新日期",
  [CountType.FileSize]: "文件大小",
};

export const COUNT_TYPE_DESCRIPTIONS: Record<CountType, string> = {
  [CountType.None]: "隐藏。",
  [CountType.Word]: "总字数。",
  [CountType.Character]: "总字符数（包括字母、符号、数字和空格）。",
  [CountType.Linebreak]: "换行符数量，包括空行。",
  [CountType.PercentGoal]: "通过在笔记中添加 'word-goal' 属性来设置字数目标。",
  [CountType.Note]: "总笔记数。",
  [CountType.FileCount]: "文件夹中的文件数量。",
  [CountType.Created]: "创建日期。（在文件夹上：任何笔记的最早创建日期。）",
  [CountType.Modified]: "最后编辑日期。（在文件夹上：任何笔记的最新编辑日期。）",
  [CountType.FileSize]: "硬盘上的总大小。",
};

export const UNFORMATTABLE_COUNT_TYPES: CountType[] = [
  CountType.None,
  CountType.FileSize,
];

export const COUNT_TYPE_DEFAULT_SHORT_SUFFIXES: Record<string, string> = {
  [CountType.Word]: "字",
  [CountType.Character]: "字符",
  [CountType.Linebreak]: "\xB6",
  [CountType.PercentGoal]: "%",
  [CountType.Note]: "页",
  [CountType.FileCount]: "文件",
  [CountType.Created]: "/c",
  [CountType.Modified]: "/u",
};

export function getDescription(countType: CountType): string {
  return `[${COUNT_TYPE_DISPLAY_STRINGS[countType]}] ${COUNT_TYPE_DESCRIPTIONS[countType]}`;
}

export const AlignmentType = {
  Inline: "inline",
  Right: "right",
  Below: "below",
} as const;

export type AlignmentType = (typeof AlignmentType)[keyof typeof AlignmentType];

export const ALIGNMENT_TYPES: AlignmentType[] = [
  AlignmentType.Inline,
  AlignmentType.Right,
  AlignmentType.Below,
];

export const CharacterCountType = {
  StringLength: "AllCharacters",
  ExcludeWhitespace: "ExcludeWhitespace",
} as const;

export type CharacterCountType = (typeof CharacterCountType)[keyof typeof CharacterCountType];

export const PageCountType = {
  ByWords: "ByWords",
  ByChars: "ByChars",
} as const;

export type PageCountType = (typeof PageCountType)[keyof typeof PageCountType];

export interface CountConfig {
  customSuffix?: string;
  $sessionCountType?: CountType;
}

export interface NovelWordCountSettings {
  useAdvancedFormatting: boolean;
  countType: CountType;
  countConfig: CountConfig;
  countType2: CountType;
  countConfig2: CountConfig;
  countType3: CountType;
  countConfig3: CountConfig;
  pipeSeparator: string;
  abbreviateDescriptions: boolean;
  alignment: AlignmentType;
  showSameCountsOnFolders: boolean;
  folderCountType: CountType;
  folderCountConfig: CountConfig;
  folderCountType2: CountType;
  folderCountConfig2: CountConfig;
  folderCountType3: CountType;
  folderCountConfig3: CountConfig;
  folderPipeSeparator: string;
  folderAbbreviateDescriptions: boolean;
  folderAlignment: AlignmentType;
  showSameCountsOnRoot: boolean;
  rootCountType: CountType;
  rootCountConfig: CountConfig;
  rootCountType2: CountType;
  rootCountConfig2: CountConfig;
  rootCountType3: CountType;
  rootCountConfig3: CountConfig;
  rootPipeSeparator: string;
  rootAbbreviateDescriptions: boolean;
  showAdvanced: boolean;
  labelOpacity: number;
  characterCountType: CharacterCountType;
  pageCountType: PageCountType;
  wordsPerPage: number;
  charsPerPage: number;
  charsPerPageIncludesWhitespace: boolean;
  includeDirectories: string;
  excludeComments: boolean;
  excludeCodeBlocks: boolean;
  excludeNonVisibleLinkPortions: boolean;
  excludeFootnotes: boolean;
  momentDateFormat: string;
  debugMode: boolean;
  formatNumbers: boolean;
  filterList: string[];
  blacklist: boolean;
}

export type TargetNodeType = "file" | "directory" | "root";

export interface FileCounts {
  isCountable: boolean;
  targetNodeType: TargetNodeType;
  noteCount: number;
  wordCount: number;
  wordCountTowardGoal: number;
  wordGoal: number;
  pageCount: number;
  characterCount: number;
  nonWhitespaceCharacterCount: number;
  newlineCount: number;
  createdDate: number;
  modifiedDate: number;
  sizeInBytes: number;
  sessionStart?: number;
}

export interface SavedData {
  settings: NovelWordCountSettings;
  cachedCounts: Record<string, FileCounts>;
}

export const DEFAULT_SETTINGS: NovelWordCountSettings = {
  useAdvancedFormatting: false,
  countType: CountType.Word,
  countConfig: { customSuffix: "w", $sessionCountType: CountType.Word },
  countType2: CountType.None,
  countConfig2: { $sessionCountType: CountType.Word },
  countType3: CountType.None,
  countConfig3: { $sessionCountType: CountType.Word },
  pipeSeparator: "|",
  abbreviateDescriptions: false,
  alignment: AlignmentType.Inline,
  showSameCountsOnFolders: true,
  folderCountType: CountType.FileCount,
  folderCountConfig: { customSuffix: "f", $sessionCountType: CountType.Word },
  folderCountType2: CountType.None,
  folderCountConfig2: { $sessionCountType: CountType.Word },
  folderCountType3: CountType.None,
  folderCountConfig3: { $sessionCountType: CountType.Word },
  folderPipeSeparator: "|",
  folderAbbreviateDescriptions: false,
  folderAlignment: AlignmentType.Inline,
  showSameCountsOnRoot: true,
  rootCountType: CountType.FileCount,
  rootCountConfig: { customSuffix: "f", $sessionCountType: CountType.Word },
  rootCountType2: CountType.None,
  rootCountConfig2: { $sessionCountType: CountType.Word },
  rootCountType3: CountType.None,
  rootCountConfig3: { $sessionCountType: CountType.Word },
  rootPipeSeparator: "|",
  rootAbbreviateDescriptions: false,
  showAdvanced: false,
  labelOpacity: 0.75,
  characterCountType: CharacterCountType.StringLength,
  pageCountType: PageCountType.ByWords,
  wordsPerPage: 300,
  charsPerPage: 1500,
  charsPerPageIncludesWhitespace: false,
  includeDirectories: "",
  excludeComments: false,
  excludeCodeBlocks: false,
  excludeNonVisibleLinkPortions: false,
  excludeFootnotes: false,
  momentDateFormat: "",
  debugMode: false,
  formatNumbers: false,
  filterList: ["md"],
  blacklist: false,
};
