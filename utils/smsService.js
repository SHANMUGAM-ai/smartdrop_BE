const sendOrderOtpSms = async ({ phone, otp, orderId }) => {
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER,
  } = process.env;

  const message = `SmartDrop OTP for order ${orderId}: ${otp}. Valid for 10 minutes.`;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.log(`OTP for ${phone} (${orderId}): ${otp}`);
    return { delivered: false, provider: 'console' };
  }

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const body = new URLSearchParams({
    To: `+91${phone}`,
    From: TWILIO_PHONE_NUMBER,
    Body: message,
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SMS sending failed: ${errorText}`);
  }

  return { delivered: true, provider: 'twilio' };
};

module.exports = { sendOrderOtpSms };
