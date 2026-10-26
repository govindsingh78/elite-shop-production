import React, { useState } from "react";
import { Link } from "react-router-dom";
import { SEVERITY } from "./server";

/** A command to run on the server, with a copy button. */
export const CommandBlock = ({ command, note }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div className="srv-command">
      <code>{command}</code>
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      {note && <small>{note}</small>}
    </div>
  );
};

/** A filled bar for a percentage, coloured by how worrying it is. */
export const Meter = ({ percent, status = "ok", label }) => (
  <div className={`srv-meter is-${status}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent || 0)} aria-label={label}>
    <span style={{ width: `${Math.min(100, Math.max(0, percent || 0))}%` }} />
  </div>
);

export const SeverityBadge = ({ severity }) => <span className={`srv-badge is-${SEVERITY[severity]?.tone || "info"}`}>{SEVERITY[severity]?.label || severity}</span>;

/** One "needs attention" item: what's wrong, why it matters, and what to run or where to go. */
export const AttentionItem = ({ item, onOpenTab }) => (
  <li className={`srv-attention is-${SEVERITY[item.severity]?.tone || "info"}`}>
    <div className="srv-attention-head">
      <SeverityBadge severity={item.severity} />
      <strong>{item.title}</strong>
    </div>
    <p>{item.detail}</p>
    {item.commands?.map((command) => <CommandBlock key={command} command={command} />)}
    {item.tab && item.tab !== "overview" && onOpenTab && (
      <button type="button" className="btn btn-link btn-sm px-0" onClick={() => onOpenTab(item.tab)}>Open {item.tab} →</button>
    )}
  </li>
);

/** A suggestion for running the store better, linking to where to act. */
export const SuggestionItem = ({ item, onOpenTab }) => (
  <li className="srv-suggestion">
    <div>
      <strong>{item.title}</strong>
      <p>{item.detail}</p>
    </div>
    {item.link ? <Link to={item.link} className="btn btn-sm btn-outline-primary text-nowrap">Go →</Link>
      : item.tab && onOpenTab ? <button type="button" className="btn btn-sm btn-outline-primary text-nowrap" onClick={() => onOpenTab(item.tab)}>Open →</button> : null}
  </li>
);
