import { moment } from "obsidian";
import { FileSizeHelper } from "./filesize";
import {
  CountType,
  CountType as CountTypeConst,
  COUNT_TYPE_DEFAULT_SHORT_SUFFIXES,
  CountConfig,
  FileCounts,
  NovelWordCountSettings,
} from "./settings";
import { NumberFormatDefault } from "./locale_format";

interface CountTypeWithSuffix {
  $countType: CountType;
  customSuffix: string | null;
}

interface BasicCountConfig {
  count: string;
  noun: string;
  abbreviatedNoun: string | undefined;
  abbreviateDescriptions: boolean;
  customSuffix: string | null;
}

function getSuffix(key: string): string {
  return COUNT_TYPE_DEFAULT_SHORT_SUFFIXES[key] ?? "";
}

interface PluginLike {
  settings: NovelWordCountSettings;
}

export class NodeLabelHelper {
  fileSizeHelper = new FileSizeHelper();
  unconditionalCountTypes: CountType[] = [
    CountTypeConst.Created,
    CountTypeConst.FileSize,
    CountTypeConst.Modified,
  ];

  constructor(private plugin: PluginLike) {}

  private get settings(): NovelWordCountSettings {
    return this.plugin.settings;
  }

  getNodeLabel(counts: FileCounts): string {
    let countTypes: CountTypeWithSuffix[];
    let abbreviateDescriptions: boolean;
    let separator: string;

    const noteCountTypes = [
      this.getCountTypeWithSuffix(
        this.settings.countType,
        this.settings.countConfig
      ),
      this.getCountTypeWithSuffix(
        this.settings.countType2,
        this.settings.countConfig2
      ),
      this.getCountTypeWithSuffix(
        this.settings.countType3,
        this.settings.countConfig3
      ),
    ];
    const noteAbbreviateDescriptions = this.settings.abbreviateDescriptions;
    const noteSeparator = this.settings.useAdvancedFormatting
      ? this.settings.pipeSeparator
      : "|";

    switch (counts.targetNodeType) {
      case "root":
        if (this.settings.showSameCountsOnRoot) {
          countTypes = noteCountTypes;
          abbreviateDescriptions = noteAbbreviateDescriptions;
          separator = noteSeparator;
          break;
        }
        countTypes = [
          this.getCountTypeWithSuffix(
            this.settings.rootCountType,
            this.settings.rootCountConfig
          ),
          this.getCountTypeWithSuffix(
            this.settings.rootCountType2,
            this.settings.rootCountConfig2
          ),
          this.getCountTypeWithSuffix(
            this.settings.rootCountType3,
            this.settings.rootCountConfig3
          ),
        ];
        abbreviateDescriptions = this.settings.rootAbbreviateDescriptions;
        separator = this.settings.useAdvancedFormatting
          ? this.settings.rootPipeSeparator
          : noteSeparator;
        break;
      case "directory":
        if (this.settings.showSameCountsOnFolders) {
          countTypes = noteCountTypes;
          abbreviateDescriptions = noteAbbreviateDescriptions;
          separator = noteSeparator;
          break;
        }
        countTypes = [
          this.getCountTypeWithSuffix(
            this.settings.folderCountType,
            this.settings.folderCountConfig
          ),
          this.getCountTypeWithSuffix(
            this.settings.folderCountType2,
            this.settings.folderCountConfig2
          ),
          this.getCountTypeWithSuffix(
            this.settings.folderCountType3,
            this.settings.folderCountConfig3
          ),
        ];
        abbreviateDescriptions = this.settings.folderAbbreviateDescriptions;
        separator = this.settings.useAdvancedFormatting
          ? this.settings.folderPipeSeparator
          : noteSeparator;
        break;
      default:
        countTypes = noteCountTypes;
        abbreviateDescriptions = noteAbbreviateDescriptions;
        separator = noteSeparator;
        break;
    }

    return countTypes
      .filter((ct) => ct.$countType !== CountTypeConst.None)
      .map((ct) => this.getDataTypeLabel(counts, ct, abbreviateDescriptions))
      .filter((display) => display !== null)
      .join(` ${separator} `);
  }

  private getCountTypeWithSuffix(
    $countType: CountType,
    countConfig: CountConfig
  ): CountTypeWithSuffix {
    return {
      $countType,
      customSuffix: this.settings.useAdvancedFormatting
        ? countConfig.customSuffix ?? null
        : null,
    };
  }

  private getBasicCountString(config: BasicCountConfig): string {
    const defaultSuffix = config.abbreviateDescriptions
      ? config.abbreviatedNoun
      : ` ${config.noun}${config.count === "1" ? "" : "s"}`;
    const suffix = config.customSuffix ?? defaultSuffix;
    return `${config.count}${suffix}`;
  }

  private formatLargeNumber(num: number): string | null {
    if (!this.settings.formatNumbers) return null;
    if (num >= 10000)
      return (num / 10000).toFixed(1).replace(/\.0$/, "") + "w";
    if (num >= 1000)
      return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return null;
  }

  private getDataTypeLabel(
    counts: FileCounts,
    config: CountTypeWithSuffix,
    abbreviateDescriptions: boolean
  ): string | null {
    if (!counts || typeof counts.wordCount !== "number") return null;
    if (
      !counts.isCountable &&
      !this.unconditionalCountTypes.includes(config.$countType)
    ) {
      return null;
    }

    switch (config.$countType) {
      case CountTypeConst.None:
        return null;
      case CountTypeConst.Word: {
        const rawWord = Math.ceil(counts.wordCount);
        return this.getBasicCountString({
          count:
            this.formatLargeNumber(rawWord) ||
            NumberFormatDefault.format(rawWord),
          noun: "word",
          abbreviatedNoun: getSuffix(CountTypeConst.Word),
          abbreviateDescriptions,
          customSuffix: config.customSuffix,
        });
      }
      case CountTypeConst.Linebreak:
        return this.getBasicCountString({
          count: NumberFormatDefault.format(counts.newlineCount),
          noun: "line",
          abbreviatedNoun: getSuffix(CountTypeConst.Linebreak),
          abbreviateDescriptions,
          customSuffix: config.customSuffix,
        });
      case CountTypeConst.PercentGoal: {
        if (counts.wordGoal <= 0) return null;
        const fraction = counts.wordCountTowardGoal / counts.wordGoal;
        const percent = NumberFormatDefault.format(
          Math.round(fraction * 100)
        );
        const defaultSuffix = abbreviateDescriptions
          ? "%"
          : `% of ${NumberFormatDefault.format(counts.wordGoal)}`;
        const suffix = config.customSuffix ?? defaultSuffix;
        return `${percent}${suffix}`;
      }
      case CountTypeConst.Note:
        return this.getBasicCountString({
          count: NumberFormatDefault.format(counts.noteCount),
          noun: "note",
          abbreviatedNoun: getSuffix(CountTypeConst.Note),
          abbreviateDescriptions,
          customSuffix: config.customSuffix,
        });
      case CountTypeConst.Character: {
        const rawChar =
          this.settings.characterCountType === "ExcludeWhitespace"
            ? counts.nonWhitespaceCharacterCount
            : counts.characterCount;
        return this.getBasicCountString({
          count:
            this.formatLargeNumber(rawChar) ||
            NumberFormatDefault.format(rawChar),
          noun: "character",
          abbreviatedNoun: getSuffix(CountTypeConst.Character),
          abbreviateDescriptions,
          customSuffix: config.customSuffix,
        });
      }
      case CountTypeConst.Created: {
        if (counts.createdDate === 0) return null;
        const cDate = moment(counts.createdDate).format(
          this.settings.momentDateFormat || "YYYY/MM/DD"
        );
        if (config.customSuffix !== null) {
          return `${cDate}${config.customSuffix}`;
        }
        return abbreviateDescriptions
          ? `${cDate}/c`
          : `Created ${cDate}`;
      }
      case CountTypeConst.Modified: {
        if (counts.modifiedDate === 0) return null;
        const uDate = moment(counts.modifiedDate).format(
          this.settings.momentDateFormat || "YYYY/MM/DD"
        );
        if (config.customSuffix !== null) {
          return `${uDate}${config.customSuffix}`;
        }
        return abbreviateDescriptions
          ? `${uDate}/u`
          : `Updated ${uDate}`;
      }
      case CountTypeConst.FileSize:
        return this.fileSizeHelper.formatFileSize(
          counts.sizeInBytes,
          abbreviateDescriptions
        );
      case CountTypeConst.FileCount:
        return this.getBasicCountString({
          count: NumberFormatDefault.format(counts.noteCount),
          noun: "file",
          abbreviatedNoun: getSuffix(CountTypeConst.FileCount),
          abbreviateDescriptions,
          customSuffix: config.customSuffix,
        });
    }
    return null;
  }
}
