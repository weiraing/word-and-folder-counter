import { Plugin, debounce, Debouncer } from "obsidian";
import { DebugHelper } from "./logic/debug";
import { FileHelper } from "./logic/file";
import { EventHelper } from "./logic/event";
import { NodeLabelHelper } from "./logic/node_label";
import { SavedDataHelper } from "./logic/saved_data";
import { NovelWordCountSettingTab } from "./logic/settings.tab";
import {
  COUNT_TYPES,
  COUNT_TYPE_DISPLAY_STRINGS,
  ALIGNMENT_TYPES,
  SavedData,
  NovelWordCountSettings,
} from "./logic/settings";

export default class NovelWordCountPlugin extends Plugin {
  debugHelper = new DebugHelper();
  fileHelper: FileHelper;
  eventHelper: EventHelper;
  nodeLabelHelper: NodeLabelHelper;
  savedDataHelper: SavedDataHelper;
  savedData!: SavedData;
  FIVE_MINUTES = 5 * 60 * 1000;
  saveSettingsDebounced: Debouncer<[], Promise<void>>;

  constructor(app: any, manifest: any) {
    super(app, manifest);
    this.saveSettingsDebounced = debounce(
      this.saveSettings,
      this.FIVE_MINUTES,
      false
    );
    this.fileHelper = new FileHelper(this.app as any, this);
    this.eventHelper = new EventHelper(
      this,
      this.app as any,
      this.debugHelper,
      this.fileHelper
    );
    this.nodeLabelHelper = new NodeLabelHelper(this);
    this.savedDataHelper = new SavedDataHelper(this);
  }

  get settings(): NovelWordCountSettings {
    return this.savedData.settings;
  }

  async onload(): Promise<void> {
    this.savedData = await this.savedDataHelper.getSavedData();
    this.fileHelper.setDebugMode(this.savedData.settings.debugMode);
    this.debugHelper.setDebugMode(this.savedData.settings.debugMode);
    this.debugHelper.debug(`Detected locales: [${navigator.languages}]`);
    this.debugHelper.debug("onload lifecycle hook");

    this.addSettingTab(new NovelWordCountSettingTab(this.app as any, this));

    this.addCommand({
      id: "recount-vault",
      name: "重新计数所有笔记 / 重置会话",
      callback: async () => {
        this.debugHelper.debug("[Recount] command triggered");
        await this.initialize();
      },
    });

    this.addCommand({
      id: "cycle-count-type",
      name: "显示下一个数据类型（第1个位置）",
      callback: async () => {
        this.debugHelper.debug("[Cycle next data type] command triggered");
        const idx = COUNT_TYPES.indexOf(this.settings.countType);
        this.settings.countType =
          COUNT_TYPES[(idx + 1) % COUNT_TYPES.length]!;
        await this.saveSettings();
        this.updateDisplayedCounts();
      },
    });

    this.addCommand({
      id: "toggle-abbreviate",
      name: "切换笔记上的缩写显示",
      callback: async () => {
        this.debugHelper.debug(
          "[Toggle abbrevation - Notes] command triggered"
        );
        this.settings.abbreviateDescriptions =
          !this.settings.abbreviateDescriptions;
        await this.saveSettings();
        this.updateDisplayedCounts();
      },
    });

    for (const countType of COUNT_TYPES) {
      this.addCommand({
        id: `set-count-type-${countType}`,
        name: `显示 ${COUNT_TYPE_DISPLAY_STRINGS[countType]}（第1个位置）`,
        callback: async () => {
          this.debugHelper.debug(
            `[Set count type to ${countType}] command triggered`
          );
          this.settings.countType = countType;
          await this.saveSettings();
          this.updateDisplayedCounts();
        },
      });
    }

    this.eventHelper.handleEvents();
    this.initialize();
  }

  async onunload(): Promise<void> {
    await this.saveSettings();
  }

  async saveSettings(): Promise<void> {
    this.debugHelper.debug("Saving to data.json.");
    await this.saveData(this.savedData);
  }

  async initialize(reinitializeAllCounts = true): Promise<void> {
    this.debugHelper.debug("initialize");
    this.app.workspace.onLayoutReady(async () => {
      if (reinitializeAllCounts) {
        await this.eventHelper.reinitializeAllCounts();
      }
      try {
        await this.getFileExplorerLeaf();
        await this.updateDisplayedCounts();
      } catch (err) {
        this.debugHelper.debug("Error while updating displayed counts");
        this.debugHelper.debug(err);
        setTimeout(() => {
          this.initialize(false);
        }, 1000);
      }
    });
  }

  async updateDisplayedCounts(file: any = null): Promise<void> {
    const debugEnd = this.debugHelper.debugStart(
      `updateDisplayedCounts [${file == null ? "ALL" : file.path}]`
    );

    if (!Object.keys(this.savedData.cachedCounts).length) {
      this.debugHelper.debug("No cached data found; skipping update.");
      return;
    }

    let fileExplorerLeaf: any;
    try {
      fileExplorerLeaf = await this.getFileExplorerLeaf();
    } catch (err) {
      this.debugHelper.debug(
        "File explorer leaf not found; skipping update."
      );
      return;
    }

    const vaultCount = this.fileHelper.getCachedDataForPath(
      this.savedData.cachedCounts,
      "/"
    );

    document.documentElement.style.setProperty(
      "--novel-word-count-opacity",
      `${this.settings.labelOpacity}`
    );

    const drawers = [
      (this.app.workspace as any).leftSplit,
      (this.app.workspace as any).rightSplit,
    ];
    let hasMobileDrawer = false;

    for (const drawer of drawers) {
      this.setContainerClass(drawer.containerEl);
      if (!drawer?.fileCountEl) continue;
      drawer.fileCountEl.setAttribute(
        "data-novel-word-count-plugin",
        this.nodeLabelHelper.getNodeLabel(vaultCount)
      );
      hasMobileDrawer = true;
    }

    const fileExplorerView = fileExplorerLeaf.view;
    const fileItems = fileExplorerView.fileItems;

    if (
      !hasMobileDrawer &&
      fileExplorerView?.headerDom?.navButtonsEl
    ) {
      fileExplorerView.headerDom.navButtonsEl.setAttribute(
        "data-novel-word-count-plugin",
        this.nodeLabelHelper.getNodeLabel(vaultCount)
      );
    }

    if (file) {
      const relevantItems = Object.keys(fileItems).filter((path: string) =>
        file.path.includes(path)
      );
      this.debugHelper.debug(
        "Setting display counts for",
        relevantItems.length,
        "fileItems matching path",
        file.path
      );
    } else {
      this.debugHelper.debug(
        `Setting display counts for ${Object.keys(fileItems).length} fileItems`
      );
    }

    for (const path in fileItems) {
      if (file && (!file.path.includes(path) || file.path === "/")) {
        continue;
      }
      const counts = this.fileHelper.getCachedDataForPath(
        this.savedData.cachedCounts,
        path
      );
      const item = fileItems[path];
      (item.titleEl ?? item.selfEl).setAttribute(
        "data-novel-word-count-plugin",
        this.nodeLabelHelper.getNodeLabel(counts)
      );
    }

    debugEnd();
  }

  async getFileExplorerLeaf(): Promise<any> {
    return new Promise((resolve, reject) => {
      let foundLeaf: any = null;
      (this.app.workspace as any)
        .getLeavesOfType("file-explorer")
        .forEach((leaf: any) => {
          if (foundLeaf) return;
          const view = leaf.view;
          if (!view || !view.fileItems) return;
          foundLeaf = leaf;
          resolve(foundLeaf);
        });
      if (!foundLeaf) {
        reject(Error("Could not find file explorer leaf."));
      }
    });
  }

  private setContainerClass(container: any): void {
    if (!container) {
      this.debugHelper.debug(
        "No container was passed to setContainerClass"
      );
      return;
    }
    container.toggleClass("novel-word-count--active", true);
    const notePrefix = "novel-word-count--note-";
    const folderPrefix = "novel-word-count--folder-";
    const alignmentClasses = ALIGNMENT_TYPES.map(
      (at) => notePrefix + at
    ).concat(ALIGNMENT_TYPES.map((at) => folderPrefix + at));
    for (const ac of alignmentClasses) {
      container.toggleClass(ac, false);
    }
    container.toggleClass(notePrefix + this.settings.alignment, true);
    const folderAlignment = this.settings.showSameCountsOnFolders
      ? this.settings.alignment
      : this.settings.folderAlignment;
    container.toggleClass(folderPrefix + folderAlignment, true);
  }
}
