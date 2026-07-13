import { Platform, UIManager } from "react-native";

type DateTimePickerEvent = {
  type: "set" | "dismissed" | string;
};

type DateTimePickerComponent = React.ComponentType<{
  display?: string;
  mode?: string;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
  value: Date;
}>;

function hasNativeDateTimePicker(): boolean {
  try {
    if (Platform.OS === "ios") {
      return (
        UIManager.getViewManagerConfig?.("RNDateTimePicker") != null ||
        // Older RN
        // @ts-expect-error legacy API
        UIManager.RNDateTimePicker != null
      );
    }

    // Android opens a dialog via a native module; view manager may also exist.
    return (
      UIManager.getViewManagerConfig?.("RNDateTimePicker") != null ||
      // @ts-expect-error legacy API
      UIManager.RNDateTimePicker != null
    );
  } catch {
    return false;
  }
}

let CachedPicker: DateTimePickerComponent | null | undefined;

function loadNativeDateTimePicker(): DateTimePickerComponent | null {
  if (CachedPicker !== undefined) {
    return CachedPicker;
  }

  if (!hasNativeDateTimePicker()) {
    CachedPicker = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@react-native-community/datetimepicker");
    CachedPicker = (mod.default ?? mod) as DateTimePickerComponent;
  } catch {
    CachedPicker = null;
  }

  return CachedPicker;
}

export function isNativeDateTimePickerAvailable(): boolean {
  return hasNativeDateTimePicker();
}

type TransactionDatePickerProps = {
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
  value: Date;
};

export function TransactionDatePicker({
  onChange,
  value,
}: TransactionDatePickerProps) {
  const NativePicker = loadNativeDateTimePicker();
  if (!NativePicker) {
    return null;
  }

  return (
    <NativePicker
      display={Platform.OS === "ios" ? "spinner" : "default"}
      mode="datetime"
      onChange={onChange}
      value={value}
    />
  );
}
