/** How many a seller can ask for on the sign-up form (more later, from the seller hub). */
export const BRANDS_AT_SIGN_UP = 3;

export const emptyBrandRequest = () => ({ name: "", note: "" });

/** One request as the API takes it. */
export const brandRequestPayload = ({ name, note }) => ({ name: name.trim(), note: note.trim() || null });
