import { useContext } from "react";
import { FilefeedContext } from "../provider/FilefeedProvider";

export function useFilefeed() {
  const ctx = useContext(FilefeedContext);
  if (!ctx) {
    throw new Error("useFilefeed must be used within <FilefeedProvider>");
  }
  return ctx;
}


