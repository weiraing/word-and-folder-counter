import {
  DEFAULT_SETTINGS,
  COUNT_TYPES,
  CountType,
  SavedData,
  NovelWordCountSettings,
} from "./settings";

export class SavedDataHelper {
  constructor(private plugin: { loadData: () => Promise<SavedData | null> }) {}

  async getSavedData(): Promise<SavedData> {
    const loaded = await this.plugin.loadData();
    const denulled = Object.assign({}, loaded) as SavedData;
    denulled.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      denulled.settings
    ) as NovelWordCountSettings;
    const migrated = migrateSavedData(denulled);
    return migrated;
  }
}

function migrateSavedData(saved: SavedData): SavedData {
  const migrations: Array<(s: SavedData) => SavedData> = [
    overwriteInvalidCountTypes,
    migrateToCountConfigurationObject,
  ];
  for (const migrate of migrations) {
    saved = migrate(saved);
  }
  return saved;
}

const overwriteInvalidCountTypes = (saved: SavedData): SavedData => {
  if (!saved?.settings?.countType) return saved;
  const fieldsToCheck: (keyof NovelWordCountSettings)[] = [
    "countType",
    "countType2",
    "countType3",
    "folderCountType",
    "folderCountType2",
    "folderCountType3",
    "rootCountType",
    "rootCountType2",
    "rootCountType3",
  ];
  for (const field of fieldsToCheck) {
    const val = saved.settings[field] as string;
    if (!COUNT_TYPES.includes(val as CountType)) {
      (saved.settings[field] as CountType) =
        field === "countType" ? CountType.Word : CountType.None;
    }
  }
  return saved;
};

interface OldSettings extends NovelWordCountSettings {
  countTypeSuffix?: string;
  countType2Suffix?: string;
  countType3Suffix?: string;
  folderCountTypeSuffix?: string;
  folderCountType2Suffix?: string;
  folderCountType3Suffix?: string;
  rootCountTypeSuffix?: string;
  rootCountType2Suffix?: string;
  rootCountType3Suffix?: string;
}

const migrateToCountConfigurationObject = (saved: SavedData): SavedData => {
  const settings = saved.settings;
  const oldSettings = settings as OldSettings;

  settings.countConfig ??= {};
  if (typeof oldSettings.countTypeSuffix === "string") {
    settings.countConfig.customSuffix = oldSettings.countTypeSuffix;
    delete oldSettings.countTypeSuffix;
  }

  settings.countConfig2 ??= {};
  if (typeof oldSettings.countType2Suffix === "string") {
    settings.countConfig2.customSuffix = oldSettings.countType2Suffix;
    delete oldSettings.countType2Suffix;
  }

  settings.countConfig3 ??= {};
  if (typeof oldSettings.countType3Suffix === "string") {
    settings.countConfig3.customSuffix = oldSettings.countType3Suffix;
    delete oldSettings.countType3Suffix;
  }

  settings.folderCountConfig ??= {};
  if (typeof oldSettings.folderCountTypeSuffix === "string") {
    settings.folderCountConfig.customSuffix = oldSettings.folderCountTypeSuffix;
    delete oldSettings.folderCountTypeSuffix;
  }

  settings.folderCountConfig2 ??= {};
  if (typeof oldSettings.folderCountType2Suffix === "string") {
    settings.folderCountConfig2.customSuffix =
      oldSettings.folderCountType2Suffix;
    delete oldSettings.folderCountType2Suffix;
  }

  settings.folderCountConfig3 ??= {};
  if (typeof oldSettings.folderCountType3Suffix === "string") {
    settings.folderCountConfig3.customSuffix =
      oldSettings.folderCountType3Suffix;
    delete oldSettings.folderCountType3Suffix;
  }

  settings.rootCountConfig ??= {};
  if (typeof oldSettings.rootCountTypeSuffix === "string") {
    settings.rootCountConfig.customSuffix = oldSettings.rootCountTypeSuffix;
    delete oldSettings.rootCountTypeSuffix;
  }

  settings.rootCountConfig2 ??= {};
  if (typeof oldSettings.rootCountType2Suffix === "string") {
    settings.rootCountConfig2.customSuffix = oldSettings.rootCountType2Suffix;
    delete oldSettings.rootCountType2Suffix;
  }

  settings.rootCountConfig3 ??= {};
  if (typeof oldSettings.rootCountType3Suffix === "string") {
    settings.rootCountConfig3.customSuffix = oldSettings.rootCountType3Suffix;
    delete oldSettings.rootCountType3Suffix;
  }

  return saved;
};
