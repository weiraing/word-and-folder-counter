import { DebugHelper } from "./debug";
import { TFile } from "obsidian";

export class CanvasHelper {
  constructor(private debug: DebugHelper) {}

  getCanvasText(file: TFile, content: string): string {
    try {
      const canvas = JSON.parse(content);
      const texts: string[] = canvas.nodes
        .map((node: { text?: string }) => node.text)
        .filter((text: string | undefined) => !!text);
      return texts.join("\n");
    } catch (ex) {
      this.debug.error(`Unable to parse canvas file [${file.name}]: ${ex}`);
      return "";
    }
  }
}
