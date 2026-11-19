
type BookingConfirmationData = {
  customerName: string;
  bookingReference: string;
  eventName: string;
  venue: string;
  eventDate: string;
  ticketDescription: string;
  quantity: number;
  totalPaid: string;
  isTest?: boolean;
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

export function bookingConfirmationHtml(
  booking: BookingConfirmationData
): string {
  const safe = (value: string) => escapeHtml(value);
  const testMode = booking.isTest === true;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Grandstand Pass Booking Confirmation</title>
</head>
<body style="margin:0;padding:0;background:#f1f4f8;font-family:Arial,Helvetica,sans-serif;color:#17263f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f4f8;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;">

          <tr>
            <td align="center" style="background:#142440;padding:32px 20px;">
              <div style="font-size:27px;font-weight:bold;letter-spacing:1px;color:#ffffff;">
                GRANDSTAND PASS
              </div>
              <div style="font-size:11px;letter-spacing:1px;color:#d5dfee;margin-top:8px;">
                YOUR PASS TO UNFORGETTABLE SPORTING MOMENTS
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 28px;">

              ${
                testMode
                  ? `<div style="background:#fff3cd;color:#7c4a03;padding:12px;text-align:center;font-weight:bold;margin-bottom:24px;">
                      TEST EMAIL — NO REAL BOOKING OR PAYMENT
                    </div>`
                  : ''
              }

              <h1 style="font-size:25px;margin:0 0 24px;">
                ${testMode ? 'Sample Booking Confirmation' : 'Booking Confirmed!'}
              </h1>

              <p style="line-height:1.7;">
                Dear ${safe(booking.customerName)},
              </p>

              <p style="line-height:1.7;">
                ${
                  testMode
                    ? 'This is a preview of the booking confirmation email customers will receive.'
                    : 'Thank you for booking with Grandstand Pass. Your booking has been confirmed.'
                }
              </p>

              <div style="background:#f1f4f8;padding:22px;margin:26px 0;">

                <div style="font-size:11px;color:#64748b;letter-spacing:1px;">
                  BOOKING REFERENCE
                </div>

                <div style="font-size:23px;font-weight:bold;margin:8px 0 22px;">
                  ${safe(booking.bookingReference)}
                </div>

                <div style="border-top:1px solid #d1d9e4;padding-top:18px;font-size:19px;font-weight:bold;">
                  ${safe(booking.eventName)}
                </div>

                <p style="color:#475569;line-height:1.6;">
                  ${safe(booking.venue)}<br />
                  ${safe(booking.eventDate)}
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #d1d9e4;padding-top:16px;">
                  <tr>
                    <td style="padding:8px 0;color:#64748b;">Ticket category</td>
                    <td align="right" style="padding:8px 0;">${safe(booking.ticketDescription)}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;">Quantity</td>
                    <td align="right" style="padding:8px 0;">${booking.quantity}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;">Total</td>
                    <td align="right" style="padding:8px 0;font-weight:bold;">${safe(booking.totalPaid)}</td>
                  </tr>
                </table>
              </div>

              <h2 style="font-size:18px;">What happens next?</h2>

              <p style="color:#475569;line-height:1.7;">
                We'll email you when your tickets are ready.
                Ticket release dates vary by event, and tickets
                may become available closer to the event date.
              </p>

              <p style="line-height:1.7;">
                You can check your booking details using your
                booking reference on our website.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
                <tr>
                  <td align="center" bgcolor="#142440" style="padding:15px;">
                    <a href="https://grandstandpass.com/my-booking"
                       style="color:#ffffff;text-decoration:none;font-weight:bold;">
                      View Your Booking
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size:13px;color:#64748b;line-height:1.7;">
                Need assistance?<br />
                <a href="mailto:info@grandstandpass.com" style="color:#1762c4;">
                  info@grandstandpass.com
                </a>
              </p>

              ${
                testMode
                  ? `<p style="font-size:12px;color:#9a3412;">
                      This message is for testing only. No booking
                      was created, no payment was taken, and no
                      tickets were purchased.
                    </p>`
                  : ''
              }

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
