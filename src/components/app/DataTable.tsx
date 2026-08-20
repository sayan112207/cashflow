import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Truncation only bites when the column has a ceiling, so text columns opt in
 * to one. These are Tailwind's own sizing steps, not arbitrary widths.
 */
const MAX_WIDTH_CLASSES = {
  xs: "max-w-xs",
  sm: "max-w-sm",
  md: "max-w-md",
} as const;

type BaseColumn = {
  id: string;
  /**
   * Empty string means a genuinely unheaded column. Spec §9 requires the Chase
   * now table to announce exactly seven headers, so the action column's `<th>`
   * has to be empty rather than carrying hidden text.
   */
  header: string;
  /** `right` for money and counts, so digits line up under the header. */
  align?: "left" | "right";
  /** For action columns, where a visible header would be noise. */
  headerHidden?: boolean;
  /** A control in the header cell, e.g. select-all. Renders after the label. */
  headerCell?: () => ReactNode;
};

type TextColumn<Row> = BaseColumn & {
  text: (row: Row) => string;
  truncateAt?: keyof typeof MAX_WIDTH_CLASSES;
  cell?: never;
};

type NodeColumn<Row> = BaseColumn & {
  cell: (row: Row) => ReactNode;
  text?: never;
  truncateAt?: never;
};

/**
 * A column is either plain text or a rendered node, never both. Text columns
 * get truncation and a `title` for free; node columns are for badges and
 * buttons, where truncating would be wrong.
 */
export type Column<Row> = TextColumn<Row> | NodeColumn<Row>;

type DataTableProps<Row> = {
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  isRowSelected?: (row: Row) => boolean;
};

/**
 * Wraps `ui/table`. The horizontal scroll container the spec asks for is the
 * primitive's own `overflow-auto` wrapper — adding a second one here would
 * nest two scrollers and the outer would never engage.
 *
 * `min-w-max` stops columns compressing: the table is as wide as its content,
 * and the wrapper scrolls when that is wider than the pane. Spec §9 names
 * 1100px as the breakpoint; there is no 1100px token, so this is content-driven
 * rather than a fake floor that would scroll a 1280px laptop for no reason.
 *
 * The shell's `min-w-0` is what lets the wrapper actually shrink so this
 * min-width can overflow.
 *
 * Row height is padding-driven: the spec names a `--row-h` token that the
 * tokens file does not define, so `py-3` stands in at 12px.
 */
export function DataTable<Row>({ columns, rows, rowKey, isRowSelected }: DataTableProps<Row>) {
  return (
    <Table className="min-w-max border-separate border-spacing-0">
      <TableHeader>
        <TableRow className="border-hairline bg-subtle hover:bg-subtle">
          {columns.map((column) => (
            <TableHead
              key={column.id}
              scope="col"
              className={cn(
                "h-auto px-3 py-3 text-eyebrow font-semibold tracking-widest text-fg-muted uppercase",
                column.align === "right" && "text-right",
              )}
            >
              {renderHeader(column)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const selected = isRowSelected?.(row) ?? false;
          return (
            <TableRow
              key={rowKey(row)}
              // A selected row keeps its tint while hovered. Swapping to the
              // neutral hover would read as "this row is no longer selected".
              className={cn(
                "border-hairline",
                selected ? "bg-accent-row hover:bg-accent-row" : "hover:bg-hovered",
              )}
            >
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(
                    "whitespace-nowrap px-3 py-3 text-body font-semibold text-fg",
                    column.align === "right" && "text-right",
                  )}
                >
                  {renderCell(column, row)}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function renderHeader<Row>(column: Column<Row>): ReactNode {
  const label = column.headerHidden ? (
    // An empty header stays empty: a hidden label would add an eighth
    // announced column header where the spec allows seven.
    column.header ? (
      <span className="sr-only">{column.header}</span>
    ) : null
  ) : (
    column.header
  );

  if (!column.headerCell) return label;

  return (
    <>
      {label}
      {column.headerCell()}
    </>
  );
}

function renderCell<Row>(column: Column<Row>, row: Row): ReactNode {
  if (column.text) {
    const value = column.text(row);
    return (
      // `title` is unconditional: the tooltip should be there whether or not
      // this particular value happens to be long enough to clip today.
      <span
        title={value}
        className={cn("block truncate", column.truncateAt && MAX_WIDTH_CLASSES[column.truncateAt])}
      >
        {value}
      </span>
    );
  }
  return column.cell(row);
}
