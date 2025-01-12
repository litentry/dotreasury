import React from "react";
import { useSelector } from "react-redux";
import { chainSelector } from "../store/reducers/chainSlice";
import ExternalLink from "./ExternalLink";

export default function ExplorerLink({ href, base, children }) {
  const chain = useSelector(chainSelector);
  const defaultExplorerSite =
    chain === "kusama"
      ? "https://kusama.subscan.io/"
      : "https://polkadot.subscan.io/";
  const baseHref = base ?? defaultExplorerSite;
  return (
    <ExternalLink href={new URL(href, baseHref).href}>{children}</ExternalLink>
  );
}
