import React from "react";

import PairText from "./PairText";
import { toPrecision, getPrecision } from "../utils";
import { useSelector } from "react-redux";
import { chainSymbolSelector } from "../store/reducers/chainSlice";
import BigNumber from "bignumber.js";

const Balance = ({ value = 0, currency }) => {
  const symbol = useSelector(chainSymbolSelector);
  const balanceSymbol = currency || symbol;

  if (value === null || value === undefined) {
    value = 0;
  }

  if (["KSM", "DOT"].includes(balanceSymbol?.toUpperCase())) {
    value = toPrecision(value, getPrecision(balanceSymbol), false);
  } else if (balanceSymbol?.toUpperCase() === "USDT") {
    value = new BigNumber(value).toFixed(2);
  }

  return <PairText value={value} unit={balanceSymbol} />;
};

export default Balance;
