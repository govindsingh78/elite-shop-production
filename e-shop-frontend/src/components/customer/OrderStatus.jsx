import React from "react";
import { STATUS_LABELS } from "./customerApi";

const OrderStatus = ({ status }) => (
  <span className={`customer-status customer-status--${status}`}>{STATUS_LABELS[status] || status}</span>
);

export default OrderStatus;
