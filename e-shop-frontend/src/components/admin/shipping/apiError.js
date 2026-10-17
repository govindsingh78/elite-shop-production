import { apiUrl } from "../../common/http";

export const getShippingApiErrorMessage = (error, fallback) => {
  if (error instanceof TypeError) {
    return `Cannot reach the Laravel API at ${apiUrl}. Make sure the backend server is running.`;
  }

  return error?.message || fallback;
};
