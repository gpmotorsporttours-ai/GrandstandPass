
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
  const safe = (value: string) => escapeHtml(value);

  // Reuse the Content-ID from our working booking email.
  const logoUrl = 'cid:grandstand-pass-logo';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Grandstand Pass Test Order Acknowledgement</title>
</head>

<body style="margin:0;padding:0;background:#f1f4f8;font-family:Arial,Helvetica,sans-serif;color:#17263f;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f4f8;">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;">

          <!-- Grandstand Pass logo -->
          <tr>
            <td align="center" bgcolor="#ffffff" style="background:#ffffff;padding:30px 24px 24px;">

              <img
                src="${logoUrl}"
                alt="Grandstand Pass"
                width="320"
                style="display:block;width:100%;max-width:320px;height:auto;border:0;"
              />

              <div style="font-size:11px;letter-spacing:1px;color:#64748b;margin-top:16px;text-align:center;">
                YOUR PASS TO UNFORGETTABLE SPORTING MOMENTS
              </div>

            </td>
          </tr>

          <!-- Navy divider -->
          <tr>
            <td style="background:#142440;height:5px;font-size:0;line-height:0;">
              &nbsp;
            </td>
          </tr>

          <!-- Email content -->
          <tr>
            <td style="padding:32px 28px;">

              <div style="background:#fff3cd;color:#7c4a03;padding:12px;text-align:center;font-weight:bold;margin-bottom:24px;">
                TEST ORDER — NO PAYMENT OR TICKET BOOKING
              </div>

              <h1 style="font-size:25px;margin:0 0 24px;color:#142440;">
                Test Order Received
              </h1>

              <p style="line-height:1.7;">
                Dear ${safe(order.customerName)},
              </p>

              <p style="line-height:1.7;color:#475569;">
                Thank you for testing Grandstand Pass.
                Your test order has been recorded successfully.
                This is not a confirmed ticket booking.
              </p>

              <!-- Order details -->
              <div style="background:#f1f4f8;padding:22px;margin:26px 0;">

                <div style="font-size:11px;color:#64748b;letter-spacing:1px;">
                  ORDER REFERENCE
                </div>

                <div style="font-size:23px;font-weight:bold;margin:8px 0 22px;color:#142440;overflow-wrap:anywhere;">
                  ${safe(order.orderReference)}
                </div>

                <div style="border-top:1px solid #d1d9e4;padding-top:18px;font-size:19px;font-weight:bold;color:#142440;">
                  ${safe(order.eventName)}
                </div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">

                  <tr>
                    <td style="padding:8px 0;color:#64748b;">
                      Ticket category
                    </td>
                    <td align="right" style="padding:8px 0;color:#17263f;">
                      ${safe(order.ticketDescription)}
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:8px 0;color:#64748b;">
                      Quantity
                    </td>
                    <td align="right" style="padding:8px 0;color:#17263f;">
                      ${order.quantity}
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:8px 0;color:#64748b;">
                      Indicative total
                    </td>
                    <td align="right" style="padding:8px 0;font-weight:bold;color:#142440;">
                      ${safe(order.totalAmount)}
                    </td>
                  </tr>

                </table>
              </div>

              <h2 style="font-size:18px;color:#142440;">
                What happens next?
              </h2>

              <p style="color:#475569;line-height:1.7;">
                No further action is required for this test.
                No payment has been collected, no supplier order
                has been placed, and no tickets have been reserved.
              </p>

              <p style="font-size:13px;color:#64748b;line-height:1.7;">
                Need assistance?<br />
                <a href="mailto:info@grandstandpass.com" style="color:#1762c4;">
                  info@grandstandpass.com
                </a>
              </p>

              <p style="font-size:12px;color:#9a3412;line-height:1.6;">
                This message is for testing only. No booking
                was created, no payment was taken, and no
                tickets were purchased.
              </p>

            </td>
          </tr>

          <!-- Company footer -->
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
