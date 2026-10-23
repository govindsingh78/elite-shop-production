import React from "react";
import { Link } from "react-router-dom";
import Layout from "./Layout";
import { PolicyHighlights, PolicySections } from "./PolicyBits";
import { RETURN_POLICY, usePolicy } from "./policy";

/** The Return & Refund Policy, with a contents list beside the numbered sections. */
const ReturnPolicy = () => {
  const { policy, error } = usePolicy(RETURN_POLICY);

  return (
    <Layout>
      <main className="policy-page">
        <section className="sp-hero">
          <span className="sp-hero-mark" aria-hidden="true">Returns</span>
          <div className="container">
            <nav aria-label="Breadcrumb">
              <ol className="breadcrumb shop-breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                <li className="breadcrumb-item active" aria-current="page">Return &amp; refund policy</li>
              </ol>
            </nav>
            <div className="sp-hero-copy">
              <div>
                <span className="sp-hero-eyebrow"><i aria-hidden="true" />Customer care</span>
                <h1>Returns &amp; <em>refunds.</em></h1>
                <p>{policy?.intro || "How returns, refunds and cancellations work on Elitezaar."}</p>
                {policy && <p className="pol-meta">Last updated {policy.updated}</p>}
              </div>
            </div>
          </div>
        </section>

        <div className="container py-4 py-lg-5">
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {!policy && !error && <div className="pol-skeleton" role="status" aria-label="Loading policy"><span /><span /><span /></div>}
          {policy && (
            <>
              <PolicyHighlights policy={policy} />
              <div className="row g-4 g-xl-5 mt-1">
                <aside className="col-lg-3">
                  <nav className="pol-toc" aria-label="On this page">
                    <span>On this page</span>
                    <ol>
                      {policy.sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}
                    </ol>
                  </nav>
                </aside>
                <div className="col-lg-9">
                  <PolicySections policy={policy} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </Layout>
  );
};

export default ReturnPolicy;
