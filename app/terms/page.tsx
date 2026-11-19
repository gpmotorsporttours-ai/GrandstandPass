
import Link from 'next/link';
import { FileText, Mail } from 'lucide-react';

const sections = [
  {
    title: '1. About Grandstand Pass',
    paragraphs: [
      'Grandstand Pass is operated by Grandstand Pass (Pty) Ltd, also known as Grandstand Pass Proprietary Limited, a company registered in South Africa.',
      'We operate as an independent ticket reseller, offering access to tickets for sporting events including Formula 1, MotoGP, Football, Tennis and Other Events.',
      'We are not necessarily affiliated with, endorsed by or appointed as an official ticket agent of the event organisers, venues, teams or governing bodies.',
    ],
  },
  {
    title: '2. Scope of These Terms',
    paragraphs: [
      'These Terms & Conditions govern your use of our website and any ticket purchases made through Grandstand Pass.',
      'Additional event-specific ticket conditions, venue regulations and organiser rules may apply. Where mandatory consumer protection laws provide additional rights, those rights remain unaffected.',
      'Our current offering is event tickets only. Travel, accommodation and transport are not included unless expressly stated in a separate written offer.',
    ],
  },
  {
    title: '3. Ticket Availability and Booking',
    paragraphs: [
      'All ticket listings are subject to availability. Prices and availability may change before a booking is confirmed.',
      'Submitting an order or making a payment does not necessarily mean that the tickets have been secured. A booking is confirmed only when Grandstand Pass expressly confirms successful ticket procurement.',
      'If we cannot fulfil an order after receiving payment, we will communicate the outcome promptly and provide an appropriate refund or other remedy in accordance with applicable law.',
    ],
  },
  {
    title: '4. Ticket Prices and Payments',
    paragraphs: [
      'The price displayed for each ticket includes our ticket-handling fee. Any other applicable charges will be disclosed before payment.',
      'Available payment methods and currencies will be presented during checkout when online purchases are enabled.',
      'Payments may be processed by an authorised third-party payment provider. Currency conversion charges or fees imposed independently by your bank or card issuer may apply.',
      'Orders may be subject to reasonable security, identity and fraud-prevention checks.',
    ],
  },
  {
    title: '5. Ticket Delivery',
    paragraphs: [
      'Ticket delivery arrangements vary by event and ticket category. Tickets may be delivered electronically, through a mobile ticketing application, by physical delivery or through collection at a designated location.',
      'Many tickets become available approximately 3 to 7 days before the event, although delivery may occur earlier or closer to the event date.',
      'Your booking confirmation is separate from the delivery of your actual event tickets.',
      'Customers are responsible for providing accurate contact details and following the delivery, collection or ticket activation instructions communicated to them.',
    ],
  },
  {
    title: '6. Seating and Ticket Categories',
    paragraphs: [
      'Tickets are sold according to the category and description presented during booking.',
      'Unless expressly confirmed, a particular seat number, row, section or viewing position is not guaranteed.',
      'Tickets purchased together are not guaranteed to be adjacent unless this is specifically stated in the ticket information.',
      'Venue layouts, access arrangements and seating allocations may be subject to changes made by the relevant organiser or venue.',
    ],
  },
  {
    title: '7. Customer Cancellations and Refunds',
    paragraphs: [
      'Confirmed ticket purchases may be subject to restrictions on cancellation, exchange and refund, depending on the event conditions and applicable law.',
      'Cancellation requests will be assessed in accordance with applicable consumer protection legislation, including any rights that cannot lawfully be excluded.',
      'Where cancellation charges are legally permitted, any such charge must comply with applicable law.',
      'Customers wishing to request a cancellation should contact info@grandstandpass.com as soon as possible, quoting their booking reference.',
    ],
  },
  {
    title: '8. Event Postponement, Cancellation or Changes',
    paragraphs: [
      'Event organisers may change dates, schedules, venues, participants or other event arrangements.',
      'For postponed or rescheduled events, tickets may remain valid for the revised event, subject to the applicable event conditions and consumer rights.',
      'If an event is cancelled, available refunds and other remedies will be determined by the circumstances, applicable event conditions and relevant law.',
      'Grandstand Pass will provide relevant information and assistance when notified of material event changes.',
    ],
  },
  {
    title: '9. Admission and Customer Responsibilities',
    paragraphs: [
      'Customers are responsible for checking event dates, locations, ticket details, entry requirements and any restrictions applicable to their tickets.',
      'Customers attending international events are responsible for arranging any required passports, visas and travel documentation.',
      'Admission is subject to the venue and event organiser’s rules, including security checks, identification requirements and prohibited-item policies.',
      'Tickets must not be altered, duplicated or used in violation of applicable ticket conditions.',
    ],
  },
  {
    title: '10. Website Information',
    paragraphs: [
      'We aim to provide accurate event information, ticket descriptions and pricing. However, information may change and errors may occasionally occur.',
      'If a material error is identified before an order is confirmed, we will explain the issue and provide appropriate options.',
      'Nothing in these Terms limits rights or remedies that customers are entitled to under applicable law.',
    ],
  },
  {
    title: '11. Liability',
    paragraphs: [
      'Grandstand Pass is responsible for meeting its obligations under the applicable purchase agreement and relevant law.',
      'We are not responsible for matters outside our reasonable control, except to the extent that applicable law imposes responsibility on us.',
      'Nothing in these Terms excludes or restricts liability or consumer rights where doing so would be unlawful.',
    ],
  },
  {
    title: '12. Privacy and Personal Information',
    paragraphs: [
      'We collect and process personal information as necessary to operate our website, administer bookings, communicate with customers and comply with legal obligations.',
      'Our handling of personal information will be described in our Privacy Policy, including relevant rights under South African data protection legislation.',
    ],
  },
  {
    title: '13. Governing Law and Disputes',
    paragraphs: [
      'Grandstand Pass (Pty) Ltd is registered and currently operates from South Africa.',
      'These Terms are governed by the laws of South Africa, subject to any mandatory consumer protection rights and jurisdictional rules that apply to a particular customer or transaction.',
      'Customers are encouraged to contact us first so that we can attempt to resolve any concern promptly and fairly.',
      'Nothing in these Terms prevents a customer from approaching a competent court, regulator or dispute-resolution body where permitted by law.',
    ],
  },
  {
    title: '14. Changes to These Terms',
    paragraphs: [
      'We may update these Terms & Conditions to reflect changes in our business, services, legal requirements or website functionality.',
      'The terms applicable to a completed purchase will not be changed retrospectively in a manner that unlawfully removes the customer’s rights.',
    ],
  },
  {
    title: '15. Contact Information',
    paragraphs: [
      'Legal entity: Grandstand Pass (Pty) Ltd',
      'Country of registration and current operation: South Africa',
      'Website: www.grandstandpass.com',
      'Email: info@grandstandpass.com',
      'Additional statutory company and contact details will be published before live ticket sales begin.',
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="bg-slate-50 min-h-screen py-14 md:py-20">
      <div className="container-wide max-w-5xl">
        <div className="text-center mb-12">
          <FileText
            className="mx-auto text-blue-600 mb-5"
            size={42}
          />

          <h1 className="text-4xl md:text-5xl font-bold text-[#0b2144]">
            Terms &amp; Conditions
          </h1>

          <p className="mt-5 text-lg text-slate-600">
            Important information about using Grandstand Pass
            and purchasing sporting event tickets.
          </p>

          <p className="mt-4 text-sm text-slate-500">
            Grandstand Pass (Pty) Ltd — South Africa
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm mb-8">
          <p className="text-slate-600 leading-7">
            Please read these Terms &amp; Conditions carefully
            before purchasing tickets. By using our website
            or placing an order, you acknowledge the
            applicable terms, subject to your rights
            under relevant consumer protection laws.
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <section
              key={section.title}
              className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm"
            >
              <h2 className="text-xl md:text-2xl font-bold text-[#0b2144] mb-5">
                {section.title}
              </h2>

              <div className="space-y-4">
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-slate-600 leading-7"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 text-center bg-white border border-slate-200 rounded-2xl p-8">
          <Mail
            className="mx-auto text-blue-600 mb-4"
            size={32}
          />

          <h2 className="text-2xl font-bold text-[#0b2144]">
            Questions About Our Terms?
          </h2>

          <p className="mt-3 text-slate-600">
            Please contact our team if you need
            clarification before making a purchase.
          </p>

          <Link
            href="/contact"
            className="inline-block mt-6 bg-[#0b2144] text-white font-semibold px-7 py-4 rounded-xl hover:opacity-90 transition-opacity"
          >
            Contact Us
          </Link>

          <p className="mt-4 text-sm text-slate-500">
            info@grandstandpass.com
          </p>
        </div>

        <p className="text-center text-sm text-slate-500 mt-8">
          Grandstand Pass is currently in development.
          Live ticket purchases are not yet available.
        </p>
      </div>
    </main>
  );
}
