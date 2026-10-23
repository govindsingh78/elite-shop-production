import React, { useState } from "react";
import { Link } from "react-router-dom";
import Modal from "react-bootstrap/Modal";
import { RETURN_POLICY, RETURN_POLICY_PATH, usePolicy } from "./policy";
import { SUPPORT_EMAIL, SUPPORT_PHONES } from "./support";

const ICONS = {
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="m9.5 15 2 2 3.5-3.5" /></>,
  refund: <><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6" /><path d="M4 4v4.6h4.6" /><path d="M12 8v8M14.5 9.5H11a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H9.5" /></>,
  shield: <><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  support: <><path d="M4 13v-1a8 8 0 0 1 16 0v1" /><rect x="3" y="13" width="4" height="6" rx="1.5" /><rect x="17" y="13" width="4" height="6" rx="1.5" /><path d="M19 19c0 1.5-1.5 2.5-4 2.5h-2" /></>,
};

export const PolicyIcon = ({ name }) => <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[name] || ICONS.shield}</svg>;

/** The four key points, as cards. */
export const PolicyHighlights = ({ policy, compact = false }) => (
  <ul className={`pol-highlights${compact ? " is-compact" : ""}`}>
    {policy.highlights.map((highlight) => (
      <li key={highlight.title}>
        <span className="pol-highlight-icon"><PolicyIcon name={highlight.icon} /></span>
        <span><strong>{highlight.title}</strong><small>{highlight.text}</small></span>
      </li>
    ))}
  </ul>
);

const ContactLinks = () => (
  <div className="pol-contact">
    {SUPPORT_PHONES.map((phone) => (
      <a key={phone.tel} href={`tel:${phone.tel}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
        {phone.label}
      </a>
    ))}
    <a href={`mailto:${SUPPORT_EMAIL}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
      {SUPPORT_EMAIL}
    </a>
  </div>
);

/** Every section of a policy, numbered. Sections marked `contact` end with the helpline and email. */
export const PolicySections = ({ policy }) => (
  <div className="pol-sections">
    {policy.sections.map((section, index) => (
      <section key={section.id} id={section.id} className="pol-section">
        <h2><span>{String(index + 1).padStart(2, "0")}</span>{section.title}</h2>
        {section.blocks.map((block, blockIndex) => {
          if (block.type === "list") return <ul key={blockIndex}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
          if (block.type === "steps") return <ol key={blockIndex} className="pol-steps">{block.items.map((item) => <li key={item}>{item}</li>)}</ol>;
          if (block.type === "note") return <p key={blockIndex} className="pol-note">{block.text}</p>;
          return <p key={blockIndex}>{block.text}</p>;
        })}
        {section.contact && <ContactLinks />}
      </section>
    ))}
  </div>
);

/** Checkout box: the key points, the full policy in a dialog, and the "I agree" tick shoppers must give before ordering. */
export const PolicyAgreement = ({ checked, onChange, error }) => {
  const { policy, error: loadError } = usePolicy(RETURN_POLICY);
  const [open, setOpen] = useState(false);

  return (
    <div className={`co-policy${error ? " has-error" : ""}`}>
      <div className="co-policy-head">
        <span className="co-policy-icon"><PolicyIcon name="refund" /></span>
        <span className="co-policy-copy">
          <strong>Returns &amp; refunds</strong>
          <small>{policy ? policy.highlights.slice(0, 2).map((highlight) => highlight.title).join(" · ") : "Easy returns on eligible items"}</small>
        </span>
        <button type="button" className="co-policy-read" onClick={() => setOpen(true)}>Read policy</button>
      </div>
      <label className="co-policy-check">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>I have read and agree to the <button type="button" onClick={() => setOpen(true)}>Return &amp; Refund Policy</button>.</span>
      </label>
      {error && <p className="co-policy-error" role="alert">{error}</p>}

      <Modal show={open} onHide={() => setOpen(false)} size="lg" centered scrollable dialogClassName="pol-modal">
        <Modal.Header closeButton>
          <Modal.Title>Return &amp; Refund Policy</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {policy ? (
            <>
              <p className="pol-modal-meta">Last updated {policy.updated}</p>
              <p className="pol-intro">{policy.intro}</p>
              <PolicyHighlights policy={policy} compact />
              <PolicySections policy={policy} />
            </>
          ) : loadError ? (
            <p className="text-danger mb-0">{loadError} You can also read it on <Link to={RETURN_POLICY_PATH} target="_blank">its own page</Link>.</p>
          ) : <p className="mb-0" role="status">Loading the policy…</p>}
        </Modal.Body>
        <Modal.Footer>
          <a href={RETURN_POLICY_PATH} target="_blank" rel="noreferrer" className="pol-modal-link">Open in a new tab ↗</a>
          <button type="button" className="btn btn-primary" onClick={() => { onChange(true); setOpen(false); }}>I agree</button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

/** One line under "Add to bag": the return window, with a link to the policy. */
export const ProductReturnsNote = () => {
  const { policy } = usePolicy(RETURN_POLICY);
  if (!policy) return null;
  const [first] = policy.highlights;
  return (
    <p className="pd-returns">
      <PolicyIcon name="refund" />
      <span><strong>{first.title}</strong> on eligible items. <Link to={RETURN_POLICY_PATH}>Return &amp; Refund Policy</Link></span>
    </p>
  );
};
