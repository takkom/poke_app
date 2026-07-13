import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Platform } from "react-native";

type TransactionDatePickerProps = {
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
  value: Date;
};

export function TransactionDatePicker({
  onChange,
  value,
}: TransactionDatePickerProps) {
  return (
    <DateTimePicker
      display={Platform.OS === "ios" ? "spinner" : "default"}
      mode="datetime"
      onChange={onChange}
      value={value}
    />
  );
}
