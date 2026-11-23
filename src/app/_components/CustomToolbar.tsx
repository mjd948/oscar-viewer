import { Badge, Box, Button, Stack } from "@mui/material";
import {
    GridToolbarColumnsButton,
    GridToolbarContainer,
    GridToolbarDensitySelector,
    GridToolbarFilterButton,
    GridToolbarProps,
} from "@mui/x-data-grid";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import BookmarksOutlinedIcon from "@mui/icons-material/BookmarksOutlined";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { AlarmTimeWindowPreset } from "@/lib/data/oscar/EventTableRequests";

export interface ToolbarTimeWindowOption {
  value: AlarmTimeWindowPreset;
  label: string;
}

export interface CustomToolbarProps {
  activeFilterCount?: number;
  selectedCount?: number;
  rowCount?: number;
  allFilteredSelected?: boolean;
  unreadOnly?: boolean;
  sortByTimeOnly?: boolean;
  timeWindowPreset?: AlarmTimeWindowPreset;
  timeWindowOptions?: readonly ToolbarTimeWindowOption[];
  timeWindowGroupLabel?: string;
  unreadOnlyLabel?: string;
  sortByTimeOnlyLabel?: string;
  filterLabel?: string;
  savedQueriesLabel?: string;
  savedQueryCount?: number;
  resetQueryLabel?: string;
  hasActiveQuery?: boolean;
  selectAllFilteredLabel?: string;
  clearSelectionLabel?: string;
  bulkAdjudicateLabel?: string;
  acknowledgeSelectedLabel?: string;
  acknowledgeAllLabel?: string;
  onOpenFilters?: () => void;
  onOpenSavedQueries?: (anchor: HTMLElement) => void;
  onResetQuery?: () => void;
  onToggleUnreadOnly?: () => void;
  onToggleSortByTimeOnly?: () => void;
  onSelectTimeWindowPreset?: (preset: AlarmTimeWindowPreset) => void;
  onSelectAllFiltered?: () => void;
  onClearSelection?: () => void;
  onBulkAdjudicate?: () => void;
  onAcknowledgeSelected?: () => void;
  onAcknowledgeAll?: () => void;
}

declare module "@mui/x-data-grid" {
  interface ToolbarPropsOverrides extends CustomToolbarProps {}
}

const toggleButtonSx = {
  textTransform: "none",
  minInlineSize: "24px",
  minBlockSize: "24px",
  px: 1,
  py: 0.25,
  borderRadius: 1,
  border: "1px solid",
  borderColor: "divider",
  color: "text.primary",
  bgcolor: "transparent",
  "@media (pointer: coarse)": {
    minBlockSize: "44px",
    minInlineSize: "44px",
  },
  "&[aria-pressed='true']": {
    bgcolor: "primary.main",
    color: "primary.contrastText",
    borderColor: "primary.dark",
    boxShadow: "inset 0 0 0 1px currentColor",
    fontWeight: 700,
    "@media (hover: hover)": {
      "&:hover": {
        bgcolor: "primary.dark",
      },
    },
    "@media (forced-colors: active)": {
      bgcolor: "Highlight",
      color: "HighlightText",
      borderColor: "Highlight",
    },
  },
} as const;

const separatorSx = {
  alignSelf: "stretch",
  my: 0.5,
  mx: 0.25,
  borderInlineStart: "1px solid",
  borderColor: "divider",
} as const;

export default function CustomToolbar({
  activeFilterCount = 0,
  selectedCount = 0,
  rowCount = 0,
  allFilteredSelected = false,
  unreadOnly = false,
  sortByTimeOnly = false,
  timeWindowPreset,
  timeWindowOptions,
  timeWindowGroupLabel = "Alarm time window",
  unreadOnlyLabel = "Unread only",
  sortByTimeOnlyLabel = "Newest first",
  filterLabel = "Filters",
  savedQueriesLabel = "Saved Queries",
  savedQueryCount = 0,
  resetQueryLabel = "Reset Query",
  hasActiveQuery = false,
  selectAllFilteredLabel = "Select all filtered",
  clearSelectionLabel = "Clear selection",
  bulkAdjudicateLabel = "Bulk adjudicate",
  acknowledgeSelectedLabel = "Acknowledge selected",
  acknowledgeAllLabel = "Acknowledge all",
  onOpenFilters,
  onOpenSavedQueries,
  onResetQuery,
  onToggleUnreadOnly,
  onToggleSortByTimeOnly,
  onSelectTimeWindowPreset,
  onSelectAllFiltered,
  onClearSelection,
  onBulkAdjudicate,
  onAcknowledgeSelected,
  onAcknowledgeAll,
}: GridToolbarProps & CustomToolbarProps) {
  return (
    <GridToolbarContainer
      sx={{
        display: "flex",
        flexWrap: "wrap",
        rowGap: 0.5,
        justifyContent: "space-between",
        paddingInline: "1em",
      }}
    >
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" alignItems="center">
        <GridToolbarColumnsButton />
        {onOpenFilters ? (
          <Button
            type="button"
            size="small"
            startIcon={
              <Badge color="primary" badgeContent={activeFilterCount}>
                <FilterAltOutlinedIcon fontSize="small" aria-hidden="true" />
              </Badge>
            }
            onClick={onOpenFilters}
          >
            {filterLabel}
          </Button>
        ) : <GridToolbarFilterButton />}
        {onOpenSavedQueries && (
          <Button
            type="button"
            size="small"
            startIcon={
              <Badge color="primary" badgeContent={savedQueryCount}>
                <BookmarksOutlinedIcon fontSize="small" aria-hidden="true" />
              </Badge>
            }
            onClick={(event) => onOpenSavedQueries(event.currentTarget)}
            data-testid="saved-queries-btn"
          >
            {savedQueriesLabel}
          </Button>
        )}
        {hasActiveQuery && onResetQuery && (
          <Button
            type="button"
            size="small"
            startIcon={<RestartAltRoundedIcon fontSize="small" aria-hidden="true" />}
            onClick={onResetQuery}
            data-testid="reset-event-query-btn"
          >
            {resetQueryLabel}
          </Button>
        )}
        <GridToolbarDensitySelector />
        {(onToggleUnreadOnly || onToggleSortByTimeOnly) && (
          <>
            <Box component="span" role="separator" aria-orientation="vertical" sx={separatorSx} />
            {onToggleUnreadOnly && (
              <Button
                type="button"
                size="small"
                aria-pressed={Boolean(unreadOnly)}
                startIcon={<MarkEmailUnreadOutlinedIcon fontSize="small" aria-hidden="true" />}
                onClick={onToggleUnreadOnly}
                data-testid="toolbar-unread-only"
                sx={toggleButtonSx}
              >
                {unreadOnlyLabel}
              </Button>
            )}
            {onToggleSortByTimeOnly && (
              <Button
                type="button"
                size="small"
                aria-pressed={Boolean(sortByTimeOnly)}
                startIcon={<ScheduleRoundedIcon fontSize="small" aria-hidden="true" />}
                onClick={onToggleSortByTimeOnly}
                data-testid="toolbar-sort-time-only"
                sx={toggleButtonSx}
              >
                {sortByTimeOnlyLabel}
              </Button>
            )}
          </>
        )}
        {onSelectTimeWindowPreset && timeWindowOptions && timeWindowOptions.length > 0 && (
          <>
            <Box component="span" role="separator" aria-orientation="vertical" sx={separatorSx} />
            <Box
              role="group"
              aria-label={timeWindowGroupLabel}
              data-testid="toolbar-time-window-group"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                flexWrap: "wrap",
                minInlineSize: 0,
              }}
            >
              {timeWindowOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="small"
                  aria-pressed={timeWindowPreset === option.value}
                  onClick={() => onSelectTimeWindowPreset(option.value)}
                  data-testid={`toolbar-time-window-${option.value}`}
                  sx={toggleButtonSx}
                >
                  {option.label}
                </Button>
              ))}
            </Box>
          </>
        )}
      </Stack>
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" alignItems="center">
        {selectedCount > 0 && (
          <Button type="button" size="small" onClick={onClearSelection}>
            {clearSelectionLabel}
          </Button>
        )}
        {rowCount > 0 && !allFilteredSelected && (
          <Button
            type="button"
            size="small"
            startIcon={<DoneAllOutlinedIcon fontSize="small" aria-hidden="true" />}
            onClick={onSelectAllFiltered}
          >
            {selectAllFilteredLabel}
          </Button>
        )}
        {onAcknowledgeSelected && selectedCount > 0 && (
          <Button
            type="button"
            size="small"
            startIcon={<MarkEmailReadOutlinedIcon fontSize="small" aria-hidden="true" />}
            onClick={onAcknowledgeSelected}
            data-testid="toolbar-acknowledge-selected"
          >
            {acknowledgeSelectedLabel}
          </Button>
        )}
        {onAcknowledgeAll && rowCount > 0 && (
          <Button
            type="button"
            size="small"
            startIcon={<MarkEmailReadOutlinedIcon fontSize="small" aria-hidden="true" />}
            onClick={onAcknowledgeAll}
            data-testid="toolbar-acknowledge-all"
          >
            {acknowledgeAllLabel}
          </Button>
        )}
        {selectedCount > 0 && (
          <Button
            type="button"
            size="small"
            color="success"
            startIcon={<GavelOutlinedIcon fontSize="small" aria-hidden="true" />}
            onClick={onBulkAdjudicate}
          >
            {bulkAdjudicateLabel}
          </Button>
        )}
      </Stack>
    </GridToolbarContainer>
  );
}
