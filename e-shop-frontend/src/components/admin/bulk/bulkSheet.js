import excelScriptUrl from "exceljs/dist/exceljs.min.js?url";
import { apiUrl } from "../../common/http";
import { portalToken } from "../portal";

/**
 * Bulk product upload: the spreadsheet is built and read here in the browser (with exceljs, loaded only on
 * this page); the API supplies the drop-down lists, checks the rows and saves them.
 */

export const SHEET_NAME = "Products";

/** The sheet's columns, in order. Headers are matched by name when reading, so columns can be moved. */
export const COLUMNS = [
  { key: "sku", header: "SKU", required: true, width: 18, help: "Your unique code for the product, e.g. KURTA-BLUE-M. If it matches one of your products, that product is updated instead." },
  { key: "title", header: "Title", required: true, width: 36, help: "The product name shoppers see." },
  { key: "category", header: "Category", required: true, width: 28, list: "categories", help: "Pick from the list. Subcategories look like “Kids › Toys”." },
  { key: "brand", header: "Brand", required: true, width: 20, list: "brands", help: "Pick from the list." },
  { key: "price", header: "Price (₹)", required: true, width: 13, number: true, help: "Selling price, e.g. 1499 or 1499.50." },
  { key: "compare_price", header: "MRP (₹)", width: 13, number: true, help: "Optional. The original price, shown crossed out when it’s higher than the price." },
  { key: "qty", header: "Stock", width: 10, whole: true, help: "How many you have. Leave blank if you don’t track stock." },
  { key: "short_description", header: "Short description", width: 40, help: "One or two lines shown near the price." },
  { key: "description", header: "Description", width: 52, help: "Full details: fabric, fit, size guide, care." },
  { key: "barcode", header: "Barcode", width: 16, help: "Optional." },
  { key: "show_in_store", header: "Show in store", width: 15, list: "yesNo", help: "Yes to list it, No to keep it hidden. Blank means Yes for new products." },
  { key: "featured", header: "Featured", width: 12, list: "yesNo", adminOnly: true, help: "Yes to show it in Editor’s picks on the home page." },
  { key: "images", header: "Photo file names", width: 44, help: "File names of this product’s photos, separated by commas, e.g. kurta-front.jpg, kurta-back.jpg. The first is the main photo. Up to 10." },
];

const ALIASES = { mrp: "compare_price", "compare price": "compare_price", stock: "qty", quantity: "qty", photos: "images", images: "images", "image file names": "images", price: "price", featured: "featured", status: "show_in_store" };

export const columnsFor = (portal) => COLUMNS.filter((column) => portal === "admin" || !column.adminOnly);

const headerKey = (text) => {
  const clean = String(text || "").replace(/\*/g, "").replace(/\(.*?\)/g, "").trim().toLowerCase();
  const column = COLUMNS.find((item) => item.header.replace(/\(.*?\)/g, "").trim().toLowerCase() === clean);
  return column?.key || ALIASES[clean] || null;
};

// exceljs ships a ready-made browser build. It is copied into the site as a plain file and loaded with a script tag
// the first time a sheet is made or read: bundling it instead would add ~300 MB to the build's memory use.
let excelLoading = null;
const loadExcel = () => {
  excelLoading ??= new Promise((resolve, reject) => {
    if (window.ExcelJS) {
      resolve(window.ExcelJS);
      return;
    }
    const script = document.createElement("script");
    script.src = excelScriptUrl;
    script.async = true;
    script.onload = () => (window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error("The spreadsheet tool didn’t load. Please refresh and try again.")));
    script.onerror = () => {
      excelLoading = null;
      script.remove();
      reject(new Error("We couldn’t load the spreadsheet tool. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return excelLoading;
};

/** Calls the bulk upload API as the signed-in admin or seller. */
export async function bulkRequest(portal, path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`${apiUrl}/${portal === "admin" ? "admin" : "vendor"}/bulk-products${path}`, {
      method,
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${portalToken(portal) || ""}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the store right now. Please try again shortly.");
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 429) throw new Error("That’s a lot of uploads in a short time. Please wait a minute and try again.");
  if (!response.ok) throw new Error(Object.values(data.errors || {}).flat()[0] || data.message || "Something went wrong. Please try again.");
  return data;
}

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF18372E" } };
const REQUIRED_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123A30" } };
const columnLetter = (index) => String.fromCharCode(65 + index);

/**
 * The sample spreadsheet for this user: a "Products" sheet with drop-downs for their categories and brands,
 * an "Example" sheet, and "How to use". `rows` pre-fills Products (e.g. their existing products).
 */
export async function buildWorkbook({ data, rows = [] }) {
  const ExcelJS = await loadExcel();
  const portal = data.portal;
  const columns = columnsFor(portal);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Elitezaar";
  workbook.created = new Date();

  // Drop-down sources, on a hidden sheet.
  const lists = workbook.addWorksheet("Lists", { state: "veryHidden" });
  const listRanges = {};
  [["categories", data.categories], ["brands", data.brands], ["yesNo", ["Yes", "No"]]].forEach(([name, values], index) => {
    const letter = columnLetter(index);
    lists.getCell(`${letter}1`).value = name;
    values.forEach((value, row) => { lists.getCell(`${letter}${row + 2}`).value = value; });
    listRanges[name] = values.length ? `Lists!$${letter}$2:$${letter}$${values.length + 1}` : null;
  });

  const addProductSheet = (name, sheetRows, color) => {
    const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }], properties: { tabColor: { argb: color } } });
    sheet.columns = columns.map((column) => ({ header: `${column.header}${column.required ? " *" : ""}`, key: column.key, width: column.width }));
    const header = sheet.getRow(1);
    header.height = 22;
    columns.forEach((column, index) => {
      const cell = header.getCell(index + 1);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = column.required ? REQUIRED_FILL : HEADER_FILL;
      cell.alignment = { vertical: "middle" };
      cell.note = column.help;
    });
    sheetRows.forEach((row) => sheet.addRow(row));
    return sheet;
  };

  const products = addProductSheet(SHEET_NAME, rows, "FF43C3D1");
  const lastRow = Math.max(data.max_rows + 1, rows.length + 1);
  columns.forEach((column, index) => {
    const letter = columnLetter(index);
    for (let row = 2; row <= lastRow; row += 1) {
      const cell = products.getCell(`${letter}${row}`);
      if (column.list && listRanges[column.list]) {
        cell.dataValidation = { type: "list", allowBlank: !column.required, formulae: [listRanges[column.list]], showErrorMessage: true, errorStyle: "warning", errorTitle: column.header, error: "Please pick a value from the list." };
      } else if (column.number) {
        cell.dataValidation = { type: "decimal", operator: "greaterThanOrEqual", allowBlank: true, formulae: [0], showErrorMessage: true, errorTitle: column.header, error: "Enter a price in rupees, e.g. 1499 or 1499.50." };
      } else if (column.whole) {
        cell.dataValidation = { type: "whole", operator: "greaterThanOrEqual", allowBlank: true, formulae: [0], showErrorMessage: true, errorTitle: column.header, error: "Enter a whole number, or leave it blank." };
      }
      if (column.number) cell.numFmt = "#,##0.00";
    }
  });

  // A filled-in example using this store's own categories and brands. It isn't imported.
  const category = data.categories.find((label) => label.includes("›")) || data.categories[0] || "";
  const brand = data.brands[0] || "";
  const example = addProductSheet("Example", [
    { sku: "KURTA-BLUE-M", title: "Indigo cotton kurta", category, brand, price: 1499, compare_price: 1999, qty: 25, short_description: "Breathable hand-block print, regular fit.", description: "100% cotton. Machine wash cold. Size M: chest 40 in, length 44 in.", barcode: "", show_in_store: "Yes", featured: "No", images: "kurta-blue-front.jpg, kurta-blue-back.jpg" },
    { sku: "KURTA-BLUE-L", title: "Indigo cotton kurta (L)", category, brand, price: 1499, compare_price: "", qty: 10, short_description: "", description: "", barcode: "", show_in_store: "Yes", featured: "No", images: "kurta-blue-front.jpg" },
    { sku: "SCARF-RED", title: "Silk blend scarf", category, brand, price: 799, compare_price: "", qty: "", short_description: "", description: "", barcode: "8901234567890", show_in_store: "No", featured: "No", images: "" },
  ], "FFC99A5B");
  const exampleNote = example.getCell(`A${example.rowCount + 2}`);
  exampleNote.value = "This sheet is only an example and isn’t uploaded. Fill in the “Products” sheet.";
  exampleNote.font = { italic: true, color: { argb: "FF7D8A82" } };

  const guide = workbook.addWorksheet("How to use", { properties: { tabColor: { argb: "FF18372E" } } });
  guide.getColumn(1).width = 26;
  guide.getColumn(2).width = 12;
  guide.getColumn(3).width = 100;
  const line = (values, font) => { const row = guide.addRow(values); if (font) row.font = font; row.alignment = { wrapText: true, vertical: "top" }; return row; };
  line(["Elitezaar bulk product upload"], { bold: true, size: 16, color: { argb: "FF18372E" } });
  line([`Prepared for ${data.owner.name} (${data.owner.email}) · ${portal === "admin" ? "Store admin" : "Seller"} · ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`], { color: { argb: "FF7D8A82" } });
  line([]);
  [
    "1. Fill in the “Products” sheet, one product per row (up to " + data.max_rows + " rows). Columns marked * are required for new products.",
    "2. Categories and brands come from drop-down lists of what’s on Elitezaar now. Ask us if one you need is missing.",
    "3. Put all the photos in one folder. In “Photo file names”, list each product’s photo file names, separated by commas.",
    "4. On Elitezaar, open Products › Bulk upload, choose this file and the photo folder, check the results, then import.",
    "To update products, use a SKU you already have: only the cells you fill in change; blank cells keep their current values. “Download my products” gives you a sheet of your current products to edit.",
    portal === "admin" ? "Products you add go live straight away (unless Show in store is No)." : "New products, and changes to a title, description, category, brand or photos, go live once our team approves them. Price and stock changes apply straight away.",
  ].forEach((text) => {
    const row = line([text]);
    guide.mergeCells(row.number, 1, row.number, 3);
    row.height = 32;
  });
  line([]);
  line(["Column", "Required", "What to enter"], { bold: true, color: { argb: "FFFFFFFF" } }).eachCell((cell) => { cell.fill = HEADER_FILL; });
  columns.forEach((column) => line([column.header, column.required ? "New products" : "", column.help]));

  workbook.views = [{ activeTab: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const cellText = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
    if ("result" in value) return cellText(value.result);
    if ("text" in value) return cellText(value.text);
    return "";
  }
  return String(value).trim();
};

/** Splits a CSV file into rows of cells (handles quotes, commas and line breaks inside quotes). */
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
};

/**
 * Reads the products from an .xlsx (its "Products" sheet, or the first sheet) or .csv file, as objects
 * keyed by column ("sku", "title"…) with `_row` set to the spreadsheet row number. Empty rows are skipped.
 */
export async function readSheet(file) {
  let grid;
  if (/\.csv$/i.test(file.name)) {
    const text = await file.text();
    grid = parseCsv(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } else if (/\.xlsx$/i.test(file.name)) {
    const ExcelJS = await loadExcel();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.getWorksheet(SHEET_NAME) || workbook.worksheets.find((item) => item.state === "visible");
    if (!sheet) throw new Error("This file has no sheets.");
    grid = [];
    sheet.eachRow({ includeEmpty: true }, (row, number) => {
      const values = [];
      for (let column = 1; column <= Math.max(row.cellCount, sheet.columnCount); column += 1) values.push(cellText(row.getCell(column).value));
      grid[number - 1] = values;
    });
  } else {
    throw new Error("Please choose an Excel (.xlsx) or CSV file. Older .xls files can be saved as .xlsx from Excel.");
  }

  const header = (grid[0] || []).map(headerKey);
  if (!header.includes("sku")) throw new Error("The first row should be the column headings, with a “SKU” column. Download the sample sheet to see the layout.");
  const rows = [];
  grid.slice(1).forEach((cells, index) => {
    if (!cells || cells.every((value) => !cellText(value))) return;
    const row = { _row: index + 2 };
    header.forEach((key, column) => { if (key) row[key] = cellText(cells[column]); });
    rows.push(row);
  });
  return rows;
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const MAX_SIDE = 1600;

/** Shrinks a photo to at most 1600px and re-saves it as JPEG, so uploads stay small and fast. */
export async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error(`${file.name} couldn’t be read as an image.`);
  return blob;
}

/** Uploads one photo to the temporary image store; returns its id. */
export async function uploadPhoto(portal, file) {
  const form = new FormData();
  form.append("image", await compressImage(file), `${file.name.replace(/\.[^.]+$/, "")}.jpg`);
  const response = await fetch(`${apiUrl}/temp-images`, { method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${portalToken(portal) || ""}` }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${file.name}: ${Object.values(data.errors || {}).flat()[0] || data.message || "upload failed"}`);
  return data.data.id;
}

// Browsers can't read iPhone HEIC photos, so those need saving as JPEG first.
export const isImageFile = (file) => /\.(jpe?g|png|gif|webp)$/i.test(file.name);

export const today = () => new Date().toISOString().slice(0, 10);
