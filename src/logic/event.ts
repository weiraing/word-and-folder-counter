import { debounce, TFolder, Debouncer } from "obsidian";
import { CancellationTokenSource } from "./cancellation";
import { DebugHelper } from "./debug";
import { FileHelper } from "./file";
import { SavedData, NovelWordCountSettings } from "./settings";
import { NodeLabelHelper } from "./node_label";
import { SavedDataHelper } from "./saved_data";

interface PluginLike {
  savedData: SavedData;
  settings: NovelWordCountSettings;
  updateDisplayedCounts: (file?: any) => Promise<void>;
  saveSettings: () => Promise<void>;
  saveSettingsDebounced: Debouncer<[], Promise<void>>;
  getFileExplorerLeaf: () => Promise<any>;
  debugHelper: DebugHelper;
  fileHelper: FileHelper;
  nodeLabelHelper: NodeLabelHelper;
  savedDataHelper: SavedDataHelper;
  registerEvent: (event: any) => void;
}

interface AppLike {
  metadataCache: {
    on: (event: string, callback: (...args: any[]) => any) => void;
  };
  vault: {
    on: (event: string, callback: (...args: any[]) => any) => void;
  };
  workspace: {
    on: (event: string, callback: (...args: any[]) => any) => void;
    onLayoutReady: (callback: () => void) => void;
  };
}

export class EventHelper {
  private cancellationSources: CancellationTokenSource[] = [];

  constructor(
    private plugin: PluginLike,
    private app: AppLike,
    private debugHelper: DebugHelper,
    private fileHelper: FileHelper
  ) {}

  async handleEvents(): Promise<void> {
    const debouncedFileModified = debounce(
      async (file: any) => {
        const countToken = this.registerNewCountToken();
        await this.fileHelper.updateFileCounts(
          file,
          this.plugin.savedData.cachedCounts,
          countToken.token
        );
        this.cancelToken(countToken);
        await this.plugin.updateDisplayedCounts(file);
        this.plugin.saveSettingsDebounced();
      },
      500
    );

    this.plugin.registerEvent(
      this.app.metadataCache.on("changed", async (file: any) => {
        this.debugHelper.debug(
          "[changed] metadataCache hook fired, scheduling file for analysis",
          file.path
        );
        debouncedFileModified(file);
      })
    );

    this.app.workspace.onLayoutReady(() => {
      this.plugin.registerEvent(
        this.app.vault.on("create", async (file: any) => {
          this.debugHelper.debug(
            "[create] vault hook fired, analyzing file",
            file.path
          );
          const countToken = this.registerNewCountToken();
          await this.fileHelper.updateFileCounts(
            file,
            this.plugin.savedData.cachedCounts,
            countToken.token
          );
          this.cancelToken(countToken);
          await this.plugin.updateDisplayedCounts(file);
          await this.plugin.saveSettings();
        })
      );

      this.plugin.registerEvent(
        this.app.vault.on("modify", async (file: any) => {
          this.debugHelper.debug(
            "[modify] vault hook fired, scheduling file for analysis",
            file.path
          );
          debouncedFileModified(file);
        })
      );
    });

    this.plugin.registerEvent(
      this.app.vault.on("delete", async (file: any) => {
        this.debugHelper.debug(
          "[delete] vault hook fired, forgetting file",
          file.path
        );
        this.fileHelper.removeFileCounts(
          file.path,
          this.plugin.savedData.cachedCounts
        );
        await this.plugin.updateDisplayedCounts(file);
        await this.plugin.saveSettings();
      })
    );

    this.plugin.registerEvent(
      this.app.vault.on("rename", async (file: any, oldPath: string) => {
        if (file instanceof TFolder) return;
        this.debugHelper.debug(
          "[rename] vault hook fired, recounting file",
          file.path
        );
        this.fileHelper.removeFileCounts(
          oldPath,
          this.plugin.savedData.cachedCounts
        );
        const countToken = this.registerNewCountToken();
        await this.fileHelper.updateFileCounts(
          file,
          this.plugin.savedData.cachedCounts,
          countToken.token
        );
        this.cancelToken(countToken);
        await this.plugin.updateDisplayedCounts(file);
        await this.plugin.saveSettings();
      })
    );

    const reshowCountsIfNeeded = async (hookName: string) => {
      this.debugHelper.debug(`[${hookName}] hook fired`);
      const fileExplorerLeaf = await this.plugin.getFileExplorerLeaf();
      if (this.isContainerTouched(fileExplorerLeaf)) {
        this.debugHelper.debug(
          "container already touched, skipping display update"
        );
        return;
      }
      this.debugHelper.debug("container is clean, updating display");
      await this.plugin.updateDisplayedCounts();
    };

    this.plugin.registerEvent(
      this.app.workspace.on(
        "layout-change",
        debounce(
          reshowCountsIfNeeded.bind(this, "layout-change"),
          1000
        )
      )
    );
  }

  private isContainerTouched(leaf: any): boolean {
    const container = leaf.view.containerEl;
    return container.className.includes("novel-word-count--");
  }

  async reinitializeAllCounts(): Promise<void> {
    this.cancelAllCountTokens();
    const countToken = this.registerNewCountToken();
    this.debugHelper.debug("refreshAllCounts");
    this.plugin.savedData.cachedCounts =
      await this.fileHelper.initializeAllFileCounts(countToken.token);
    this.cancelToken(countToken);
    await this.plugin.saveSettings();
  }

  private registerNewCountToken(): CancellationTokenSource {
    const cancellationSource = new CancellationTokenSource();
    this.cancellationSources.push(cancellationSource);
    return cancellationSource;
  }

  private cancelToken(source: CancellationTokenSource): void {
    source.cancel();
    const idx = this.cancellationSources.indexOf(source);
    if (idx !== -1) {
      this.cancellationSources.splice(idx, 1);
    }
  }

  private cancelAllCountTokens(): void {
    for (const source of this.cancellationSources) {
      source.cancel();
    }
    this.cancellationSources = [];
  }
}
