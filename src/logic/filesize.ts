import { NumberFormatFileSize } from "./locale_format";

interface FormatThreshold {
  suffix: string;
  suffixLong: string;
  divisor: number;
}

const formatThresholds: FormatThreshold[] = [
  { suffix: "B", suffixLong: " B", divisor: 1 },
  { suffix: "kB", suffixLong: " kB", divisor: 1e3 },
  { suffix: "MB", suffixLong: " MB", divisor: 1e6 },
  { suffix: "GB", suffixLong: " GB", divisor: 1e9 },
  { suffix: "TB", suffixLong: " TB", divisor: 1e12 },
];

export class FileSizeHelper {
  formatFileSize(bytes: number, shouldAbbreviate: boolean): string {
    const largestThreshold = formatThresholds[formatThresholds.length - 1];
    for (const formatThreshold of formatThresholds) {
      if (
        bytes < formatThreshold.divisor * 1e3 ||
        formatThreshold === largestThreshold
      ) {
        const units = bytes / formatThreshold.divisor;
        const suffix = shouldAbbreviate
          ? formatThreshold.suffix
          : formatThreshold.suffixLong;
        return `${NumberFormatFileSize.format(units)}${suffix}`;
      }
    }
    return "?B";
  }
}
