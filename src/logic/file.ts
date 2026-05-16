import { TFile, TFolder, Vault, MetadataCache, getAllTags } from "obsidian";
import { DebugHelper } from "./debug";
import { CanvasHelper } from "./canvas";
import { countMarkdown } from "./parser";
import {
  FileCounts,
  NovelWordCountSettings,
  SavedData,
  TargetNodeType,
} from "./settings";

interface PluginLike {
  settings: NovelWordCountSettings;
  savedData: SavedData;
}

export class FileHelper {
  debugHelper = new DebugHelper();
  canvasHelper = new CanvasHelper(this.debugHelper);
  pathIncludeMatchers: string[] = [];
  pathExcludeMatchers: string[] = [];
  FileTypeAllowlist = new Set([
    "",
    "markdown",
    "md",
    "mdml",
    "mdown",
    "mdtext",
    "mdtxt",
    "mdwn",
    "mkd",
    "mkdn",
    "canvas",
    "txt",
    "text",
    "rtf",
    "qmd",
    "rmd",
    "fountain",
    "tex",
  ]);

  constructor(
    private app: { vault: Vault; metadataCache: MetadataCache },
    private plugin: PluginLike
  ) {}

  private get settings(): NovelWordCountSettings {
    return this.plugin.settings;
  }

  private get vault(): Vault {
    return this.app.vault;
  }

  async initializeAllFileCounts(
    cancellationToken: { isCancelled: boolean }
  ): Promise<Record<string, FileCounts>> {
    const debugEnd = this.debugHelper.debugStart("getAllFileCounts");
    const files = this.vault.getFiles();

    if (
      typeof this.settings.includeDirectories === "string" &&
      this.settings.includeDirectories.trim() !== "*" &&
      this.settings.includeDirectories.trim() !== ""
    ) {
      const allMatchers = this.settings.includeDirectories
        .trim()
        .split("\n")
        .map((m) => m.trim());
      const includeMatchers = allMatchers.filter((m) => !m.startsWith("!"));
      const excludeMatchers = allMatchers
        .filter((m) => m.startsWith("!"))
        .map((m) => m.slice(1));
      const matchedFiles = files.filter(
        (file) =>
          (includeMatchers.length === 0
            ? true
            : includeMatchers.some((matcher) => file.path.includes(matcher))) &&
          !excludeMatchers.some((matcher) => file.path.includes(matcher))
      );
      if (matchedFiles.length > 0) {
        this.pathIncludeMatchers = includeMatchers;
        this.pathExcludeMatchers = excludeMatchers;
      } else {
        this.pathIncludeMatchers = [];
        this.pathExcludeMatchers = [];
        this.debugHelper.debug(
          "No files matched by includeDirectories setting. Defaulting to all files."
        );
      }
    }

    const counts: Record<string, FileCounts> = {};
    for (const file of files) {
      if (cancellationToken.isCancelled) break;
      await this.setCounts(counts, file, true);
    }
    debugEnd();
    return counts;
  }

  getCachedDataForPath(
    counts: Record<string, FileCounts>,
    path: string
  ): FileCounts {
    if (counts.hasOwnProperty(path)) {
      return counts[path]!;
    }

    const childPaths = this.getChildPaths(counts, path);
    const directoryDefault: FileCounts = {
      isCountable: false,
      targetNodeType: this.isRoot(path)
        ? ("root" as TargetNodeType)
        : ("directory" as TargetNodeType),
      noteCount: 0,
      wordCount: 0,
      wordCountTowardGoal: 0,
      wordGoal: 0,
      pageCount: 0,
      characterCount: 0,
      nonWhitespaceCharacterCount: 0,
      newlineCount: 0,
      createdDate: 0,
      modifiedDate: 0,
      sizeInBytes: 0,
    };

    return childPaths.reduce((total, childPath) => {
      const childCount = this.getCachedDataForPath(counts, childPath);
      return {
        isCountable: total.isCountable || childCount.isCountable,
        targetNodeType: total.targetNodeType,
        noteCount: total.noteCount + childCount.noteCount,
        wordCount: total.wordCount + childCount.wordCount,
        wordCountTowardGoal:
          total.wordCountTowardGoal + childCount.wordCountTowardGoal,
        wordGoal: total.wordGoal + childCount.wordGoal,
        pageCount: total.pageCount + childCount.pageCount,
        characterCount: total.characterCount + childCount.characterCount,
        nonWhitespaceCharacterCount:
          total.nonWhitespaceCharacterCount +
          childCount.nonWhitespaceCharacterCount,
        newlineCount: total.newlineCount + childCount.newlineCount,
        createdDate:
          total.createdDate === 0
            ? childCount.createdDate
            : Math.min(total.createdDate, childCount.createdDate),
        modifiedDate: Math.max(
          total.modifiedDate,
          childCount.modifiedDate
        ),
        sizeInBytes: total.sizeInBytes + childCount.sizeInBytes,
      };
    }, directoryDefault);
  }

  setDebugMode(debug: boolean): void {
    this.debugHelper.setDebugMode(debug);
  }

  removeFileCounts(
    path: string,
    counts: Record<string, FileCounts>
  ): void {
    this.removeCounts(counts, path);
    for (const childPath of this.getChildPaths(counts, path)) {
      this.removeCounts(counts, childPath);
    }
  }

  async updateFileCounts(
    abstractFile: any,
    counts: Record<string, FileCounts>,
    cancellationToken: { isCancelled: boolean }
  ): Promise<void> {
    if (abstractFile instanceof TFolder) {
      for (const child of abstractFile.children) {
        await this.updateFileCounts(child, counts, cancellationToken);
      }
      return;
    }
    if (abstractFile instanceof TFile) {
      await this.setCounts(counts, abstractFile, false);
    }
  }

  private getChildPaths(
    counts: Record<string, FileCounts>,
    path: string
  ): string[] {
    return Object.keys(counts).filter(
      (countPath) =>
        path === "/" || countPath.startsWith(path + "/")
    );
  }

  private isRoot(path: string): boolean {
    return !path || path === "/";
  }

  private removeCounts(
    counts: Record<string, FileCounts>,
    path: string
  ): void {
    delete counts[path];
  }

  private async setCounts(
    counts: Record<string, FileCounts>,
    file: TFile,
    startNewSession: boolean
  ): Promise<void> {
    const metadata = this.app.metadataCache.getFileCache(file);
    const shouldCountFile = this.shouldCountFile(file, metadata);
    const existingSession = counts[file.path]?.sessionStart;

    counts[file.path] = {
      isCountable: shouldCountFile,
      targetNodeType: "file" as TargetNodeType,
      noteCount: 0,
      wordCount: 0,
      wordCountTowardGoal: 0,
      wordGoal: 0,
      pageCount: 0,
      characterCount: 0,
      nonWhitespaceCharacterCount: 0,
      newlineCount: 0,
      createdDate: file.stat.ctime,
      modifiedDate: file.stat.mtime,
      sizeInBytes: file.stat.size,
    };

    if (!shouldCountFile) return;

    let content = await this.vault.cachedRead(file);
    if (file.extension.toLowerCase() === "canvas") {
      content = this.canvasHelper.getCanvasText(file, content);
    } else {
      content = this.trimFrontmatter(content, metadata);
    }

    const countResult = countMarkdown(content, {
      excludeCodeBlocks: this.settings.excludeCodeBlocks,
      excludeComments: this.settings.excludeComments,
      excludeNonVisibleLinkPortions:
        this.settings.excludeNonVisibleLinkPortions,
      excludeFootnotes: this.settings.excludeFootnotes,
    });

    const combinedWordCount =
      countResult.cjkWordCount + countResult.spaceDelimitedWordCount;
    const wordGoal = this.getWordGoal(metadata);
    let pageCount = 0;

    if (this.settings.pageCountType === "ByWords") {
      const wordsPerPage = Number(this.settings.wordsPerPage);
      const wordsPerPageValid = !isNaN(wordsPerPage) && wordsPerPage > 0;
      pageCount = combinedWordCount / (wordsPerPageValid ? wordsPerPage : 300);
    } else if (
      this.settings.pageCountType === "ByChars" &&
      !this.settings.charsPerPageIncludesWhitespace
    ) {
      const charsPerPage = Number(this.settings.charsPerPage);
      const charsPerPageValid = !isNaN(charsPerPage) && charsPerPage > 0;
      pageCount =
        countResult.nonWhitespaceCharCount /
        (charsPerPageValid ? charsPerPage : 1500);
    } else if (
      this.settings.pageCountType === "ByChars" &&
      this.settings.charsPerPageIncludesWhitespace
    ) {
      const charsPerPage = Number(this.settings.charsPerPage);
      const charsPerPageValid = !isNaN(charsPerPage) && charsPerPage > 0;
      pageCount =
        countResult.charCount /
        (charsPerPageValid ? charsPerPage : 1500);
    }

    Object.assign(counts[file.path]!, {
      noteCount: 1,
      wordCount: combinedWordCount,
      wordCountTowardGoal: wordGoal !== null ? combinedWordCount : 0,
      wordGoal,
      pageCount,
      characterCount: countResult.charCount,
      nonWhitespaceCharacterCount: countResult.nonWhitespaceCharCount,
      newlineCount: countResult.newlineCount,
    });
  }

  private getWordGoal(
    metadata: ReturnType<MetadataCache["getFileCache"]>
  ): number | null {
    const goal =
      metadata &&
      metadata.frontmatter &&
      (metadata.frontmatter as Record<string, unknown>)["word-goal"];
    if (!goal || isNaN(Number(goal))) return null;
    return Number(goal);
  }

  private trimFrontmatter(
    content: string,
    metadata: ReturnType<MetadataCache["getFileCache"]>
  ): string {
    let meaningfulContent = content;
    const hasFrontmatter = !!metadata && !!metadata.frontmatter;
    if (hasFrontmatter) {
    const frontmatterPos =
      (metadata as any)?.frontmatterPosition ||
      (metadata as any)?.frontmatter?.position;
    meaningfulContent =
      frontmatterPos &&
      frontmatterPos.start &&
      frontmatterPos.end
          ? meaningfulContent.slice(0, frontmatterPos.start.offset) +
            meaningfulContent.slice(frontmatterPos.end.offset)
          : meaningfulContent;
    }
    return meaningfulContent;
  }

  private shouldCountFile(
    file: TFile,
    metadata: ReturnType<MetadataCache["getFileCache"]>
  ): boolean {
    if (
      this.pathIncludeMatchers.length > 0 &&
      !this.pathIncludeMatchers.some((matcher) =>
        file.path.includes(matcher)
      )
    ) {
      return false;
    }
    if (
      this.pathExcludeMatchers.length > 0 &&
      this.pathExcludeMatchers.some((matcher) =>
        file.path.includes(matcher)
      )
    ) {
      return false;
    }
    if (!this.FileTypeAllowlist.has(file.extension.toLowerCase())) {
      return false;
    }

    const filterList = this.settings.filterList;
    const extension = file.extension.toLowerCase();
    const includeExts: string[] = [];
    const excludeExts: string[] = [];
    for (const entry of filterList) {
      if (entry.startsWith("!")) {
        excludeExts.push(entry.slice(1).toLowerCase());
      } else {
        includeExts.push(entry.toLowerCase());
      }
    }
    if (excludeExts.includes(extension)) return false;
    if (filterList.length === 0) {
      if (extension !== "md") return false;
    } else if (includeExts.length > 0 && !includeExts.includes(extension)) {
      return false;
    }

    if (!metadata) return true;
    if (
      metadata.frontmatter &&
      (metadata.frontmatter as Record<string, unknown>).hasOwnProperty(
        "wordcount"
      ) &&
      ((metadata.frontmatter as Record<string, unknown>).wordcount === null ||
        (metadata.frontmatter as Record<string, unknown>).wordcount ===
          false ||
        (metadata.frontmatter as Record<string, unknown>).wordcount ===
          "false")
    ) {
      return false;
    }

    const allTags = getAllTags(metadata!) ?? [];
    const tags = allTags.map((tag: string) =>
      tag.toLowerCase()
    );
    if (
      tags.length &&
      (tags.includes("#excalidraw") ||
        tags
          .filter((tag: string) => tag.startsWith("#exclude"))
          .map((tag: string) => tag.replace(/[-_]/g, ""))
          .includes("#excludefromwordcount"))
    ) {
      return false;
    }

    return true;
  }
}
