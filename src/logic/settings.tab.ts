import { App, PluginSettingTab, Setting, debounce } from "obsidian";
import {
  COUNT_TYPES,
  COUNT_TYPE_DISPLAY_STRINGS,
  COUNT_TYPE_DEFAULT_SHORT_SUFFIXES,
  UNFORMATTABLE_COUNT_TYPES,
  ALIGNMENT_TYPES,
  COUNT_TYPE_DESCRIPTIONS,
  getDescription,
  AlignmentType,
  CountType,
} from "./settings";

interface PluginLike {
  settings: any;
  saveSettings: () => Promise<void>;
  updateDisplayedCounts: (file?: any) => Promise<void>;
  initialize: (reinitializeAllCounts?: boolean) => Promise<void>;
  debugHelper: { setDebugMode: (v: boolean) => void };
  fileHelper: { setDebugMode: (v: boolean) => void };
}

export class NovelWordCountSettingTab extends PluginSettingTab {
  plugin: PluginLike;
  private activeTab = "notes";

  constructor(app: App, plugin: PluginLike) {
    super(app, plugin as any);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const style = containerEl.createEl("style");
    style.textContent = `
.novel-word-count-tab-bar { display:flex; border-bottom:1px solid var(--background-modifier-border); margin-bottom:16px; gap:0; }
.novel-word-count-tab { padding:8px 16px; cursor:pointer; border-bottom:2px solid transparent; color:var(--text-muted); user-select:none; }
.novel-word-count-tab:hover { color:var(--text-normal); }
.novel-word-count-tab-active { color:var(--text-accent); border-bottom-color:var(--text-accent); }
`;

    const tabBar = containerEl.createEl("div", {
      cls: "novel-word-count-tab-bar",
    });
    const tabs = [
      { id: "notes", label: "📃笔记" },
      { id: "folders", label: "📁文件夹" },
      { id: "root", label: "🗂️根目录" },
      { id: "other", label: "⚙️其他设置" },
    ];
    for (const tab of tabs) {
      const tabEl = tabBar.createEl("span", {
        text: tab.label,
        cls: `novel-word-count-tab ${
          this.activeTab === tab.id
            ? "novel-word-count-tab-active"
            : ""
        }`,
      });
      tabEl.addEventListener("click", () => {
        this.activeTab = tab.id;
        this.display();
      });
    }

    if (this.activeTab === "notes") {
      this.renderNoteSettings(containerEl);
    } else if (this.activeTab === "folders") {
      this.renderFolderSettings(containerEl);
    } else if (this.activeTab === "root") {
      this.renderRootSettings(containerEl);
    } else if (this.activeTab === "other") {
      this.renderDonationButton(containerEl);
      this.renderReanalyzeButton(containerEl);
      this.renderAdvancedSettings(containerEl);
    }
  }

  private renderNoteSettings(containerEl: HTMLElement): void {
    const headingSetting = new Setting(containerEl)
      .setHeading()
      .setName("笔记：您可以并排显示最多三种数据类型。");
    headingSetting.controlEl.createEl("span", {
      text: "使用高级格式",
      cls: "setting-item-description",
    });
    headingSetting.addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.useAdvancedFormatting)
        .onChange(async (value) => {
          this.plugin.settings.useAdvancedFormatting = value;
          await this.plugin.saveSettings();
          await this.plugin.updateDisplayedCounts();
          this.display();
        })
    );

    this.renderCountTypeSetting(containerEl, {
      name: "第 1 位数据",
      oldCountType: this.plugin.settings.countType,
      setNewCountType: (value: CountType) => {
        this.plugin.settings.countType = value;
        this.plugin.settings.countConfig.customSuffix =
          COUNT_TYPE_DEFAULT_SHORT_SUFFIXES[
            this.plugin.settings.countType
          ];
      },
    });
    this.renderCustomFormatSetting(containerEl, {
      countType: this.plugin.settings.countType,
      oldSuffix: this.plugin.settings.countConfig.customSuffix,
      setNewSuffix: (value: string) =>
        (this.plugin.settings.countConfig.customSuffix = value),
    });

    this.renderCountTypeSetting(containerEl, {
      name: "第 2 位数据",
      oldCountType: this.plugin.settings.countType2,
      setNewCountType: (value: CountType) => {
        this.plugin.settings.countType2 = value;
        this.plugin.settings.countConfig2.customSuffix =
          COUNT_TYPE_DEFAULT_SHORT_SUFFIXES[
            this.plugin.settings.countType2
          ];
      },
    });
    this.renderCustomFormatSetting(containerEl, {
      countType: this.plugin.settings.countType2,
      oldSuffix: this.plugin.settings.countConfig2.customSuffix,
      setNewSuffix: (value: string) =>
        (this.plugin.settings.countConfig2.customSuffix = value),
    });

    this.renderCountTypeSetting(containerEl, {
      name: "第 3 位数据",
      oldCountType: this.plugin.settings.countType3,
      setNewCountType: (value: CountType) => {
        this.plugin.settings.countType3 = value;
        this.plugin.settings.countConfig3.customSuffix =
          COUNT_TYPE_DEFAULT_SHORT_SUFFIXES[
            this.plugin.settings.countType3
          ];
      },
    });
    this.renderCustomFormatSetting(containerEl, {
      countType: this.plugin.settings.countType3,
      oldSuffix: this.plugin.settings.countConfig3.customSuffix,
      setNewSuffix: (value: string) =>
        (this.plugin.settings.countConfig3.customSuffix = value),
    });

    if (this.plugin.settings.useAdvancedFormatting) {
      new Setting(containerEl)
        .setName("数据类型分隔符")
        .addText((text) =>
          text
            .setValue(this.plugin.settings.pipeSeparator)
            .onChange(async (value) => {
              this.plugin.settings.pipeSeparator = value;
              await this.plugin.saveSettings();
              await this.plugin.updateDisplayedCounts();
            })
        );
    }

    if (!this.plugin.settings.useAdvancedFormatting) {
      new Setting(containerEl)
        .setName("缩写描述")
        .setDesc("例如显示 '120w' 而不是 '120 words'")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.abbreviateDescriptions)
            .onChange(async (value) => {
              this.plugin.settings.abbreviateDescriptions = value;
              await this.plugin.saveSettings();
              await this.plugin.updateDisplayedCounts();
            })
        );
    }

    new Setting(containerEl)
      .setName("对齐方式")
      .setDesc("在文件/文件夹名称旁内联显示、右对齐显示或在下方显示")
      .addDropdown((drop) => {
        drop
          .addOption("inline", "内联")
          .addOption("right", "右对齐")
          .addOption("below", "下方")
          .setValue(this.plugin.settings.alignment)
          .onChange(async (value: AlignmentType) => {
            this.plugin.settings.alignment = value;
            await this.plugin.saveSettings();
            await this.plugin.updateDisplayedCounts();
          });
      });
  }

  private renderFolderSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setHeading()
      .setName("文件夹：与笔记相同数据")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showSameCountsOnFolders)
          .onChange(async (value) => {
            this.plugin.settings.showSameCountsOnFolders = value;
            await this.plugin.saveSettings();
            this.display();
            await this.plugin.updateDisplayedCounts();
          })
      );

    if (!this.plugin.settings.showSameCountsOnFolders) {
      this.renderCountTypeSetting(containerEl, {
        name: "第 1 位数据",
        oldCountType: this.plugin.settings.folderCountType,
        setNewCountType: (value: CountType) => {
          this.plugin.settings.folderCountType = value;
          this.plugin.settings.folderCountConfig.customSuffix =
            COUNT_TYPE_DEFAULT_SHORT_SUFFIXES[
              this.plugin.settings.folderCountType
            ];
        },
      });
      this.renderCustomFormatSetting(containerEl, {
        countType: this.plugin.settings.folderCountType,
        oldSuffix:
          this.plugin.settings.folderCountConfig.customSuffix,
        setNewSuffix: (value: string) =>
          (this.plugin.settings.folderCountConfig.customSuffix =
            value),
      });

      this.renderCountTypeSetting(containerEl, {
        name: "第 2 位数据",
        oldCountType: this.plugin.settings.folderCountType2,
        setNewCountType: (value: CountType) => {
          this.plugin.settings.folderCountType2 = value;
          this.plugin.settings.folderCountConfig2.customSuffix =
            COUNT_TYPE_DEFAULT_SHORT_SUFFIXES[
              this.plugin.settings.folderCountType2
            ];
        },
      });
      this.renderCustomFormatSetting(containerEl, {
        countType: this.plugin.settings.folderCountType2,
        oldSuffix:
          this.plugin.settings.folderCountConfig2.customSuffix,
        setNewSuffix: (value: string) =>
          (this.plugin.settings.folderCountConfig2.customSuffix =
            value),
      });

      this.renderCountTypeSetting(containerEl, {
        name: "第 3 位数据",
        oldCountType: this.plugin.settings.folderCountType3,
        setNewCountType: (value: CountType) => {
          this.plugin.settings.folderCountType3 = value;
          this.plugin.settings.folderCountConfig3.customSuffix =
            COUNT_TYPE_DEFAULT_SHORT_SUFFIXES[
              this.plugin.settings.folderCountType3
            ];
        },
      });
      this.renderCustomFormatSetting(containerEl, {
        countType: this.plugin.settings.folderCountType3,
        oldSuffix:
          this.plugin.settings.folderCountConfig3.customSuffix,
        setNewSuffix: (value: string) =>
          (this.plugin.settings.folderCountConfig3.customSuffix =
            value),
      });

      if (this.plugin.settings.useAdvancedFormatting) {
        new Setting(containerEl)
          .setName("数据类型分隔符")
          .addText((text) =>
            text
              .setValue(this.plugin.settings.folderPipeSeparator)
              .onChange(async (value) => {
                this.plugin.settings.folderPipeSeparator = value;
                await this.plugin.saveSettings();
                await this.plugin.updateDisplayedCounts();
              })
          );
      }

      if (!this.plugin.settings.useAdvancedFormatting) {
        new Setting(containerEl)
          .setName("缩写描述")
          .addToggle((toggle) =>
            toggle
              .setValue(
                this.plugin.settings.folderAbbreviateDescriptions
              )
              .onChange(async (value) => {
                this.plugin.settings.folderAbbreviateDescriptions =
                  value;
                await this.plugin.saveSettings();
                await this.plugin.updateDisplayedCounts();
              })
          );
      }

      new Setting(containerEl)
        .setName("对齐方式")
        .addDropdown((drop) => {
          drop
            .addOption("inline", "内联")
            .addOption("right", "右对齐")
            .addOption("below", "下方")
            .setValue(this.plugin.settings.folderAlignment)
            .onChange(async (value: AlignmentType) => {
              this.plugin.settings.folderAlignment = value;
              await this.plugin.saveSettings();
              await this.plugin.updateDisplayedCounts();
            });
        });
    }
  }

  private renderRootSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setHeading()
      .setName("根目录：与笔记相同数据")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showSameCountsOnRoot)
          .onChange(async (value) => {
            this.plugin.settings.showSameCountsOnRoot = value;
            await this.plugin.saveSettings();
            this.display();
            await this.plugin.updateDisplayedCounts();
          })
      );

    if (!this.plugin.settings.showSameCountsOnRoot) {
      this.renderCountTypeSetting(containerEl, {
        name: "第 1 位数据",
        oldCountType: this.plugin.settings.rootCountType,
        setNewCountType: (value: CountType) => {
          this.plugin.settings.rootCountType = value;
          this.plugin.settings.rootCountConfig.customSuffix =
            COUNT_TYPE_DEFAULT_SHORT_SUFFIXES[
              this.plugin.settings.rootCountType
            ];
        },
      });
      this.renderCustomFormatSetting(containerEl, {
        countType: this.plugin.settings.rootCountType,
        oldSuffix:
          this.plugin.settings.rootCountConfig.customSuffix,
        setNewSuffix: (value: string) =>
          (this.plugin.settings.rootCountConfig.customSuffix =
            value),
      });

      this.renderCountTypeSetting(containerEl, {
        name: "第 2 位数据",
        oldCountType: this.plugin.settings.rootCountType2,
        setNewCountType: (value: CountType) => {
          this.plugin.settings.rootCountType2 = value;
          this.plugin.settings.rootCountConfig2.customSuffix =
            COUNT_TYPE_DEFAULT_SHORT_SUFFIXES[
              this.plugin.settings.rootCountType2
            ];
        },
      });
      this.renderCustomFormatSetting(containerEl, {
        countType: this.plugin.settings.rootCountType2,
        oldSuffix:
          this.plugin.settings.rootCountConfig2.customSuffix,
        setNewSuffix: (value: string) =>
          (this.plugin.settings.rootCountConfig2.customSuffix =
            value),
      });

      this.renderCountTypeSetting(containerEl, {
        name: "第 3 位数据",
        oldCountType: this.plugin.settings.rootCountType3,
        setNewCountType: (value: CountType) => {
          this.plugin.settings.rootCountType3 = value;
          this.plugin.settings.rootCountConfig3.customSuffix =
            COUNT_TYPE_DEFAULT_SHORT_SUFFIXES[
              this.plugin.settings.rootCountType3
            ];
        },
      });
      this.renderCustomFormatSetting(containerEl, {
        countType: this.plugin.settings.rootCountType3,
        oldSuffix:
          this.plugin.settings.rootCountConfig3.customSuffix,
        setNewSuffix: (value: string) =>
          (this.plugin.settings.rootCountConfig3.customSuffix =
            value),
      });

      if (this.plugin.settings.useAdvancedFormatting) {
        new Setting(containerEl)
          .setName("数据类型分隔符")
          .addText((text) =>
            text
              .setValue(this.plugin.settings.rootPipeSeparator)
              .onChange(async (value) => {
                this.plugin.settings.rootPipeSeparator = value;
                await this.plugin.saveSettings();
                await this.plugin.updateDisplayedCounts();
              })
          );
      }

      if (!this.plugin.settings.useAdvancedFormatting) {
        new Setting(containerEl)
          .setName("缩写描述")
          .addToggle((toggle) =>
            toggle
              .setValue(
                this.plugin.settings.rootAbbreviateDescriptions
              )
              .onChange(async (value) => {
                this.plugin.settings.rootAbbreviateDescriptions =
                  value;
                await this.plugin.saveSettings();
                await this.plugin.updateDisplayedCounts();
              })
          );
      }
    }
  }

  private renderAdvancedSettings(containerEl: HTMLElement): void {
    this.renderSeparator(containerEl);

    const includePathsChanged = async (txt: any, value: string) => {
      this.plugin.settings.includeDirectories = value;
      await this.plugin.saveSettings();
      await this.plugin.initialize();
    };

    new Setting(containerEl)
      .setHeading()
      .setName("参与计数的 文件/文件夹 名称")
      .setDesc(
        "只计算匹配指定文件、文件夹名称的路径，区分大小写，用换行分隔。默认为所有文件。"
      )
      .addTextArea((txt) => {
        txt
          .setPlaceholder("folderA\nfolderB\n!folderC")
          .setValue(this.plugin.settings.includeDirectories)
          .onChange(
            debounce(includePathsChanged.bind(this, txt), 1000)
          );
        txt.inputEl.rows = 4;
        txt.inputEl.cols = 25;
      });

    this.renderFilterOptions(containerEl);
    this.renderSeparator(containerEl);

    new Setting(containerEl)
      .setHeading()
      .setName("显示高级选项")
      .setDesc("语言兼容性和微调")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showAdvanced)
          .onChange(async (value) => {
            this.plugin.settings.showAdvanced = value;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (this.plugin.settings.showAdvanced) {
      const opacityChanged = async (value: number) => {
        this.plugin.settings.labelOpacity = Math.max(
          0,
          Math.min(value, 1)
        );
        await this.plugin.saveSettings();
        await this.plugin.updateDisplayedCounts();
      };

      new Setting(containerEl)
        .setName("标签不透明度")
        .setDesc(
          "增加此值使文件资源管理器中的所有计数标签更可见。"
        )
        .addSlider((slider) => {
          slider
            .setLimits(0, 1, 0.05)
            .setDynamicTooltip()
            .setValue(this.plugin.settings.labelOpacity)
            .onChange(
              debounce(opacityChanged.bind(this), 500)
            );
        });

      new Setting(containerEl)
        .setName("格式化数字显示")
        .setDesc("例如 2300 → 2.3k，12339 → 1.2w")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.formatNumbers)
            .onChange(async (value) => {
              this.plugin.settings.formatNumbers = value;
              await this.plugin.saveSettings();
              await this.plugin.updateDisplayedCounts();
            })
        );

      new Setting(containerEl)
        .setName("排除注释")
        .setDesc(
          "从计数中排除 %%Obsidian%% 和 <!--HTML--> 注释。可能会影响大型库的性能。"
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.excludeComments)
            .onChange(async (value) => {
              this.plugin.settings.excludeComments = value;
              await this.plugin.saveSettings();
              await this.plugin.initialize();
            })
        );

      new Setting(containerEl)
        .setName("排除代码块")
        .setDesc(
          "从所有计数中排除 ```代码块```（例如 DataView 代码片段）。可能会影响大型库的性能。"
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.excludeCodeBlocks)
            .onChange(async (value) => {
              this.plugin.settings.excludeCodeBlocks = value;
              await this.plugin.saveSettings();
              await this.plugin.initialize();
            })
        );

      new Setting(containerEl)
        .setName("排除链接的不可见部分")
        .setDesc(
          "对于外部链接，从所有计数中排除 URI。对于带别名的内部链接，只计算别名。可能会影响大型库的性能。"
        )
        .addToggle((toggle) =>
          toggle
            .setValue(
              this.plugin.settings.excludeNonVisibleLinkPortions
            )
            .onChange(async (value) => {
              this.plugin.settings.excludeNonVisibleLinkPortions =
                value;
              await this.plugin.saveSettings();
              await this.plugin.initialize();
            })
        );

      new Setting(containerEl)
        .setName("排除脚注")
        .setDesc(
          "从计数中排除脚注[^1]。可能会影响大型库的性能。"
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.excludeFootnotes)
            .onChange(async (value) => {
              this.plugin.settings.excludeFootnotes = value;
              await this.plugin.saveSettings();
              await this.plugin.initialize();
            })
        );

      new Setting(containerEl)
        .setName("字符计数方式")
        .setDesc("用于语言兼容性")
        .addDropdown((drop) => {
          drop
            .addOption("AllCharacters", "所有字符")
            .addOption("ExcludeWhitespace", "排除空格")
            .setValue(this.plugin.settings.characterCountType)
            .onChange(async (value) => {
              this.plugin.settings.characterCountType = value;
              await this.plugin.saveSettings();
              await this.plugin.initialize();
            });
        });

      const dateFormatChanged = async (txt: any, value: string) => {
        const isValid = typeof value === "string" && !!value.trim();
        this.plugin.settings.momentDateFormat = isValid
          ? value
          : "";
        await this.plugin.saveSettings();
        await this.plugin.initialize();
      };

      new Setting(containerEl)
        .setName("日期格式")
        .setDesc("用于日期字符串的 MomentJS 日期格式")
        .addText((txt) => {
          const datalistId = "nwc-date-format-datalist";
          if (!document.getElementById(datalistId)) {
            const datalist = document.createElement("datalist");
            datalist.id = datalistId;
            for (const preset of [
              "YYYY/MM/DD",
              "YYYY-MM-DD",
              "MM/DD/YYYY",
              "DD/MM/YYYY",
              "YYYY年MM月DD日",
              "YYYY.MM.DD",
            ]) {
              const opt = document.createElement("option");
              opt.value = preset;
              datalist.appendChild(opt);
            }
            document.body.appendChild(datalist);
          }
          txt.inputEl.setAttribute("list", datalistId);
          txt
            .setPlaceholder("YYYY/MM/DD")
            .setValue(this.plugin.settings.momentDateFormat)
            .onChange(
              debounce(dateFormatChanged.bind(this, txt), 1000)
            );
        });

      new Setting(containerEl)
        .setName("调试模式")
        .setDesc("将调试信息记录到开发者控制台")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.debugMode)
            .onChange(async (value) => {
              this.plugin.settings.debugMode = value;
              this.plugin.debugHelper.setDebugMode(value);
              this.plugin.fileHelper.setDebugMode(value);
              await this.plugin.saveSettings();
            })
        );
    }
  }

  private renderReanalyzeButton(containerEl: HTMLElement): void {
    this.renderSeparator(containerEl);
    new Setting(containerEl)
      .setHeading()
      .setName("重新计数所有文档")
      .setDesc(
        "如果在 Obsidian 之外发生了更改，您可能需要触发手动重新计数"
      )
      .addButton((button) =>
        button
          .setButtonText("重新计数")
          .setCta()
          .onClick(async () => {
            button.disabled = true;
            await this.plugin.initialize();
            button.setButtonText("完成");
            button.removeCta();
            setTimeout(() => {
              button.setButtonText("重新计数");
              button.setCta();
              button.disabled = false;
            }, 1000);
          })
      );
  }

  private renderDonationButton(containerEl: HTMLElement): void {
    const label = containerEl.createEl("div", {
      cls: [
        "setting-item",
        "setting-item-heading",
        "novel-word-count-settings-header",
        "novel-word-count-donation-line",
      ],
    });
    label.createEl("div", {
      text: "喜欢这个插件吗？想要更多功能吗？",
    });
    const button = label.createEl("div");
    button.innerHTML = `<a href='https://ko-fi.com/J3J6OWA5C' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi2.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>`;
  }

  private renderCountTypeSetting(
    containerEl: HTMLElement,
    config: {
      name: string;
      oldCountType: string;
      setNewCountType: (value: CountType) => void;
    }
  ): void {
    new Setting(containerEl)
      .setName(config.name)
      .setDesc(getDescription(config.oldCountType as CountType))
      .addDropdown((drop) => {
        for (const countType of COUNT_TYPES) {
          drop.addOption(
            countType,
            COUNT_TYPE_DISPLAY_STRINGS[countType]
          );
        }
        drop.setValue(config.oldCountType).onChange(async (value: CountType) => {
          config.setNewCountType(value);
          await this.plugin.saveSettings();
          this.display();
          await this.plugin.updateDisplayedCounts();
        });
      });
  }

  private renderCustomFormatSetting(
    containerEl: HTMLElement,
    config: {
      countType: string;
      oldSuffix: string | undefined;
      setNewSuffix: (value: string) => void;
    }
  ): void {
    if (
      !this.plugin.settings.useAdvancedFormatting ||
      config.countType === "none"
    ) {
      return;
    }
    if (UNFORMATTABLE_COUNT_TYPES.includes(config.countType as CountType)) {
      new Setting(containerEl).setDesc(
        `[${
          COUNT_TYPE_DISPLAY_STRINGS[config.countType as CountType]
        }] 无法格式化。`
      );
    } else {
      new Setting(containerEl)
        .setDesc(
          `[${
            COUNT_TYPE_DISPLAY_STRINGS[config.countType as CountType]
          }] 自定义后缀`
        )
        .addText((text) =>
          text
            .setValue(config.oldSuffix ?? "")
            .onChange(async (value) => {
              config.setNewSuffix(value);
              await this.plugin.saveSettings();
              await this.plugin.updateDisplayedCounts();
            })
        );
    }
  }

  private renderFilterOptions(containerEl: HTMLElement): void {
    this.renderSeparator(containerEl);
    new Setting(containerEl)
      .setHeading()
      .setName("参与计数的 笔记 格式")
      .setDesc(
        "每行一个文件后缀，不区分大小写。空=仅 markdown格式。!开头=排除该后缀"
      )
      .addTextArea((text) => {
        const onChange = async (value: string) => {
          const list = value
            .split("\n")
            .map((v) => v.trim())
            .filter((v) => v);
          this.plugin.settings.filterList = list;
          this.plugin.saveSettings();
          this.plugin.initialize();
        };
        text
          .setPlaceholder("md\njson\n!txt\n!canvas")
          .setValue(this.plugin.settings.filterList.join("\n"))
          .onChange(debounce(onChange, 500, true));
        text.inputEl.rows = 4;
        text.inputEl.cols = 25;
      });
  }

  private renderSeparator(containerEl: HTMLElement): void {
    containerEl.createEl("hr", {
      cls: "novel-word-count-hr",
    });
  }
}
