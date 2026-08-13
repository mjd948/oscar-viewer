import { PaletteMode, ThemeOptions } from "@mui/material";
import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import '@mui/material/Paper';

// When using TypeScript 4.x and above
import type {} from "@mui/x-data-grid/themeAugmentation";

declare module "@mui/material/styles" {
  interface Palette {
    errorHighlight: string;
    secondaryHighlight: string;
    infoHighlight: string;
    successHighlight: string;
    faultHighlight: string;
  }
  interface PaletteOptions {
    errorHighlight: string;
    secondaryHighlight: string;
    infoHighlight: string;
    successHighlight: string;
    faultHighlight: string;
  }
}
declare module "@mui/material/Paper" {
  interface PaperPropsVariantOverrides {
    dynamic: true;
  }
}

export const getTheme = (mode: PaletteMode) => {
  let theme = createTheme({
    breakpoints: {
      values: {
        xs: 0, // Phones
        sm: 600,
        md: 900, // Tablets
        lg: 1200, // Small laptops
        xl: 1536,
      },
    },
    palette: {
      mode,
      errorHighlight: "#D32F2F4D",
      secondaryHighlight: "#9C27B04D",
      infoHighlight: "#2196F34D",
      successHighlight: "#C1D8C2",
      faultHighlight: "#ED6C024D",
    },
    typography: {},
    components: {
      MuiPaper: {
        styleOverrides: {
          root: ({ ownerState, theme }) => ({
            ...(ownerState.variant === "outlined" && {
              borderRadius: "10px",
              flexGrow: 1,
              padding: theme.spacing(2),
              overflow: "hidden",
            }),
          }),
        },
        variants: [{
          props: { variant: "dynamic" },
          style: ({ theme }) => ({
            flexGrow: 1,
            overflow: "hidden",
          })
        }],
      },
      MuiCard: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            borderRadius: "10px",
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            borderRadius: "10px",
          }),
        },
      },
      MuiDataGrid: {
        // Tables live inside resizable widget cells, where the standard 56px
        // headers / 52px rows leave room for only a handful of rows. Compact
        // roughly doubles the visible count; the grid's own density selector
        // still lets users switch back.
        defaultProps: {
          density: "compact",
          // Headers wrap to two lines (see columnHeaderTitle below), which the
          // 39px compact default cannot show. The grid derives the real height
          // as floor(columnHeaderHeight * densityFactor) and feeds it to the
          // --DataGrid-headerHeight variable the scroller offsets from, so this
          // has to come from the prop — growing the cell in CSS alone would
          // leave the rows overlapping the header.
          columnHeaderHeight: 68,
        },
        styleOverrides: {
          root: {},
          // Long labels ("Max Neutron (cps)", "Adjudication Status") otherwise
          // force a column to stay wide enough for one unbroken line, which is
          // what pinned every event-table column at its minWidth. Clamp at two
          // lines so a pathological header still cannot outgrow the fixed
          // header height.
          columnHeaderTitle: {
            whiteSpace: "normal",
            lineHeight: 1.25,
            // A header whose longest WORD exceeds the column still has to
            // degrade legibly — minWidths are set to avoid this, but a user
            // dragging a column very narrow would otherwise get a hard clip
            // with no ellipsis (the -webkit-box clamp only ellipsizes when it
            // drops a whole line).
            overflowWrap: "break-word",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          },
          // Default is a fixed 52px for what is one line of pagination text.
          // The inner TablePagination toolbar carries its own 52px, so shrinking
          // the container alone leaves the height unchanged.
          footerContainer: {
            minHeight: 38,
            "& .MuiTablePagination-toolbar": {
              minHeight: 38,
            },
            // Full-size icon buttons (40px) would otherwise set the height.
            "& .MuiTablePagination-actions .MuiIconButton-root": {
              padding: 4,
            },
            // These are <p> elements: the default 14px block margins turn one
            // 20px line of text into a 48px row, which set the footer height.
            "& .MuiTablePagination-displayedRows, & .MuiTablePagination-selectLabel": {
              margin: 0,
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            "& .MuiInputBase-root": {
              borderRadius: "10px",
            },
          }),
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            ...(ownerState.variant === "outlined" && {
              borderRadius: "10px",
            }),
          }),
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            ...(ownerState.type === "file" && {
              color: "transparent",
              position: "absolute",
              "& ::file-selector-button": {
                display: "none",
              },
            }),
          }),
        },
      },
    },
  });

  theme = responsiveFontSizes(theme);
  return theme;
};
