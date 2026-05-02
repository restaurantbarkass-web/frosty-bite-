/**
 * Uploads an image to Cloudinary
 * @param file The file object to upload
 * @returns The secure URL of the uploaded image
 */
export async function uploadImage(file: File | Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "sy62d43g");

  const res = await fetch(
    "https://api.cloudinary.com/v1_1/dan5he0ir/image/upload",
    {
      method: "POST",
      body: formData
    }
  );

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error?.message || "Failed to upload image");
  }

  const data = await res.json();
  return data.secure_url;
}
