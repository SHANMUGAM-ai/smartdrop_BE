const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send booking confirmation email
 */
exports.sendBookingConfirmation = async ({ to, name, orderId, pickup, drop, price, payMethod }) => {
  const mailOptions = {
    from: `"SmartDrop" <${process.env.EMAIL_USER}>`,
    to,
    subject: `✅ Order Confirmed — ${orderId}`,
    html: `
      <div style="font-family: 'Outfit', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #f7f5f2; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 2.5rem;">📦</div>
          <h2 style="color: #ea580c; margin: 8px 0;">SmartDrop</h2>
        </div>
        <div style="background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
          <h3 style="margin-top: 0;">Hi ${name},</h3>
          <p>Your order has been placed successfully! 🎉</p>
          <table style="width: 100%; margin: 16px 0; font-size: 0.9rem;">
            <tr><td style="color: #78716c; padding: 6px 0;">Order ID</td><td style="font-weight: 700;">${orderId}</td></tr>
            <tr><td style="color: #78716c; padding: 6px 0;">Pickup</td><td style="font-weight: 700;">${pickup}</td></tr>
            <tr><td style="color: #78716c; padding: 6px 0;">Drop</td><td style="font-weight: 700;">${drop}</td></tr>
            <tr><td style="color: #78716c; padding: 6px 0;">Amount Paid</td><td style="font-weight: 700; color: #16a34a;">₹${price}</td></tr>
            <tr><td style="color: #78716c; padding: 6px 0;">Payment</td><td style="font-weight: 700;">${payMethod}</td></tr>
          </table>
          <p style="font-size: 0.85rem; color: #78716c;">You can track your order anytime at <a href="http://localhost:5173/track/${orderId}" style="color: #ea580c; font-weight: 700;">Track Order</a></p>
        </div>
        <p style="text-align: center; font-size: 0.78rem; color: #a8a29e; margin-top: 16px;">Fast. Smart. Reliable Delivery.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { sent: true };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { sent: false, error: err.message };
  }
};

/**
 * Send order status update email
 */
exports.sendStatusUpdate = async ({ to, name, orderId, status, partnerName }) => {
  const statusMessages = {
    accepted: `Great news! ${partnerName} has accepted your order and is on the way to pickup.`,
    picked_up: `${partnerName} has picked up your package. It's now on the way to the destination!`,
    out_for_delivery: `Your order is out for delivery! ${partnerName} will reach the drop location soon.`,
    delivered: `Your order has been delivered successfully! 🎉 Thanks for using SmartDrop.`,
  };

  const mailOptions = {
    from: `"SmartDrop" <${process.env.EMAIL_USER}>`,
    to,
    subject: `🚚 Order ${orderId} — ${status.replace(/_/g, ' ').toUpperCase()}`,
    html: `
      <div style="font-family: 'Outfit', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h3 style="color: #ea580c;">Hi ${name},</h3>
        <p>${statusMessages[status] || `Your order status has been updated to: ${status}`}</p>
        <p style="font-size: 0.85rem; color: #78716c;">Track live: <a href="http://localhost:5173/track/${orderId}" style="color: #ea580c; font-weight: 700;">Track Order</a></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { sent: true };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { sent: false, error: err.message };
  }
};

