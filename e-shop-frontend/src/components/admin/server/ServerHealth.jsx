import React from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import LogTab from "./LogTab";
import OverviewTab from "./OverviewTab";
import ProblemsTab from "./ProblemsTab";
import SpeedTab from "./SpeedTab";
import StorageTab from "./StorageTab";
import { SERVER_TABS } from "./server";

const TABS = { overview: OverviewTab, problems: ProblemsTab, speed: SpeedTab, storage: StorageTab, log: LogTab };

/** Admin › Server & health: is the server healthy, what are people running into, what's slow, what fills the disk. */
const ServerHealth = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS[searchParams.get("tab")] ? searchParams.get("tab") : "overview";
  const Tab = TABS[tab];
  const openTab = (key) => {
    setSearchParams(key === "overview" ? {} : { tab: key });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar />
          <main className="container-fluid admin-dashboard-content customer-content srv-page">
            <section className="customer-hero">
              <div>
                <span className="customer-eyebrow customer-eyebrow--light">SERVER &amp; HEALTH</span>
                <h1>Keep the store running<span>.</span></h1>
                <p>Disk space, problems shoppers and sellers run into, slow pages and what to do about them. You’re alerted by email and on your phone when something needs you.</p>
              </div>
            </section>

            <div className="product-review-tabs" role="tablist" aria-label="Server & health sections">
              {SERVER_TABS.map((item) => (
                <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} className={`product-review-tab${tab === item.key ? " is-active" : ""}`} onClick={() => openTab(item.key)}>
                  {item.label}
                </button>
              ))}
            </div>

            <Tab onOpenTab={openTab} />
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default ServerHealth;
