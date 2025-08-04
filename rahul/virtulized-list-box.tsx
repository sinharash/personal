import {
  HTMLAttributes,
  cloneElement,
  createContext,
  forwardRef,
  useContext,
  Children,
} from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';

type HTMLDivProps = HTMLAttributes<HTMLDivElement>;

const renderRow = (props: ListChildComponentProps) => {
  const { data, index, style } = props;
  return cloneElement(data[index], { style });
};

// Context needed to keep Autocomplete working correctly : https://v4.mui.com/components/autocomplete/#Virtualize.tsx
const OuterElementContext = createContext<HTMLDivProps>({});

const OuterElementType = forwardRef<HTMLDivElement, HTMLDivProps>(
  (props, ref) => {
    const outerProps = useContext(OuterElementContext);
    return <div ref={ref} {...props} {...outerProps} />;
  },
);

export const VirtualizedListbox = forwardRef<HTMLDivElement, HTMLDivProps>(
  (props, ref) => {
    const { children, ...other } = props;
    const itemData = Children.toArray(children);
    const itemCount = itemData.length;

    const itemSize = 36;

    const itemsToShow = Math.min(10, itemCount) + 0.5;
    const height = itemsToShow * itemSize;

    return (
      <div ref={ref}>
        <OuterElementContext.Provider value={other}>
          <FixedSizeList
            height={height}
            itemData={itemData}
            itemCount={itemCount}
            itemSize={itemSize}
            outerElementType={OuterElementType}
            width="100%"
          >
            {renderRow}
          </FixedSizeList>
        </OuterElementContext.Provider>
      </div>
    );
  },