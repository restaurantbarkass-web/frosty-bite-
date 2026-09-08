/**
 * Uploads an image to Cloudinary
 * @param file The file object to upload
 * @returns The secure URL of the uploaded image
 */
export async function uploadImage(file: File | Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "sy62d43g");

  try {
    const res = await fetch(
      "https://api.cloudinary.com/v1_1/dan5he0ir/image/upload",
      {
        method: "POST",
        body: formData
      }
    );

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error?.message || "Cloudinary upload failed");
    }

    const data = await res.json();
    return data.secure_url;
  } catch (error: any) {
    console.error("Cloudinary upload network error:", error);
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("Network error: Could not reach image upload server. Please check your internet connection or disable ad-blockers.");
    }
    throw error;
  }
}
