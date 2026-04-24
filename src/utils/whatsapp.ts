export function sendWhatsAppMessage(phone: string, message: string): void {
  const formattedPhone = phone.replace(/\D/g, ""); // remove spaces, + etc
  const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

export function sendOTP(phone: string, otp: string) {
  const message = `
🔑 Delivery OTP: ${otp}

Give this OTP to rider to confirm delivery.
  `;

  sendWhatsAppMessage(phone, message);
}
