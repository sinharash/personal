// VirtualizedListbox.tsx - Virtualized list for better performance with large datasets
import React, { forwardRef, HTMLAttributes, ReactElement } from "react";
import { VariableSizeList, ListChildComponentProps } from "react-window";
import { useTheme } from "@mui/material/styles";
import { Typography } from "@mui/material";

const LISTBOX_PADDING = 8; // px

// Component to render each row in the virtual list
function renderRow(props: ListChildComponentProps) {
  const { data, index, style } = props;
  const dataSet = data[index];
  const inlineStyle = {
    ...style,
    top: (style.top as number) + LISTBOX_PADDING,
  };

  return React.cloneElement(dataSet, {
    style: inlineStyle,
  });
}

// Context for outer element props
const OuterElementContext = React.createContext({});

// Outer element component
const OuterElementType = forwardRef<HTMLDivElement>((props, ref) => {
  const outerProps = React.useContext(OuterElementContext);
  return <div ref={ref} {...props} {...outerProps} />;
});

// Adapter for using VariableSizeList with MUI Autocomplete
function useResetCache(data: number) {
  const ref = React.useRef<VariableSizeList>(null);
  React.useEffect(() => {
    if (ref.current != null) {
      ref.current.resetAfterIndex(0, true);
    }
  }, [data]);
  return ref;
}

/**
 * VirtualizedListbox - A virtualized listbox component for MUI Autocomplete
 * Renders only visible items for better performance with large lists
 */
export const VirtualizedListbox = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLElement>
>(function VirtualizedListbox(props, ref) {
  const { children, ...other } = props;
  const itemData: ReactElement[] = [];
  const theme = useTheme();

  // Extract children into flat array
  (children as ReactElement[]).forEach((item: ReactElement) => {
    itemData.push(item);
    // Handle grouped items if needed
    if (item.children && Array.isArray(item.children)) {
      itemData.push(...(item.children as ReactElement[]));
    }
  });

  const itemCount = itemData.length;
  const itemSize = 48; // Standard MUI list item height

  const getChildSize = () => {
    return itemSize;
  };

  const getHeight = () => {
    if (itemCount > 8) {
      return 8 * itemSize;
    }
    return itemData.map(getChildSize).reduce((a, b) => a + b, 0);
  };

  const gridRef = useResetCache(itemCount);

  return (
    <div ref={ref}>
      <OuterElementContext.Provider value={other}>
        <VariableSizeList
          itemData={itemData}
          height={getHeight() + 2 * LISTBOX_PADDING}
          width="100%"
          ref={gridRef}
          outerElementType={OuterElementType}
          innerElementType="ul"
          itemSize={getChildSize}
          overscanCount={5}
          itemCount={itemCount}
        >
          {renderRow}
        </VariableSizeList>
      </OuterElementContext.Provider>
    </div>
  );
});

// If you prefer a simpler implementation without react-window dependency:
export const SimpleVirtualizedListbox = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLElement>
>(function SimpleVirtualizedListbox(props, ref) {
  const { children, ...other } = props;
  const theme = useTheme();

  // Simple implementation that just limits height and adds scrolling
  return (
    <div ref={ref} {...other}>
      <ul
        style={{
          padding: LISTBOX_PADDING,
          maxHeight: 8 * 48, // Show max 8 items
          overflow: "auto",
          margin: 0,
          listStyle: "none",
        }}
      >
        {children}
      </ul>
    </div>
  );
});
