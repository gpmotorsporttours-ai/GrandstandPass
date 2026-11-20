
type OrderAcknowledgementData = {
  customerName: string;
  orderReference: string;
  eventName: string;
  ticketDescription: string;
  quantity: number;
  totalAmount: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });
}

export function orderAcknowledgementHtml(
  order: OrderAcknowledgementData
): string {
  const safe = escapeHtml;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Grandstand Pass Test Order Acknowledgement</title>
</head>
<body style="margin:0;padding:0;background:#f1f4f8;font-family:Arial,Helvetica,sans-serif;color:#17263f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f4f8;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;">

          <tr>
            <td align="center" bgcolor="#ffffff" style="background:#ffffff;padding:32px 24px 24px;">
              <img
                src="https://grandstandpass.com/grandstandpass-logo-transparent.png"
                alt="Grandstand Pass"
                width="500"
                style="display:block;width:100%;max-width:500px;height:auto;border:0;"
              />
              <p style="font-size:12px;letter-spacing:1px;color:#64748b;margin:22px 0 0;">
                YOUR PASS TO UNFORGETTABLE SPORTING MOMENTS
              </p>
            </td>
          </tr>

          <tr>
            <td style="height:5px;background:#142440;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td style="padding:32px 28px;">

              <div style="background:#fff3cd;color:#7c4a03;padding:14px;text-align:center;font-weight:bold;margin-bottom:26px;">
                TEST ORDER — NO PAYMENT OR TICKET BOOKING
              </div>

              <h1 style="font-size:25px;line-height:1.3;color:#17263f;margin:0 0 24px;">
                Test Order Received
              </h1>

              <p style="line-height:1.7;color:#17263f;">
                Dear ${safe(order.customerName)},
              </p>

              <p style="line-height:1.7;color:#475569;">
                Thank you for testing Grandstand Pass.
                Your test order has been recorded successfully.
                This is not a confirmed ticket booking.
              </p>

              <div style="background:#f1f4f8;padding:22px;margin:26px 0;">
                <div style="font-size:11px;color:#64748b;letter-spacing:1px;">
                  ORDER REFERENCE
                </div>

                <div style="font-size:22px;font-weight:bold;color:#17263f;margin:8px 0 22px;overflow-wrap:anywhere;">
                  ${safe(order.orderReference)}
                </div>

                <div style="border-top:1px solid #d1d9e4;padding-top:18px;font-size:19px;font-weight:bold;color:#17263f;">
                  ${safe(order.eventName)}
                </div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
                  <tr>
                    <td style="padding:8px 0;color:#64748b;">Ticket category</td>
                    <td align="right" style="padding:8px 0;color:#17263f;">${safe(order.ticketDescription)}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;">Quantity</td>
                    <td align="right" style="padding:8px 0;color:#17263f;">${order.quantity}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;">Indicative total</td>
                    <td align="right" style="padding:8px 0;font-weight:bold;color:#17263f;">${safe(order.totalAmount)}</td>
                  </tr>
                </table>
              </div>

              <h2 style="font-size:18px;color:#17263f;">
                What happens next?
              </h2>

              <p style="line-height:1.7;color:#475569;">
                No further action is required for this test.
                No payment has been collected, no supplier order
                has been placed, and no tickets have been reserved.
              </p>

              <p style="font-size:13px;line-height:1.7;color:#64748b;">
                Need assistance?
                <a href="mailto:info@grandstandpass.com" style="color:#1762c4;">
                  info@grandstandpass.com
                </a>
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="background:#e4eaf2;padding:24px;font-size:12px;color:#475569;line-height:1.8;">
              Grandstand Pass (Pty) Ltd<br />
              South Africa<br />
              Independent ticket reseller
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
