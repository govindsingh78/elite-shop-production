import { Platform } from "react-native";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

// Phone photos are often 3–8 MB, more than the server accepts per file. Shrinking to at most 1600px and
// re-saving as JPEG (usually 200–500 KB) makes uploads fit, and keeps them quick on mobile data.
const MAX_PHOTO_SIDE = 1600;

async function preparePhoto(asset) {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width || 0, asset.height || 0) > MAX_PHOTO_SIDE) {
    // One side only, which keeps the proportions; on the web, a side given as null would mean 0.
    context.resize(asset.width >= asset.height ? { width: MAX_PHOTO_SIDE } : { height: MAX_PHOTO_SIDE });
  }
  const image = await context.renderAsync();
  return image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
}

/** Sends a picked photo to /temp-images; `name` is its file name on the web. Returns the upload and the local copy's uri. */
export async function uploadPhoto(request, asset, name) {
  const photo = await preparePhoto(asset);
  const form = new FormData();
  if (Platform.OS === "web") {
    form.append("image", await (await fetch(photo.uri)).blob(), name);
  } else {
    // Since SDK 57 the global fetch is expo/fetch, which only sends Blob-like files: React Native's
    // `{ uri, name, type }` parts make it throw before the request starts.
    form.append("image", new File(photo.uri));
  }
  const uploaded = await request("/temp-images", { method: "POST", form });
  return { upload: uploaded.data, uri: photo.uri };
}

/** What to tell someone when an upload fails. "failed to upload" and 413 come from the server's size limits. */
export function uploadErrorMessage(error) {
  const tooLarge = error.status === 413 || /failed to upload|too large/i.test(error.message || "");
  return tooLarge ? "That photo is too large to upload. Please try a smaller one." : error.message || "Couldn’t upload that photo.";
}
